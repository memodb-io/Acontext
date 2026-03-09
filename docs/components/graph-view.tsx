'use client';

import {
  lazy,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  ForceGraphMethods,
  ForceGraphProps,
  LinkObject,
  NodeObject,
} from 'react-force-graph-2d';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
} from 'd3-force';
import { useRouter } from 'next/navigation';

export interface GraphNodeType {
  id?: string | number;
  text: string;
  description?: string;
  neighbors?: string[];
  url: string;
}

export type Node = NodeObject<GraphNodeType>;
export type Link = LinkObject<GraphNodeType>;

export interface Graph {
  links: { source: string; target: string }[];
  nodes: GraphNodeType[];
}

export interface GraphViewProps {
  graph: Graph;
}

const ForceGraph2D = lazy(
  () => import('react-force-graph-2d'),
) as typeof import('react-force-graph-2d').default;

export function GraphView(props: GraphViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [mount, setMount] = useState(false);
  useEffect(() => {
    setMount(true);
  }, []);

  return (
    <div
      ref={ref}
      className="relative border min-h-[300px] h-[min(600px,calc(100dvh-14rem))] w-full [&_canvas]:size-full rounded-xl overflow-hidden bg-fd-background"
    >
      {mount && <ClientOnly {...props} containerRef={ref} />}
    </div>
  );
}

