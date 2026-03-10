"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import matter from "gray-matter";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";

interface MarkdownViewerProps {
  value: string;
  height?: string;
  className?: string;
  maxHeight?: string;
}

function FrontmatterTable({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;

  return (
    <div className="mb-4 border rounded-md overflow-hidden">
      <Table className="m-0!">
        <TableBody>
          {entries.map(([key, value]) => (
            <TableRow key={key} className="hover:bg-muted/50">
              <TableCell className="font-medium text-muted-foreground w-[120px] py-2 px-3 border-r bg-muted/30">
                {key}
              </TableCell>
              <TableCell className="py-2 px-3 whitespace-pre-wrap">
                {String(value)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function MarkdownViewer({
  value,
  height,
  className,
  maxHeight = "400px",
}: MarkdownViewerProps) {
  const { frontmatter, content } = useMemo(() => {
    try {
      const parsed = matter(value);
      return {
        frontmatter: parsed.data,
        content: parsed.content,
      };
    } catch {
      return {
        frontmatter: {},
        content: value,
      };
    }
  }, [value]);

  const hasFrontmatter = Object.keys(frontmatter).length > 0;

  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none p-6 bg-muted rounded-md overflow-auto",
        className
      )}
      style={{
        height: height,
        maxHeight: height ? undefined : maxHeight,
      }}
    >
      {hasFrontmatter && <FrontmatterTable data={frontmatter} />}
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
