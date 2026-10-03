"""Polls-plus-fundamentals Senate model, run as correlated simulations.

For each race: a weighted polling average and a fundamentals prior are blended
into a mean margin (opposition minus Republican). Simulations add a shared
national error, a regional error and a race error, then count seats.
"""

from __future__ import annotations

import hashlib
import math
from datetime import date, timedelta

import numpy as np


def config_version(config_text: str) -> str:
    return hashlib.sha1(config_text.encode()).hexdigest()[:8]


def poll_margin(p: dict) -> float:
    return p["opp"] - p["rep"]


def weighted_rows(polls: list[dict], as_of: date, cfg: dict, half_life: float) -> list[tuple[float, float, dict]]:
    """(weight, adjusted margin, poll) for each usable poll, weighted in fresh full-size LV poll units."""
    pc = cfg["polls"]
    excluded = {(e["state"], e["pollster"], str(e["end_date"])) for e in pc.get("exclude", [])}
    rows = []
    for p in polls:
        end = date.fromisoformat(p["end_date"])
        age = (as_of - end).days
        if age < 0 or age > pc["max_age_days"]:
            continue
        if (p["state"], p["pollster"], p["end_date"]) in excluded:
            continue
        w = 0.5 ** (age / half_life)
        n = p.get("n") or pc["sample_size_reference"] * 0.8
        w *= min(math.sqrt(n / pc["sample_size_reference"]), pc["sample_size_cap"])
        w *= pc["population_weights"].get(p.get("population") or "unknown", pc["population_weights"]["unknown"])
        w *= pc["pollster_weights"].get(p["pollster"], 1.0)
        m = poll_margin(p) - pc["house_effects"].get(p["pollster"], 0.0)
        if p.get("sponsor_party") == "D":
            w *= pc["partisan_weight"]
            m -= pc["partisan_shift"]
        elif p.get("sponsor_party") == "R":
            w *= pc["partisan_weight"]
            m += pc["partisan_shift"]
        if w > 0:
            rows.append((w, m, p))
    if pc.get("pollster_count_damping"):
        counts: dict[str, int] = {}
        for _, _, p in rows:
            counts[p["pollster"]] = counts.get(p["pollster"], 0) + 1
        rows = [(w / math.sqrt(counts[p["pollster"]]), m, p) for w, m, p in rows]
    return rows


def weighted_average(polls: list[dict], as_of: date, cfg: dict, half_life: float) -> tuple[float | None, float]:
    """Weighted mean margin and total weight (in fresh full-size LV poll units)."""
    rows = weighted_rows(polls, as_of, cfg, half_life)
    if not rows:
        return None, 0.0
    total = sum(w for w, _, _ in rows)
    return sum(w * m for w, m, _ in rows) / total, total


def poll_levels(polls: list[dict], as_of: date, cfg: dict, half_life: float) -> dict | None:
    """Weighted average share for each side ({"opp": %, "rep": %}), for the trend charts."""
    rows = weighted_rows(polls, as_of, cfg, half_life)
    total = sum(w for w, _, _ in rows)
    if total < 1.0:
        return None
    return {k: round(sum(w * p[k] for w, _, p in rows) / total, 2) for k in ("opp", "rep")}


