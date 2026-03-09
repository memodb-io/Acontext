import { createMDX } from 'fumadocs-mdx/next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/learn/skill-memory',
        destination: '/learn/quick',
        permanent: true,
      },
    ];
  },
};

const withMDX = createMDX();

export default withMDX(config);
