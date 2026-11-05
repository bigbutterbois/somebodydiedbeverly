import { Suspense } from "react";
import { demoPosts } from "@/lib/election/demo";
import { getElectionPosts } from "@/lib/election/posts";
import { getCountRows } from "@/lib/election/server";
import { getSiteText } from "@/lib/supabase/site-text";
import { ElectionTabs } from "./ElectionTabs";
import { LiveBlog } from "./LiveBlog";

function stamp(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
  return `${day}, ${time} ET`;
}

/**
 * Top of every election tab: the title, the tab switch, the live blog (Senate Projections only), and
 * when the results last changed (the newest count from any state).
 */
export async function ElectionHeader({
  demo,
  showUpdated = true,
  blog = false,
}: {
  demo: number;
  showUpdated?: boolean;
  /** The live blog sits under the tabs, on the Senate Projections tab only. */
  blog?: boolean;
}) {
  const [t, posts, rows] = await Promise.all([
    getSiteText(),
    !blog ? [] : demo ? demoPosts() : getElectionPosts(),
    demo || !showUpdated ? [] : getCountRows().catch(() => []),
  ]);
  const updated = rows.reduce((at, r) => (r.changed_at && r.changed_at > at ? r.changed_at : at), "");
  return (
    <header className="flex flex-col gap-4">
      <h1 className="text-4xl font-light tracking-tight">{t("election.title")}</h1>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Suspense>
          <ElectionTabs />
        </Suspense>
        {updated && <p className="text-sm text-muted tabular-nums">Last updated {stamp(updated)}</p>}
      </div>
      {demo > 0 && <p className="text-sm text-danger">Demo: these results are made up, about {demo}% counted.</p>}
      {blog && <LiveBlog initial={posts} />}
    </header>
  );
}
