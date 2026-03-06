import { source, getLLMText } from '@/lib/source';

export const revalidate = false;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug?: string[] }> },
) {
  const { slug } = await params;

  if (!slug || slug.length === 0) {
    const pages = source.getPages();
    const texts = await Promise.all(pages.map(getLLMText));
    return new Response(texts.join('\n\n---\n\n'), {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  }

  const page = source.getPage(slug);
  if (!page) {
    return new Response('Not found', { status: 404 });
  }

  const text = await getLLMText(page);
  return new Response(text, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
