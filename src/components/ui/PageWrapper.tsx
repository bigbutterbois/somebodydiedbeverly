import NavBar from '@/components/ui/NavBar'

interface PageWrapperProps {
  children: React.ReactNode
  wide?: boolean   // use max-w-page instead of max-w-text (for art, etc.)
}

export default function PageWrapper({ children, wide = false }: PageWrapperProps) {
  return (
    <>
      <NavBar />
      <main
        className={`
          min-h-screen
          pt-24 pb-24
          px-6
          mx-auto
          ${wide ? 'max-w-page' : 'max-w-text'}
        `}
      >
        {children}
      </main>
    </>
  )
}
