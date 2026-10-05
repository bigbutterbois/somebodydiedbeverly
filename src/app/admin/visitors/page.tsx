import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DailyChart } from "./DailyChart";

export const metadata = { title: "Visitors" };

const RANGES = [7, 30, 90] as const;

type Count = { label: string; n: number };
type Place = { label: string; n: number; visitors: number };
type City = { city: string; region: string | null; country: string | null; n: number; visitors: number };
export type Day = { day: string; views: number; visitors: number };
type Stats = {
  views: number;
  visitors: number;
  bad_passwords: number;
  daily: Day[];
  pages: Count[];
  referrers: Count[];
  countries: Place[];
  cities: City[];
  devices: Count[];
  browsers: Count[];
};
type Visit = {
  id: number;
  created_at: string;
  kind: "view" | "bad_password";
  path: string;
  referrer: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
};

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

function countryName(code: string | null) {
  if (!code) return "";
  try {
    return countryNames.of(code) ?? code;
  } catch {
    return code;
  }
}

function flag(code: string | null) {
  if (!code || !/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

function place(v: { city: string | null; region: string | null; country: string | null }) {
  const parts = [v.city, v.country === "US" ? v.region : countryName(v.country)];
  return parts.filter(Boolean).join(", ") || "Unknown";
}

const when = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function VisitorsPage({ searchParams }: PageProps<"/admin/visitors">) {
  const { days: daysParam } = await searchParams;
  const days = RANGES.find((d) => String(d) === daysParam) ?? 30;

  const supabase = await createClient();
  const [{ data: statsData }, { data: recentData }] = await Promise.all([
    supabase.rpc("visit_stats", { p_days: days }),
    supabase
      .from("visits")
      .select("id, created_at, kind, path, referrer, country, region, city, device, browser, os")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const stats = statsData as Stats | null;
  const recent = (recentData ?? []) as Visit[];

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-normal tracking-tight">Visitors</h1>
          <p className="text-sm text-muted">
            Public pages only, not counting you. Locations are approximate (city level).
          </p>
        </div>
        <div className="flex gap-1 text-sm" role="group" aria-label="Date range">
          {RANGES.map((d) => (
            <Link
              key={d}
              href={`/admin/visitors?days=${d}`}
              aria-current={d === days ? "true" : undefined}
              className={
                d === days
                  ? "rounded-full border border-accent px-3 py-1 text-accent"
                  : "rounded-full border border-line px-3 py-1 text-muted hover:text-foreground"
              }
            >
              {d} days
            </Link>
          ))}
        </div>
      </header>

      {!stats ? (
        <p className="text-muted">Couldn&apos;t load visitor stats.</p>
      ) : (
        <>
          <section className="grid grid-cols-3 gap-4">
            <Tile label="Page views" value={stats.views} />
            <Tile label="Visitors" value={stats.visitors} hint="unique per day" />
            <Tile label="Wrong passwords" value={stats.bad_passwords} />
          </section>

          <section className="flex flex-col gap-3">
            <Label>Page views per day</Label>
            <DailyChart daily={stats.daily} />
          </section>

          <div className="grid gap-10 sm:grid-cols-2">
            <Ranked
              title="Countries"
              rows={stats.countries.map((c) => ({
                label: `${flag(c.label)} ${countryName(c.label)}`.trim(),
                n: c.n,
              }))}
            />
            <Ranked
              title="Cities"
              rows={stats.cities.map((c) => ({ label: place(c), n: c.n }))}
            />
            <Ranked title="Pages" rows={stats.pages} />
            <Ranked title="Came from" rows={stats.referrers} empty="No outside links yet." />
            <Ranked
              title="Devices"
              rows={stats.devices.map((d) => ({
                label: d.label.charAt(0).toUpperCase() + d.label.slice(1),
                n: d.n,
              }))}
            />
            <Ranked title="Browsers" rows={stats.browsers} />
          </div>
        </>
      )}

      <section className="flex flex-col gap-3">
        <Label>Latest activity</Label>
        {recent.length === 0 ? (
          <p className="text-muted">Nothing logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-4 font-normal">When</th>
                  <th className="py-2 pr-4 font-normal">Where</th>
                  <th className="py-2 pr-4 font-normal">Page</th>
                  <th className="py-2 font-normal">Device</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recent.map((v) => (
                  <tr key={v.id}>
                    <td className="whitespace-nowrap py-2 pr-4 tabular-nums text-muted">
                      {when.format(new Date(v.created_at))}
                    </td>
                    <td className="py-2 pr-4">
                      {flag(v.country)} {place(v)}
                    </td>
                    <td className="py-2 pr-4">
                      {v.kind === "bad_password" ? (
                        <span className="text-danger">Wrong password</span>
                      ) : (
                        v.path
                      )}
                      {v.referrer && <span className="text-muted"> from {v.referrer}</span>}
                    </td>
                    <td className="whitespace-nowrap py-2 text-muted">
                      {[v.browser, v.os].filter(Boolean).join(" on ") || v.device}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs uppercase tracking-[0.12em] text-muted">{children}</h2>;
}

function Tile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 border-t border-line pt-3">
      <span className="text-xs uppercase tracking-[0.12em] text-muted">{label}</span>
      <span className="text-3xl font-light tabular-nums">{value.toLocaleString()}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

function Ranked({ title, rows, empty }: { title: string; rows: Count[]; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <section className="flex flex-col gap-3">
      <Label>{title}</Label>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{empty ?? "Nothing yet."}</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {rows.map((r) => (
            <li key={r.label} className="flex flex-col gap-1">
              <div className="flex justify-between gap-4">
                <span className="truncate">{r.label}</span>
                <span className="tabular-nums text-muted">{r.n.toLocaleString()}</span>
              </div>
              <div className="h-1 rounded-full bg-surface">
                <div
                  className="h-1 rounded-full bg-accent"
                  style={{ width: `${(r.n / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
