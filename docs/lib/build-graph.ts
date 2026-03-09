import { source } from '@/lib/source';
import { PathUtils } from 'fumadocs-core/source';
import type { Graph } from '@/components/graph-view';

export async function buildGraph(): Promise<Graph> {
  const graph: Graph = { links: [], nodes: [] };

  await Promise.all(
    source.getPages().map(async (page) => {
      if (page.data.type === 'openapi') return;

      graph.nodes.push({
        id: page.url,
        url: page.url,
        text: page.data.title,
        description: page.data.description,
      });

      const data = await page.data.load();
      const refs = (data as { extractedReferences?: { href: string }[] })
        .extractedReferences ?? [];

      const dir = PathUtils.dirname(page.path);

      for (const ref of refs) {
        const refPage = source.getPageByHref(ref.href, { dir });
        if (!refPage) continue;

        const targetUrl = refPage.page.url;
        if (targetUrl === page.url) continue; // skip self-links

        graph.links.push({
          source: page.url,
          target: targetUrl,
        });
      }
    }),
  );

  // Deduplicate links: treat A→B and B→A as the same undirected edge.
  // If directed rendering is added later, this logic must be revisited.
  const seen = new Set<string>();
  graph.links = graph.links.filter((link) => {
    const key =
      link.source < link.target
        ? `${link.source}→${link.target}`
        : `${link.target}→${link.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return graph;
}
