"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { JaegerTrace, JaegerSpan } from "@/app/api/jaeger/traces/route";
import { formatDuration, formatTimestamp } from "./utils";

interface TraceListItem {
  traceID: string;
  operationName: string;
  duration: number;
  startTime: number;
  spanCount: number;
  spans: JaegerSpan[];
  processes: Record<string, { serviceName: string }>;
}

export default function TracesPage() {
  const t = useTranslations("traces");
  const [traces, setTraces] = useState<TraceListItem[]>([]);
  const tracesRef = useRef<TraceListItem[]>([]);
  const [lookback, setLookback] = useState<string>("1h");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Update ref when traces change
  useEffect(() => {
    tracesRef.current = traces;
  }, [traces]);

  // Load traces
  const loadTraces = useCallback(async (showLoading = true, append = false) => {
    if (showLoading) {
      setIsLoading(true);
    } else if (append) {
      setIsLoadingMore(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: "50",
        service: "acontext-api",
      });

      // If appending (loading more), use explicit start/end for pagination
      if (append) {
        const currentTraces = tracesRef.current;
        if (currentTraces.length === 0) {
          // No existing traces, fall back to lookback
          params.append("lookback", lookback);
        } else {
          // Find the earliest trace (lowest startTime)
          const earliestTrace = currentTraces.reduce((earliest, current) =>
            current.startTime < earliest.startTime ? current : earliest
          );

          // Use the earliest trace's startTime as the new end (in microseconds)
          const end = earliestTrace.startTime * 1000;

          // Calculate start time based on lookback from the end
          const lookbackMatch = lookback.match(/^(\d+)([hdms])$/);
          let start = end;
          if (lookbackMatch) {
            const value = parseInt(lookbackMatch[1], 10);
            const unit = lookbackMatch[2];
            const multiplier =
              unit === "s" ? 1000 :
              unit === "m" ? 60000 :
              unit === "h" ? 3600000 :
              86400000; // days
            start = end - (value * multiplier * 1000); // Convert to microseconds
          } else {
            start = end - (3600 * 1000 * 1000); // Default to 1 hour
          }

          params.append("start", start.toString());
          params.append("end", end.toString());
        }
      } else {
        // Initial load or refresh - use lookback
        params.append("lookback", lookback);
      }

      const response = await fetch(`/api/jaeger/traces?${params.toString()}`);
      const result = await response.json();

      if (result.code === 0) {
        const traceList: TraceListItem[] = (result.data?.traces || []).map(
          (trace: JaegerTrace) => {
            const rootSpan = trace.spans.find(
              (span) => span.references.length === 0
            ) || trace.spans[0];
            // Convert processes to simpler format
            const processes = Object.fromEntries(
              Object.entries(trace.processes).map(([key, value]) => [
                key,
                { serviceName: value.serviceName },
              ])
            );
            return {
              traceID: trace.traceID,
              operationName: rootSpan.operationName,
              duration: rootSpan.duration, // Keep in microseconds
              startTime: rootSpan.startTime / 1000, // Convert to milliseconds (for timestamp)
              spanCount: trace.spans.length,
              spans: trace.spans,
              processes,
            };
          }
        );

        if (append) {
          // Append new traces to existing list
          setTraces((prev) => [...prev, ...traceList]);
        } else {
          // Replace traces
          setTraces(traceList);
        }

        // Check if there are more traces to load
        // If we got exactly the limit, there might be more
        const limit = parseInt(params.get("limit") || "50", 10);
        setHasMore(traceList.length === limit);
      } else {
        setError(result.message || "Failed to load traces");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load traces");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, [lookback]);

  // Initial load and auto refresh
  useEffect(() => {
    // Reset pagination state when lookback changes
    setHasMore(false);
    loadTraces();

    // Set up auto refresh (every 30 seconds)
    const interval = setInterval(() => {
      loadTraces(false);
    }, 30000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookback]); // Only depend on lookback, loadTraces is stable

  // Manual refresh
  const handleRefresh = () => {
    setHasMore(false);
    loadTraces(false);
  };

  // Load more traces (pagination)
  const handleLoadMore = () => {
    loadTraces(false, true);
  };

  // Get Jaeger UI URL from API
  const [jaegerUiUrl, setJaegerUiUrl] = useState<string>("http://localhost:16686");

  useEffect(() => {
    fetch("/api/jaeger/url")
      .then((res) => res.json())
      .then((data) => {
        if (data.code === 0 && data.data?.url) {
          setJaegerUiUrl(data.data.url);
        }
      })
      .catch(() => {
        // Keep default value on error
      });
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page header with title and time range selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Traces</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("tracesFound", { count: traces.length })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={lookback} onValueChange={setLookback}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15m">{t("timeRangeOptions.15m")}</SelectItem>
              <SelectItem value="1h">{t("timeRangeOptions.1h")}</SelectItem>
              <SelectItem value="6h">{t("timeRangeOptions.6h")}</SelectItem>
              <SelectItem value="24h">{t("timeRangeOptions.24h")}</SelectItem>
              <SelectItem value="7d">{t("timeRangeOptions.7d")}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
          {isLoading && (
            <span className="text-xs text-muted-foreground">{t("loading")}</span>
          )}
        </div>
      </div>

      {/* Traces list */}
      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          {error}
        </div>
      )}
      {isLoading && traces.length === 0 ? (
        <div className="text-center py-8">{t("loading")}</div>
      ) : traces.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t("noTraces")}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {traces.map((trace) => (
              <TraceRow key={trace.traceID} trace={trace} jaegerUrl={jaegerUiUrl} t={t} />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                variant="outline"
                size="sm"
              >
                {isLoadingMore ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    {t("loadingMore")}
                  </>
                ) : (
                  t("loadMore")
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TraceRow({
  trace,
  jaegerUrl,
  t
}: {
  trace: TraceListItem;
  jaegerUrl: string;
  t: ReturnType<typeof useTranslations<"traces">>
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const handleViewTrace = () => {
    window.open(`${jaegerUrl}/trace/${trace.traceID}`, "_blank");
  };

  const handleCopyTraceId = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(trace.traceID);
      toast.success(t("traceIdCopied") || "Trace ID copied to clipboard");
    } catch {
      toast.error(t("copyFailed") || "Failed to copy Trace ID");
    }
  };

  // Sort spans by start time
  const sortedSpans = [...trace.spans].sort((a, b) => a.startTime - b.startTime);
  const totalDuration = trace.duration;
  const traceStartTime = sortedSpans[0]?.startTime || 0;

  // Calculate depth for each span based on parent-child relationships
  const spanDepthMap = new Map<string, number>();
  const calculateDepth = (spanID: string, visited = new Set<string>()): number => {
    if (visited.has(spanID)) return 0; // Prevent cycles
    if (spanDepthMap.has(spanID)) return spanDepthMap.get(spanID)!;

    visited.add(spanID);
    const span = trace.spans.find((s) => s.spanID === spanID);
    if (!span || span.references.length === 0) {
      spanDepthMap.set(spanID, 0);
      return 0;
    }

    // Find parent span and calculate its depth
    const parentRef = span.references.find((ref) => ref.refType === "CHILD_OF");
    if (!parentRef) {
      spanDepthMap.set(spanID, 0);
      return 0;
    }

    const parentDepth = calculateDepth(parentRef.spanID, visited);
    const depth = parentDepth + 1;
    spanDepthMap.set(spanID, depth);
    return depth;
  };

  // Calculate depths for all spans
  trace.spans.forEach((span) => calculateDepth(span.spanID));

  // Get Tailwind color classes for span bars
  const getSpanColorClass = (processID: string) => {
    const process = trace.processes[processID];
    const serviceName = process?.serviceName || "unknown";
    // Warm and friendly colors for trace visualization (lighter tones)
    const serviceColorClasses: Record<string, string> = {
      "acontext-api": "bg-teal-400 dark:bg-teal-400", // lighter teal - gentle and calm
      "acontext-core": "bg-blue-400 dark:bg-blue-400", // lighter blue - friendly and inviting
    };
    return serviceColorClasses[serviceName] || "bg-gray-400 dark:bg-gray-400"; // default lighter gray
  };

  // Get Tailwind color for indicator bar (left side)
  const getSpanIndicatorColorClass = (processID: string) => {
    const process = trace.processes[processID];
    const serviceName = process?.serviceName || "unknown";
    const indicatorColorClasses: Record<string, string> = {
      "acontext-api": "bg-teal-400 dark:bg-teal-400",
      "acontext-core": "bg-blue-400 dark:bg-blue-400",
    };
    return indicatorColorClasses[serviceName] || "bg-gray-400 dark:bg-gray-400";
  };

  // Get HTTP method from span tags
  const getHttpMethod = (span: JaegerSpan): string | null => {
    const httpMethodTag = span.tags?.find((tag) => tag.key === "http.method");
    return httpMethodTag ? String(httpMethodTag.value).toUpperCase() : null;
  };

  // Get color class for HTTP method badge
  const getHttpMethodColor = (method: string | null): string => {
    if (!method) return "";
    const methodUpper = method.toUpperCase();
    const colorMap: Record<string, string> = {
      GET: "!bg-green-500 !text-white !border-green-500",
      POST: "!bg-blue-500 !text-white !border-blue-500",
      PUT: "!bg-orange-500 !text-white !border-orange-500",
      PATCH: "!bg-purple-500 !text-white !border-purple-500",
      DELETE: "!bg-red-500 !text-white !border-red-500",
      HEAD: "!bg-gray-500 !text-white !border-gray-500",
      OPTIONS: "!bg-gray-500 !text-white !border-gray-500",
    };
    return colorMap[methodUpper] || "!bg-gray-500 !text-white !border-gray-500";
  };

  // Find root span for main progress bar
  const rootSpan = sortedSpans.find((span) => span.references.length === 0) || sortedSpans[0];
  const rootHttpMethod = rootSpan ? getHttpMethod(rootSpan) : null;

  // Unified span row component
  const SpanRow = ({
    span,
    indentLevel = 0,
    showExpandButton = false,
    onExpandToggle,
    isExpanded: expanded,
    showHttpMethod = true,
  }: {
    span: JaegerSpan;
    indentLevel?: number;
    showExpandButton?: boolean;
    onExpandToggle?: () => void;
    isExpanded?: boolean;
    showHttpMethod?: boolean;
  }) => {
    const spanStart = span.startTime - traceStartTime;
    const spanStartPercent = totalDuration > 0 ? (spanStart / totalDuration) * 100 : 0;
    const spanWidthPercent = totalDuration > 0 ? (span.duration / totalDuration) * 100 : 0;
    const process = trace.processes[span.processID];
    const spanColorClass = getSpanColorClass(span.processID);
    const spanIndicatorColorClass = getSpanIndicatorColorClass(span.processID);

    return (
      <div
        className="flex items-center border-b last:border-b-0 hover:bg-muted/50 transition-colors overflow-hidden"
        style={{ height: "29px" }}
      >
        {/* Left: Service name and operation name */}
        <div className="flex items-center flex-shrink-0 px-2" style={{ width: "35%", minWidth: "200px" }}>
          <div className="flex items-center w-full">
            {/* Expand/collapse button - fixed width to maintain alignment */}
            <div className="w-5 flex-shrink-0 flex items-center justify-center">
              {showExpandButton && (
                <button
                  onClick={onExpandToggle}
                  className="p-0.5 hover:bg-muted rounded"
                >
                  {expanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
            {/* Indent guides */}
            <div className="flex items-center h-full">
              {Array.from({ length: indentLevel }).map((_, i) => (
                <div
                  key={i}
                  className="w-4 h-full border-l border-border flex-shrink-0"
                />
              ))}
            </div>
            <div
              className={`h-4 w-0.5 rounded-sm flex-shrink-0 mx-1 ${spanIndicatorColorClass}`}
            />
            <div className="flex-1 min-w-0 truncate text-xs flex items-center gap-1.5">
              <span className="font-medium">{process?.serviceName || "unknown"}</span>
              {showHttpMethod && getHttpMethod(span) && (
                <Badge
                  variant="default"
                  className={`font-mono text-[10px] px-1.5 py-0 h-4 ${getHttpMethodColor(getHttpMethod(span))}`}
                >
                  {getHttpMethod(span)}
                </Badge>
              )}
              <span className="text-muted-foreground">{span.operationName}</span>
            </div>
          </div>
        </div>

        {/* Right: Timeline with span bar */}
        <div className="flex-1 relative h-full overflow-hidden" style={{ minWidth: "300px" }}>
          {/* Time ticks */}
          <div className="absolute inset-0 flex">
            {[0, 25, 50, 75, 100].map((tick) => (
              <div
                key={tick}
                className="absolute top-0 bottom-0 w-px bg-border"
                style={{ left: `${tick}%` }}
              />
            ))}
          </div>

          {/* Span bar */}
          <div
            className={`absolute h-full hover:opacity-100 transition-opacity cursor-pointer ${spanColorClass}`}
            style={{
              left: `${spanStartPercent}%`,
              width: `${spanWidthPercent}%`,
            }}
            title={`${span.operationName} (${process?.serviceName || "unknown"}): ${formatDuration(span.duration)}`}
          >
            {/* Show duration label if bar is wide enough */}
            {spanWidthPercent > 8 && (
              <div className="absolute inset-0 flex items-center px-1.5 text-[10px] text-foreground font-semibold truncate pointer-events-none">
                {formatDuration(span.duration)}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="border rounded-lg transition-colors overflow-hidden">
      {/* Trace header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              {rootHttpMethod && (
                <Badge
                  variant="default"
                  className={`font-mono text-xs ${getHttpMethodColor(rootHttpMethod)}`}
                >
                  {rootHttpMethod}
                </Badge>
              )}
              <span className="text-base font-semibold truncate">{trace.operationName}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{formatTimestamp(trace.startTime)}</span>
              <span>{formatDuration(trace.duration)}</span>
              <span>{t("spanCount", { count: trace.spanCount })}</span>
            </div>
          </div>
          <div className="flex items-center gap-0 flex-shrink-0 border rounded-md overflow-hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyTraceId}
              className="rounded-r-none border-r border-border font-mono text-xs hover:bg-accent"
            >
              {trace.traceID}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleViewTrace();
              }}
              className="rounded-l-none px-2 hover:bg-accent"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main progress bar row */}
      {rootSpan && (
        <div className="border-t overflow-hidden">
          <SpanRow
            span={rootSpan}
            indentLevel={0}
            showExpandButton={true}
            onExpandToggle={() => setIsExpanded(!isExpanded)}
            isExpanded={isExpanded}
            showHttpMethod={false}
          />
        </div>
      )}

      {/* Expanded spans list */}
      {isExpanded && (
        <div className="border-t overflow-hidden">
          {sortedSpans
            .filter((span) => span.spanID !== rootSpan?.spanID)
            .map((span) => {
              const indentLevel = spanDepthMap.get(span.spanID) || 0;
              return (
                <SpanRow
                  key={span.spanID}
                  span={span}
                  indentLevel={indentLevel}
                />
              );
            })}
        </div>
      )}
    </div>
  );
}

