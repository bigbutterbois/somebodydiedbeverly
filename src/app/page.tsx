export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <p className="mb-16 text-sm tracking-widest text-[#1a1a1a]">
        somebody died beverly
      </p>
      <nav className="flex flex-col items-center gap-5">
        {["blog", "art", "tools"].map((link) => (
          <a
            key={link}
            href={`/${link}`}
            className="text-sm text-[#1a1a1a] opacity-60 transition-opacity duration-200 hover:opacity-100"
          >
            {link}
          </a>
        ))}
      </nav>
    </main>
  );
}