function ClientOnly({
  containerRef,
  graph,
}: GraphViewProps & { containerRef: RefObject<HTMLDivElement | null> }) {
  const graphRef = useRef<ForceGraphMethods<Node, Link> | undefined>(undefined);
  const hoveredRef = useRef<Node | null>(null);
  const engineStoppedRef = useRef(false);
  const router = useRouter();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? {};
      if (width && height) setDimensions({ width, height });
    });
    ro.observe(el);
    const { width, height } = el.getBoundingClientRect();
    if (width && height) setDimensions({ width, height });
    return () => ro.disconnect();
  }, [containerRef]);

  const zoomToFit = useCallback(() => {
    const fg = graphRef.current;
    if (!fg || !dimensions.width || !dimensions.height) return;
    fg.zoomToFit(400, 50);
  }, [dimensions.width, dimensions.height]);

  useEffect(() => {
    if (engineStoppedRef.current && dimensions.width && dimensions.height) {
      const t = setTimeout(zoomToFit, 50);
      return () => clearTimeout(t);
    }
  }, [dimensions.width, dimensions.height, zoomToFit]);

  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    content: string;
  } | null>(null);

  const handleNodeHover = (node: Node | null) => {
    const fg = graphRef.current;
    if (!fg) return;
    hoveredRef.current = node;

    if (node) {
      const coords = fg.graph2ScreenCoords(node.x!, node.y!);
      const canvas = containerRef.current?.querySelector('canvas');
      const containerRect = containerRef.current?.getBoundingClientRect();
      const canvasRect = canvas?.getBoundingClientRect();
      const offsetX = (canvasRect?.left ?? 0) - (containerRect?.left ?? 0);
      const offsetY = (canvasRect?.top ?? 0) - (containerRect?.top ?? 0);
      setTooltip({
        x: coords.x + offsetX + 4,
        y: coords.y + offsetY + 4,
        content: node.description ?? node.text,
      });
    } else {
      setTooltip(null);
    }
  };

  const MAX_TEXT_WIDTH = 140;
  const FONT_SIZE = 11;
  const PADDING_X = 8;
  const PADDING_Y = 4;
  const PILL_RADIUS = 10;

  const nodeCanvasObject: ForceGraphProps['nodeCanvasObject'] = (
    node,
    ctx,
    globalScale,
  ) => {
    const container = containerRef.current;
    if (!container) return;
    const style = getComputedStyle(container);
    ctx.font = `${FONT_SIZE}px sans-serif`;

    const text =
      ctx.measureText(node.text).width > MAX_TEXT_WIDTH
        ? node.text.slice(0, Math.floor(MAX_TEXT_WIDTH / (FONT_SIZE * 0.6))) +
          '…'
        : node.text;
    const textWidth = ctx.measureText(text).width;
    const w = textWidth + PADDING_X * 2;
    const h = FONT_SIZE + PADDING_Y * 2;
    const x = node.x! - w / 2;
    const y = node.y! - h / 2;

    const hoverNode = hoveredRef.current;
    const isActive =
      hoverNode?.id === node.id ||
      hoverNode?.neighbors?.includes(node.id as string);

    ctx.beginPath();
    ctx.roundRect(x, y, w, h, PILL_RADIUS);
    ctx.fillStyle = isActive
      ? style.getPropertyValue('--color-fd-primary') || '#38a169'
      : style.getPropertyValue('--color-fd-card') || '#f4f4f5';
    ctx.fill();
    ctx.strokeStyle =
      style.getPropertyValue('--color-fd-border') || 'rgba(150,150,150,0.3)';
    ctx.lineWidth = 1 / globalScale;
    ctx.stroke();

    ctx.fillStyle =
      isActive
        ? style.getPropertyValue('--color-fd-primary-foreground') || '#fff'
        : style.getPropertyValue('--color-fd-foreground') || '#18181b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, node.x!, node.y!);
  };

  const nodePointerAreaPaint: ForceGraphProps['nodePointerAreaPaint'] = (
    node,
    paintColor,
    ctx,
  ) => {
    ctx.font = `${FONT_SIZE}px sans-serif`;
    const text =
      ctx.measureText(node.text).width > MAX_TEXT_WIDTH
        ? node.text.slice(0, Math.floor(MAX_TEXT_WIDTH / (FONT_SIZE * 0.6))) +
          '…'
        : node.text;
    const textWidth = ctx.measureText(text).width;
    const w = textWidth + PADDING_X * 2;
    const h = FONT_SIZE + PADDING_Y * 2;
    const x = node.x! - w / 2;
    const y = node.y! - h / 2;

    ctx.fillStyle = paintColor;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, PILL_RADIUS);
    ctx.fill();
  };

  const getNodeId = (obj: string | Node) =>
    typeof obj === 'object' ? obj.id : obj;

  const linkColor = (link: Link) => {
    const container = containerRef.current;
    if (!container) return '#999';
    const style = getComputedStyle(container);
    const hoverNode = hoveredRef.current;

    if (hoverNode) {
      const sourceId = getNodeId(link.source as string | Node);
      const targetId = getNodeId(link.target as string | Node);
      if (
        hoverNode.id === sourceId ||
        hoverNode.id === targetId
      ) {
        return style.getPropertyValue('--color-fd-primary') || '#38a169';
      }
    }

    return (
      style.getPropertyValue('--color-fd-border') || 'rgba(150,150,150,0.3)'
    );
  };

  const enrichedNodes = useMemo(() => {
    const { nodes, links } = structuredClone(graph);
    for (const node of nodes) {
      node.neighbors = links.flatMap((link) => {
        if (link.source === node.id) return link.target as string;
        if (link.target === node.id) return link.source as string;
        return [];
      });
    }

    return { nodes, links };
  }, [graph]);

  return (
    <>
      <ForceGraph2D<GraphNodeType>
        ref={{
          get current() {
            return graphRef.current;
          },
          set current(fg) {
            graphRef.current = fg;
            if (fg) {
              fg.d3Force('link', forceLink().distance(150));
              fg.d3Force('charge', forceManyBody().strength(-30));
              fg.d3Force('collision', forceCollide(80));
              fg.d3Force('center', forceCenter(0, 0));
            }
          },
        }}
        graphData={enrichedNodes}
        nodeId="id"
        linkSource="source"
        linkTarget="target"
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={nodePointerAreaPaint}
        linkColor={linkColor}
        onNodeHover={handleNodeHover}
        onNodeClick={(node) => {
          router.push(node.url);
        }}
        width={dimensions.width || undefined}
        height={dimensions.height || undefined}
        cooldownTime={500}
        onEngineStop={() => {
          engineStoppedRef.current = true;
          zoomToFit();
        }}
        linkWidth={1.5}
        enableNodeDrag
        enableZoomInteraction
      />
      {tooltip && (
        <div
          className="absolute bg-fd-popover text-fd-popover-foreground size-fit p-2 border rounded-xl shadow-lg text-sm max-w-xs pointer-events-none"
          style={{ top: tooltip.y, left: tooltip.x }}
        >
          {tooltip.content}
        </div>
      )}
    </>
  );
}