def national_environment(polls: list[dict], as_of: date, cfg: dict, president_party: str = "R") -> dict:
    """Dem national lead, blended from the generic ballot and the president's net approval.

    The approval formula gives the lead of the party out of the White House, so
    it flips sign when the president is a Democrat (the 2022 backtest).
    """
    f = cfg["fundamentals"]
    if f.get("national_environment_override") is not None:
        return {"value": float(f["national_environment_override"]), "source": "override"}
    gb, gb_w = weighted_average([p for p in polls if p["state"] == "US"], as_of, cfg, f["generic_ballot_half_life_days"])
    net, net_w = weighted_average([p for p in polls if p["state"] == "APPROVAL"], as_of, cfg, f["approval_half_life_days"])
    gb = gb if gb is not None and gb_w >= 1.0 else None
    net = net if net is not None and net_w >= 1.0 else None
    parts = []
    if gb is not None:
        parts.append((f["generic_ballot_weight"], gb))
    if net is not None:
        out_party_lead = f["approval_intercept"] - f["approval_slope"] * net
        parts.append((f["approval_weight"], out_party_lead if president_party == "R" else -out_party_lead))
    if not parts:
        return {"value": float(f["generic_ballot_fallback"]), "source": "fallback"}
    value = sum(w * v for w, v in parts) / sum(w for w, _ in parts)
    return {
        "value": value,
        "generic_ballot_levels": poll_levels([p for p in polls if p["state"] == "US"], as_of, cfg,
                                             f["generic_ballot_half_life_days"]),
        "approval_levels": poll_levels([p for p in polls if p["state"] == "APPROVAL"], as_of, cfg,
                                       f["approval_half_life_days"]),
        "source": " + ".join(n for n, x in (("generic ballot", gb), ("approval", net)) if x is not None),
        "generic_ballot": None if gb is None else round(gb, 2),
        "trump_net_approval": None if net is None else round(net, 2),
    }


def fundraising_shift(state: str, extras: dict, cfg: dict) -> float:
    money = extras.get("fundraising", {}).get(state)
    if not money or money["rep"] <= 0 or money["opp"] <= 0:
        return 0.0
    f = cfg["fundamentals"]
    shift = f["fundraising_points_per_doubling"] * math.log2(money["opp"] / money["rep"])
    return max(-f["fundraising_cap"], min(f["fundraising_cap"], shift))


def weather_shift(state: str, extras: dict, cfg: dict) -> float:
    rain = extras.get("weather", {}).get(state)
    if rain is None:
        return 0.0
    f = cfg["fundamentals"]
    shift = f["weather_points_per_inch"] * rain
    return max(-f["weather_cap"], min(f["weather_cap"], shift))


def economy_shift(extras: dict, as_of: date, cfg: dict, president_party: str = "R") -> dict:
    """Points of Dem national lead from the markets' change over the lookback window.

    A rising S&P 500 reads as a better economy; rising 10-year yields (borrowing
    costs) and Brent crude (gas prices) read as a worse one. A better economy
    helps the president's party, so with a Republican president it moves the
    national environment toward the GOP.
    """
    ec = cfg.get("economy")
    series = extras.get("economy")
    if not ec or not series:
        return {"shift": 0.0}

    def change(key: str, relative: bool) -> float | None:
        values = series.get(key) or {}
        now = [d for d in values if d <= as_of.isoformat()]
        then = [d for d in values if d <= (as_of - timedelta(ec["lookback_days"])).isoformat()]
        if not now or not then:
            return None
        a, b = values[max(then)], values[max(now)]
        return 100 * (b / a - 1) if relative else b - a

    sp, yld, oil = change("sp500", True), change("yield_10y", False), change("brent", True)
    good = 0.0  # points toward the president's party
    if sp is not None:
        good += ec["sp500_points_per_10pct"] * sp / 10
    if yld is not None:
        good -= ec["yield_points_per_point"] * yld
    if oil is not None:
        good -= ec["brent_points_per_10pct"] * oil / 10
    good = max(-ec["cap"], min(ec["cap"], good))
    return {
        "shift": -good if president_party == "R" else good,
        "sp500_change_pct": None if sp is None else round(sp, 2),
        "yield_10y_change": None if yld is None else round(yld, 2),
        "brent_change_pct": None if oil is None else round(oil, 2),
    }


