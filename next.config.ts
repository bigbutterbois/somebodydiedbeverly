import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // old routes redirect permanently to new canonical URLs
      {
        source: '/art',
        destination: '/gallery',
        permanent: true,
      },
      {
        source: '/diplomat',
        destination: '/diplomat-plates',
        permanent: true,
      },
      {
        source: '/diplomat/:code',
        destination: '/diplomat-plates/:code',
        permanent: true,
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig
