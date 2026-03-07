import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import Providers from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'somebody died beverly',
  description: 'somebody died beverly',
  openGraph: {
    title: 'somebody died beverly',
    url: 'https://somebodydiedbeverly.com',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
