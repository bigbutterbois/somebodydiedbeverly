import NavBar from '@/components/ui/NavBar'

interface PageWrapperProps {
  children: React.ReactNode
  variant?: 'dark' | 'light'
  /**
   * 'blog'   — max-w-blog (660px), used for listing pages
   * 'post'   — max-w-post (620px), used for individual post pages
   * 'wide'   — no max-width constraint, for gallery and full-bleed layouts
   */
  width?: 'blog' | 'post' | 'wide'
}

export default function PageWrapper({
  children,
  variant = 'light',
  width = 'blog',
}: PageWrapperProps) {
  const bg = variant === 'dark' ? 'bg-charcoal' : 'bg-warm-white'

  const maxW =
    width === 'post'
      ? 'max-w-post'
      : width === 'wide'
      ? ''
      : 'max-w-blog'

  return (
    <div className={`min-h-screen ${bg}`}>
      <NavBar />
      {/* push content below the fixed 52px nav */}
      <main
        className={`${maxW} ${maxW ? 'mx-auto px-6 sm:px-10' : 'px-6 sm:px-10'} pt-[60px] pb-[100px] w-full`}
      >
        {children}
      </main>
    </div>
  )
}
