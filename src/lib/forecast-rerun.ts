import "server-only";

// Starts the Forecast GitHub Actions workflow from the admin page and reads how
// its latest run went. Needs FORECAST_RERUN_TOKEN: a fine-grained GitHub token
// for this repo only, with Actions read and write.

const WORKFLOW =
  "https://api.github.com/repos/bigbutterbois/somebodydiedbeverly/actions/workflows/forecast.yml";

export const rerunConfigured = () => Boolean(process.env.FORECAST_RERUN_TOKEN);

function github(path: string, init?: RequestInit) {
  return fetch(`${WORKFLOW}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${process.env.FORECAST_RERUN_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
}

/** Runs today's forecast again on main, even if one already exists. */
export async function dispatchForecast() {
  const res = await github("/dispatches", {
    method: "POST",
    body: JSON.stringify({ ref: "main", inputs: { force: true } }),
  });
  if (!res.ok) throw new Error(`GitHub said ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

export type ForecastRun = {
  status: string; // queued, in_progress, completed…
  conclusion: string | null; // success, failure, skipped…
  created_at: string;
  html_url: string;
};

/** The newest run started by hand (the rerun button or GitHub's Run workflow). */
export async function latestForecastRun(): Promise<ForecastRun | null> {
  if (!rerunConfigured()) return null;
  try {
    const res = await github("/runs?event=workflow_dispatch&per_page=1");
    if (!res.ok) return null;
    const { workflow_runs } = (await res.json()) as { workflow_runs: ForecastRun[] };
    return workflow_runs[0] ?? null;
  } catch {
    return null;
  }
}
