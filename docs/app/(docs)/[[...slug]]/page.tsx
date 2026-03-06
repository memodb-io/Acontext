import { source, getLLMText } from '@/lib/source';
import {
  DocsBody,
  DocsPage,
  PageLastUpdate,
} from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/mdx-components';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { APIPage } from '@/components/api-page';
import type { Metadata } from 'next';

export const revalidate = false;

const baseUrl = 'https://docs.acontext.io';

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

export default async function Page(props: PageProps) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  if ('getAPIPageProps' in page.data) {
    return (
      <DocsPage toc={page.data.toc} full tableOfContent={{ style: 'clerk' }}>
        <h1 className="text-[1.75em] font-semibold">{page.data.title}</h1>
        <DocsBody>
          <APIPage {...page.data.getAPIPageProps()} />
        </DocsBody>
      </DocsPage>
    );
  }

  const data = await page.data.load();
  const MDX = data.body;

  return (
    <DocsPage
      toc={data.toc}
      full={page.data.full}
      tableOfContent={{ style: 'clerk' }}
    >
      <h1 className="text-[1.75em] font-semibold">{page.data.title}</h1>
      <p className="text-lg text-fd-muted-foreground mb-2">
        {page.data.description}
      </p>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
      {data.lastModified && <PageLastUpdate date={data.lastModified} />}
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const ogImage = {
    url: `${baseUrl}/og/${page.slugs.join('/')}`,
    width: 1200,
    height: 630,
  };

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      title: page.data.title,
      description: page.data.description ?? undefined,
      url: `${baseUrl}/${page.slugs.join('/')}`,
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: page.data.title,
      description: page.data.description ?? undefined,
      images: [ogImage],
    },
  };
}
