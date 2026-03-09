import { buildGraph } from '@/lib/build-graph';
import { GraphView } from '@/components/graph-view';
import { DocsPage } from 'fumadocs-ui/layouts/docs/page';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documentation Graph',
  description:
    'Visual graph of all documentation pages and their relationships',
};

export default async function GraphPage() {
  const graph = await buildGraph();

  return (
    <DocsPage full toc={[]} tableOfContent={{ style: 'clerk' }}>
      <h1 className="text-[1.75em] font-semibold">Documentation Graph</h1>
      <p className="text-lg text-fd-muted-foreground mb-4">
        Interactive visualization of all {graph.nodes.length} documentation
        pages. Hover to preview, click to navigate.
      </p>
      <div className="w-full">
        <GraphView graph={graph} />
      </div>
    </DocsPage>
  );
}
