import type { ReactNode } from "react";

// Renders text written in the admin text editor's "notes" format: a blank line
// starts a new paragraph, lines starting with "- " are bullets, and
// **double asterisks** make bold. Builds elements rather than HTML, so the
// text can't inject markup.
export function Notes({ text, className }: { text: string; className?: string }) {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) => block.split("\n").map((line) => line.trim()).filter(Boolean))
    .filter((lines) => lines.length > 0);
  if (blocks.length === 0) return null;

  return (
    <div className={className}>
      {blocks.map((lines, i) =>
        lines.every((line) => line.startsWith("- ")) ? (
          <ul key={i} className="flex list-disc flex-col gap-1 pl-4">
            {lines.map((line, j) => (
              <li key={j}>{withBold(line.slice(2))}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{withBold(lines.join(" "))}</p>
        ),
      )}
    </div>
  );
}

function withBold(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 ? (
      <strong key={i} className="font-medium text-foreground">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}