def prior_margin(race: dict, facts: dict, env: float, cfg: dict, extras: dict | None = None) -> float:
    f = cfg["fundamentals"]
    lean = 0.0
    for year, w in f["lean_weights"].items():
        lean += w * (race[f"pres_{year}"] - facts[f"national_pres_{year}"])
    margin = lean * f["lean_factor"] + env
    inc = f["incumbency"] * (f["appointed_incumbency_factor"] if race.get("appointed") else 1.0)
    if race["incumbent"] == "R":
        margin -= inc
    elif race["incumbent"] in ("D", "I") and race["opp"].get("party") in ("D", "I"):
        margin += inc
    margin += cfg["races"].get(race["state"], {}).get("candidate_quality", 0.0)
    if extras:
        margin += fundraising_shift(race["state"], extras, cfg) + weather_shift(race["state"], extras, cfg)
    return margin


def rating(p_opp: float, cfg: dict) -> int:
    """-3 (Safe R) .. 0 (Toss-up) .. +3 (Safe opposition)."""
    r = cfg["ratings"]
    lead = max(p_opp, 1 - p_opp)
    step = 0 if lead < r["tossup_below"] else 1 if lead < r["lean_below"] else 2 if lead < r["likely_below"] else 3
    return step if p_opp >= 0.5 else -step


def sample_simulations(dem_seats: np.ndarray, opp_wins: np.ndarray, rng: np.random.Generator,
                       k: int = 100) -> list[dict]:
    """k simulations whose seat counts match the overall distribution (largest-remainder rounding)."""
    counts = np.bincount(dem_seats)
    exact = counts / counts.sum() * k
    n = np.floor(exact).astype(int)
    for s in np.argsort(-(exact - n))[: k - n.sum()]:
        n[s] += 1
    out = []
    for s in np.nonzero(n)[0]:
        for i in rng.choice(np.nonzero(dem_seats == s)[0], size=n[s], replace=False):
            out.append({"dem_seats": int(s), "winners": "".join("D" if w else "R" for w in opp_wins[i])})
    return out


