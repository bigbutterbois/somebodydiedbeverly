import Link from 'next/link'

export default function HomePage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '0 24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>
        <p style={{ fontSize: '14px', color: '#1a1a1a', margin: 0 }}>
          somebody died beverly
        </p>
        <nav style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <Link href="/blog" style={{ fontSize: '14px', color: '#6b6b6b', textDecoration: 'none' }}>blog</Link>
          <Link href="/art" style={{ fontSize: '14px', color: '#6b6b6b', textDecoration: 'none' }}>art</Link>
          <Link href="/diplomat" style={{ fontSize: '14px', color: '#6b6b6b', textDecoration: 'none' }}>diplomat plate tracker</Link>
        </nav>
      </div>
      <Link href="/admin" style={{ position: 'absolute', bottom: '32px', left: '50%', transform: 'translateX(-50%)', fontSize: '18px', color: '#d4d4d4', textDecoration: 'none', lineHeight: 1 }}>·</Link>
    </main>
  )
}
