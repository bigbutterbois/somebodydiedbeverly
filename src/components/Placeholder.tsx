// Stand-in for a module that hasn't been built yet.
export function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl font-normal tracking-tight">{title}</h1>
      <p className="text-muted">{note}</p>
    </div>
  );
}