def run(facts: dict, cfg: dict, polls: list[dict], as_of: date, seed: int | None = None,
        extras: dict | None = None) -> dict:
    """extras: {"fundraising": {state: {rep, opp}}, "weather": {state: inches}} as known on as_of."""
    extras = extras or {}
    races = facts["races"]
    election = facts["election_day"]
    if isinstance(election, str):
        election = date.fromisoformat(election)
    days_left = max((election - as_of).days, 0)
    national = national_environment(polls, as_of, cfg, facts.get("president_party", "R"))
    economy = economy_shift(extras, as_of, cfg, facts.get("president_party", "R"))
    env = national["value"] + economy["shift"]
    pc, ec = cfg["polls"], cfg["error"]

    means, sds, rows = [], [], []
    for race in races:
        prior = prior_margin(race, facts, env, cfg, extras)
        avg, weight = weighted_average([p for p in polls if p["state"] == race["state"]], as_of, cfg, pc["half_life_days"])
        k = cfg["fundamentals"]["prior_weight_in_polls"]
        w_poll = weight / (weight + k) if avg is not None else 0.0
        mean = w_poll * avg + (1 - w_poll) * prior if avg is not None else prior
        override = cfg["races"].get(race["state"], {}).get("override_margin")
        if override is not None:
            mean = float(override)
        sd = w_poll * ec["state_polled"] + (1 - w_poll) * ec["state_unpolled"] + ec["state_per_day"] * days_left
        if race["opp"].get("party") == "I":
            sd = math.hypot(sd, ec["independent_extra"])
        n_polls = sum(
            1 for p in polls
            if p["state"] == race["state"] and 0 <= (as_of - date.fromisoformat(p["end_date"])).days <= pc["max_age_days"]
        )
        means.append(mean)
        sds.append(sd)
        rows.append({"race": race, "prior": prior, "poll_avg": avg, "poll_weight": w_poll, "n_polls": n_polls})

    rng = np.random.default_rng(seed)
    n_sims = cfg["simulations"]
    df = ec["t_df"]
    t_scale = math.sqrt((df - 2) / df)  # unit-variance t draws

    def draws(shape):
        return rng.standard_t(df, size=shape) * t_scale

    regions = sorted({r["region"] for r in races})
    region_idx = np.array([regions.index(r["region"]) for r in races])
    national_err = draws(n_sims) * (ec["national"] + ec["national_per_day"] * days_left)
    regional = draws((n_sims, len(regions))) * ec["regional"]
    state = draws((n_sims, len(races))) * np.array(sds)
    margins = np.array(means)[None, :] + national_err[:, None] + regional[:, region_idx] + state
    opp_wins = margins > 0

    caucus_d = np.array([
        r["opp"].get("caucus") == "D" or cfg["control"]["independents_count_as"] == "D" for r in races
    ])
    dem_seats = facts["seats_not_up"]["D"] + (opp_wins & caucus_d).sum(axis=1)
    rep_seats = facts["seats_not_up"]["R"] + (~opp_wins).sum(axis=1)
    vp = cfg["control"]["vice_president_party"]
    dem_control = (dem_seats >= 51) | ((dem_seats == 50) & (vp == "D"))
    rep_control = (rep_seats >= 51) | ((rep_seats == 50) & (vp == "R"))

    race_out = []
    for i, row in enumerate(rows):
        race = row["race"]
        p_opp = float(opp_wins[:, i].mean())
        lo, hi = np.percentile(margins[:, i], [10, 90])
        race_out.append({
            "state": race["state"],
            "name": race["name"],
            "special": bool(race.get("special")),
            "rep": {"name": race["rep"]["name"], "party": "R"},
            "opp": {"name": race["opp"]["name"], "party": race["opp"].get("party", "D"),
                    "caucus": race["opp"].get("caucus", "D")},
            "incumbent": race["incumbent"],
            "p_opp": round(p_opp, 4),
            "p_rep": round(1 - p_opp, 4),
            "mean_margin": round(float(means[i]), 2),
            "margin_10": round(float(lo), 2),
            "margin_90": round(float(hi), 2),
            "poll_avg": None if row["poll_avg"] is None else round(row["poll_avg"], 2),
            "n_polls": row["n_polls"],
            "poll_weight": round(row["poll_weight"], 3),
            "prior_margin": round(row["prior"], 2),
            "fundraising_shift": round(fundraising_shift(race["state"], extras, cfg), 2),
            "weather_shift": round(weather_shift(race["state"], extras, cfg), 2),
            "rating": rating(p_opp, cfg),
        })

    seat_hist = np.bincount(dem_seats, minlength=101)
    samples = sample_simulations(dem_seats, opp_wins, rng)
    lo_seat, hi_seat = int(dem_seats.min()), int(dem_seats.max())
    return {
        "as_of": as_of.isoformat(),
        "election_day": election.isoformat(),
        "simulations": n_sims,
        "national_environment": round(env, 2),
        "national_environment_source": national["source"],
        "economy_shift": round(economy["shift"], 2),
        "economy": {k: v for k, v in economy.items() if k != "shift"},
        "generic_ballot": national.get("generic_ballot"),
        "trump_net_approval": national.get("trump_net_approval"),
        "generic_ballot_levels": national.get("generic_ballot_levels"),
        "approval_levels": national.get("approval_levels"),
        "p_dem_control": round(float(dem_control.mean()), 4),
        "p_rep_control": round(float(rep_control.mean()), 4),
        "p_no_majority": round(float(1 - dem_control.mean() - rep_control.mean()), 4),
        "dem_seats_mean": round(float(dem_seats.mean()), 2),
        "rep_seats_mean": round(float(rep_seats.mean()), 2),
        "dem_seats_10": int(np.percentile(dem_seats, 10)),
        "dem_seats_90": int(np.percentile(dem_seats, 90)),
        "dem_seat_distribution": {str(s): round(float(seat_hist[s] / n_sims), 4) for s in range(lo_seat, hi_seat + 1)},
        # 100 representative simulations for the seat histogram: each one's Dem seats and,
        # per race in "races" order, "D" if the opposition won or "R".
        "sample_simulations": samples,
        "races": race_out,
    }
