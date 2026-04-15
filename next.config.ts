import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/index',
        destination: '/',
        permanent: true
      }
    ]
  }
}

export default nextConfig
