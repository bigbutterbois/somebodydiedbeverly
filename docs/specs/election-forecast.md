# Election forecast: 2026 Senate

## Decisions

- **Election**: 2026 midterms, every Senate race on the ballot (regular plus any specials). No House, governors or presidential for now.
- **Model**: polls plus fundamentals, run as simulations, in the spirit of Silver Bulletin. Mike wants a lot of control over the model, so its assumptions are explicit, editable settings rather than buried constants.
- **Updates**: runs daily and publishes automatically, no review step.
- **Poll data**: scraped automatically. Wikipedia's per-race Senate polling tables are the primary source (openly licensed, easy to parse). RealClearPolling (RCP) is only a cross-check for missed polls, since its terms restrict automated scraping.
- **Display**: Senate control odds, a state map, and odds over time. Per-race pages are not required.
- **Methodology page**: none.

## Timing

Election day is **2026-11-03**, about a month after these decisions. The model has to be live within days to be useful, so build the smallest working version first and add refinements while it runs.

## Pipeline

1. **Scrape** (daily, scheduled GitHub Action): pull new Senate polls per state. Store raw rows with source URL, pollster, dates, sample size and population (LV/RV/A), and each candidate's share.
2. **Average**: per race, a weighted polling average (recency, sample size, pollster rating, LV over RV), with optional house-effect adjustments.
3. **Fundamentals prior**: per race, from partisan lean (past presidential results), incumbency, candidate quality flags, and the national environment (generic ballot). Blend with the polling average; the poll weight grows as polls accumulate and election day nears.
4. **Simulate**: about 10,000+ runs with a shared national error plus correlated regional/demographic error plus per-state error. Count seats, including seats not up this cycle and the VP tiebreak, to get control odds.
5. **Publish**: write `latest.json` (topline, per-state odds, seat distribution), `history.json` (one entry per day) and `polls.json` (every poll scraped) to the `forecast-data` branch. The site reads them from there (`src/lib/forecast.ts`) and refreshes every 15 minutes.

As built: Python in GitHub Actions (`.github/workflows/forecast.yml`, code in `forecast/`), at 6am US Eastern. Publishing to a git branch instead of Supabase means no database keys have to live in GitHub. If a run fails, the site keeps showing the last good forecast.

## Mike's control panel

Model settings live in one versioned config, `forecast/config.yaml` (editable from `/admin/forecast` later); race facts (candidates, past presidential results) are in `forecast/races.yaml`: poll recency decay, pollster weights and house effects, fundamentals vs. polls blend, error sizes and correlation, per-race manual overrides (for example, exclude a poll or pin a candidate-quality adjustment). Every snapshot records which config version produced it.

## Public side (`src/app/(site)/forecast`)

- Headline: chance each party controls the Senate, and the expected seat count.
- Map of states with a Senate race, colored by win probability.
- Line chart of control odds over time.
- Table of races with each side's probability and polling average.

## Data

All forecast data lives as JSON on the `forecast-data` branch (see Pipeline). There are no forecast tables in Supabase.

## Open items

- Seats not up in 2026 and the starting 53–47 split are fixed inputs in the config.
- What the page shows after election day (freeze on the final forecast, or move on to 2028) is not decided.
