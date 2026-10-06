import { SITE_TEXT, type TextKey } from "@/lib/site-text";
import { createClient } from "@/lib/supabase/server";
import { TextField } from "./TextField";

export const metadata = { title: "Text" };

export default async function TextAdminPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("site_text").select("key, value");
  const edits = new Map<string, string>(data?.map((row) => [row.key, row.value]));

  // Fields grouped by page, in the order they're listed in src/lib/site-text.ts.
  const pages = new Map<string, TextKey[]>();
  for (const key of Object.keys(SITE_TEXT) as TextKey[]) {
    const page = SITE_TEXT[key].page;
    pages.set(page, [...(pages.get(page) ?? []), key]);
  }

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-normal tracking-tight">Text</h1>
        <p className="text-sm text-muted">
          The wording on the public pages. Numbers from the forecast model aren&rsquo;t here; where a sentence
          includes one, keep its {"{placeholder}"} and the page fills in the number.
        </p>
      </header>
      {[...pages].map(([page, keys]) => (
        <section key={page} className="flex flex-col gap-5">
          <h2 className="border-b border-line pb-2 text-xs uppercase tracking-[0.12em] text-muted">{page}</h2>
          {keys.map((key) => {
            const entry = SITE_TEXT[key];
            return (
              <TextField
                key={key}
                id={key}
                label={entry.label}
                kind={entry.kind}
                fills={"fills" in entry ? entry.fills : undefined}
                defaultText={entry.default}
                saved={edits.get(key) ?? null}
              />
            );
          })}
        </section>
      ))}
    </div>
  );
}
