import { EmptyPreview, HomeSection } from "@/components/HomeSection";

// Homepage: a preview of the latest from every public module. Each module
// replaces its empty state with real items once it has data.
export default function Home() {
  return (
    <div className="flex flex-col gap-14 py-6">
      <header className="flex flex-col gap-3">
        <h1 className="max-w-2xl text-4xl font-light tracking-tight text-balance sm:text-5xl">
          Paintings, notes, and the occasional election model.
        </h1>
        <p className="text-muted">A small site for friends and family.</p>
      </header>

      <HomeSection title="Recent work" href="/gallery">
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="aspect-square bg-surface" />
          ))}
        </div>
        <EmptyPreview>New pieces will show up here.</EmptyPreview>
      </HomeSection>

      <div className="grid gap-14 md:grid-cols-2">
        <HomeSection title="Latest posts" href="/blog">
          <EmptyPreview>No posts yet.</EmptyPreview>
        </HomeSection>

        <HomeSection title="Forecast" href="/forecast">
          <EmptyPreview>The election model is still being built.</EmptyPreview>
        </HomeSection>
      </div>
    </div>
  );
}
