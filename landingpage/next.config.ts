import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Packages with Cloudflare Workers (workerd) specific code
  // Read more: https://opennext.js.org/cloudflare/howtos/workerd
  serverExternalPackages: ['jose', 'pg-cloudflare'],
  async redirects() {
    return [
      {
        source: '/product/context-storage',
        destination: '/product/short-term-memory',
        permanent: true,
      },
      {
        source: '/product/context-observability',
        destination: '/product/mid-term-state',
        permanent: true,
      },
      {
        source: '/product/skill-memory',
        destination: '/product/long-term-skill',
        permanent: true,
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https' as const,
        hostname: 'assets.memodb.io',
      },
      {
        protocol: 'https' as const,
        hostname: 'assets.acontext.io',
      },
    ],
  },
  webpack: (webpackConfig: any) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
