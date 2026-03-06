import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';

const baseUrl = 'https://docs.acontext.io';

export const revalidate = false;

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: baseUrl,
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...source.getPages().map((page) => ({
      url: `${baseUrl}/${page.slugs.join('/')}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
