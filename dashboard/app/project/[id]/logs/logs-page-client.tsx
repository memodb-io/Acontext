"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { RefreshCw, Circle, Info, Eye, EyeOff, Radio } from "lucide-react";
import { useTopNavStore } from "@/stores/top-nav";
import { Organization, Project } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { BarChart, Bar } from "recharts";
import { formatDuration, formatTimestamp } from "./utils";
import { type Trace, type TraceSpan } from "@/lib/acontext/server";
import { fetchTraces } from "./actions";
import { SpansTimeline } from "@/components/spans-timeline";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";

interface LogsPageClientProps {
  project: Project;
  currentOrganization: Organization;
  allOrganizations: Organization[];
  projects: Project[];
}

interface LogEntry {
  trace: Trace;
  rootSpan: TraceSpan;
  time: number;
  status: number | null;
  method: string | null;
  rootDuration: number; // Root span duration
  totalDuration: number; // Total trace duration (from earliest to latest span)
  spanCount: number;
  path: string;
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];
const STATUS_CODES = [200, 201, 204, 400, 401, 403, 404, 500, 502, 503];
const TRACES_LIMIT = 20;

/**
 * Format timestamp (milliseconds) to human-readable date/time string for trace detail
 */
function formatTraceTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

/**
 * Get HTTP method from span tags
 */
function getHttpMethodFromSpan(span: TraceSpan): string | null {
  const httpMethodTag = span.tags?.find(
    (tag) => tag.key === "http.request.method"
  );
  return httpMethodTag ? String(httpMethodTag.value).toUpperCase() : null;
}

/**
 * Get HTTP status code from span tags
 */
function getHttpStatusFromSpan(span: TraceSpan): number | null {
  const statusTag = span.tags?.find(
    (tag) => tag.key === "http.response.status_code"
  );
  return statusTag ? Number(statusTag.value) : null;
}

/**
 * Get HTTP route/path from span tags
 */
function getHttpRouteFromSpan(span: TraceSpan): string | null {
  const routeTag = span.tags?.find((tag) => tag.key === "http.route");
  return routeTag ? String(routeTag.value) : null;
}

/**
 * Get color class for HTTP method badge
 */
function getMethodBadgeColor(method: string | null): string {
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
}

/**
 * Get color class for HTTP status badge
 */
function getStatusBadgeColor(status: number | null): string {
  if (!status) return "";
  if (status >= 200 && status < 300) {
    return "!bg-green-500 !text-white !border-green-500";
  } else if (status >= 400 && status < 500) {
    return "!bg-orange-500 !text-white !border-orange-500";
  } else if (status >= 500) {
    return "!bg-red-500 !text-white !border-red-500";
  }
  return "!bg-gray-500 !text-white !border-gray-500";
}

/**
 * Trace Detail Content Component
 */
function TraceDetailContent({ trace }: { trace: Trace }) {
  // Sort spans by start time
  const sortedSpans = [...trace.spans].sort(
    (a, b) => a.startTime - b.startTime
  );
  const traceStartTime = sortedSpans[0]?.startTime || 0;
  // Calculate total duration from earliest start to latest end
  const traceEndTime = sortedSpans.reduce((max, span) => {
    const spanEndTime = span.startTime + span.duration;
    return Math.max(max, spanEndTime);
  }, traceStartTime);
  const totalDuration = traceEndTime - traceStartTime;

  // Find root span
  const rootSpan =
    sortedSpans.find((span) => span.references.length === 0) || sortedSpans[0];
  const rootHttpMethod = rootSpan ? getHttpMethodFromSpan(rootSpan) : null;
  const rootHttpStatus = rootSpan ? getHttpStatusFromSpan(rootSpan) : null;
  const rootHttpRoute = rootSpan ? getHttpRouteFromSpan(rootSpan) : null;
  const rootDuration = rootSpan?.duration || 0;

  return (
    <div className="space-y-6 overflow-y-auto px-4">
      {/* Upper Section - Request Info */}
      <div className="space-y-4 border-b pb-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Method</div>
            {rootHttpMethod ? (
              <Badge
                variant="default"
                className={`font-mono ${getMethodBadgeColor(rootHttpMethod)}`}
              >
                {rootHttpMethod}
              </Badge>
            ) : (
              <span className="text-sm">-</span>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Status</div>
            {rootHttpStatus ? (
              <Badge
                variant="default"
                className={`font-mono ${getStatusBadgeColor(rootHttpStatus)}`}
              >
                {rootHttpStatus}
              </Badge>
            ) : (
              <span className="text-sm">-</span>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Path</div>
            <div className="text-sm font-mono truncate">
              {rootHttpRoute || rootSpan?.operationName || "-"}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Timestamp</div>
            <div className="text-sm">
              {formatTraceTimestamp(traceStartTime / 1000)}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Duration</div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-mono">
                {formatDuration(rootDuration)}
              </span>
              {totalDuration !== rootDuration && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1">
                      <div className="font-medium">Total Duration</div>
                      <div className="text-xs font-mono">
                        {formatDuration(totalDuration)}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Spans</div>
            <div className="text-sm">{trace.spans.length}</div>
          </div>
        </div>
      </div>

      {/* Lower Section - Spans Timeline */}
      <SpansTimeline trace={trace} />
    </div>
  );
}

export function LogsPageClient({
  project,
  currentOrganization,
  allOrganizations,
  projects,
}: LogsPageClientProps) {
  const { initialize, setHasSidebar } = useTopNavStore();
  const [traces, setTraces] = useState<Trace[]>([]);
  const tracesRef = useRef<Trace[]>([]);
  const [lookback, setLookback] = useState<string>("1h");
  const [isLive, setIsLive] = useState(false);
  const [liveStartTime, setLiveStartTime] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<number>(30);
  const [selectedStatusCodes, setSelectedStatusCodes] = useState<number[]>([]);
  const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [showChart, setShowChart] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    initialize({
      title: "",
      organization: currentOrganization,
      project: project,
      organizations: allOrganizations,
      projects: projects,
      hasSidebar: true,
    });

    return () => {
      setHasSidebar(false);
    };
  }, [
    project,
    currentOrganization,
    allOrganizations,
    projects,
    initialize,
    setHasSidebar,
  ]);

  useEffect(() => {
    tracesRef.current = traces;
  }, [traces]);

  // Extract log entries from traces
  const logEntries = useMemo<LogEntry[]>(() => {
    return traces
      .map((trace) => {
        const sortedSpans = [...trace.spans].sort(
          (a, b) => a.startTime - b.startTime
        );
        const rootSpan =
          sortedSpans.find((span) => span.references.length === 0) ||
          sortedSpans[0];

        if (!rootSpan) return null;

        const getHttpMethod = (span: TraceSpan): string | null => {
          const httpMethodTag = span.tags?.find((tag) => tag.key === "http.request.method");
          return httpMethodTag ? String(httpMethodTag.value).toUpperCase() : null;
        };

        const getHttpStatus = (span: TraceSpan): number | null => {
          const statusTag = span.tags?.find(
            (tag) => tag.key === "http.response.status_code"
          );
          return statusTag ? Number(statusTag.value) : null;
        };

        const getHttpRoute = (span: TraceSpan): string | null => {
          const routeTag = span.tags?.find((tag) => tag.key === "http.route");
          return routeTag ? String(routeTag.value) : null;
        };

        const method = getHttpMethod(rootSpan);
        const status = getHttpStatus(rootSpan);
        const route = getHttpRoute(rootSpan);
        const path = route || rootSpan.operationName || "";

        const traceStartTime = sortedSpans[0]?.startTime || 0;
        const traceEndTime = sortedSpans.reduce((max, span) => {
          const spanEndTime = span.startTime + span.duration;
          return Math.max(max, spanEndTime);
        }, traceStartTime);
        const totalDuration = traceEndTime - traceStartTime;
        const rootDuration = rootSpan.duration;

        return {
          trace,
          rootSpan,
          time: traceStartTime,
          status,
          method,
          rootDuration,
          totalDuration,
          spanCount: trace.spans.length,
          path,
        };
      })
      .filter((entry): entry is LogEntry => entry !== null);
  }, [traces]);

  // Aggregate data for distribution chart (stacked by method)
  const chartData = useMemo(() => {
    if (logEntries.length === 0) return [];

    const timeRange = isLive && liveStartTime
      ? Date.now() * 1000 - liveStartTime // microseconds
      : (() => {
          const match = lookback.match(/^(\d+)([hdms])$/);
          if (!match) return 3600 * 1000 * 1000; // default 1 hour
          const value = parseInt(match[1], 10);
          const unit = match[2];
          const multiplier =
            unit === "s" ? 1000 : unit === "m" ? 60000 : unit === "h" ? 3600000 : 86400000;
          return value * multiplier * 1000;
        })();

    const now = Date.now() * 1000; // microseconds
    const startTime = now - timeRange;
    const bucketCount = 20;
    const bucketSize = timeRange / bucketCount;

    // Initialize buckets with all methods set to 0
    const buckets: Array<{
      time: string;
      timestamp: number; // For tooltip display
      [key: string]: string | number; // Dynamic method keys
    }> = Array.from({ length: bucketCount }, (_, i) => {
      const bucketTime = startTime + i * bucketSize;
      const bucket: { time: string; timestamp: number; [key: string]: string | number } = {
        time: new Date(bucketTime / 1000).toLocaleTimeString(),
        timestamp: bucketTime / 1000,
      };
      // Initialize all methods to 0
      HTTP_METHODS.forEach((method) => {
        bucket[method] = 0;
      });
      return bucket;
    });

    // Aggregate entries by bucket and method
    logEntries.forEach((entry) => {
      const bucketIndex = Math.min(
        Math.floor((entry.time - startTime) / bucketSize),
        bucketCount - 1
      );
      if (bucketIndex >= 0 && entry.method) {
        const method = entry.method.toUpperCase();
        if (HTTP_METHODS.includes(method)) {
          buckets[bucketIndex][method] = (buckets[bucketIndex][method] as number || 0) + 1;
        }
      }
    });

    return buckets;
  }, [logEntries, lookback, isLive, liveStartTime]);

  // Method colors for chart
  const methodColors: Record<string, string> = {
    GET: "#10b981", // green
    POST: "#3b82f6", // blue
    PUT: "#f59e0b", // orange
    PATCH: "#a855f7", // purple
    DELETE: "#ef4444", // red
    HEAD: "#6b7280", // gray
    OPTIONS: "#6b7280", // gray
  };

  // Build tags JSON string for filtering
  const buildTagsString = useCallback((): string | undefined => {
    const tags: Record<string, string> = {};

    if (selectedStatusCodes.length > 0) {
      // For multiple status codes, we need to handle OR logic
      // Jaeger supports multiple values with OR, but for simplicity, we'll use the first one
      // or we could send multiple tag queries
      tags["http.response.status_code"] = selectedStatusCodes[0].toString();
    }

    if (selectedMethods.length > 0) {
      tags["http.request.method"] = selectedMethods[0].toUpperCase();
    }

    if (Object.keys(tags).length === 0) {
      return undefined;
    }

    return JSON.stringify(tags);
  }, [selectedStatusCodes, selectedMethods]);

  // Calculate start and end times
  const calculateTimeRange = useCallback((): { start: number; end: number } => {
    const now = Date.now() * 1000; // microseconds

    if (isLive && liveStartTime !== null) {
      // Live mode: from liveStartTime to now
      return {
        start: liveStartTime,
        end: now,
      };
    }

    // Normal mode: calculate from lookback
    const lookbackMatch = lookback.match(/^(\d+)([hdms])$/);
    let start = now;
    if (lookbackMatch) {
      const value = parseInt(lookbackMatch[1], 10);
      const unit = lookbackMatch[2];
      const multiplier =
        unit === "s"
          ? 1000
          : unit === "m"
          ? 60000
          : unit === "h"
          ? 3600000
          : 86400000; // days
      start = now - value * multiplier * 1000; // Convert to microseconds
    } else {
      // Default to 1 hour
      start = now - 3600 * 1000 * 1000;
    }

    return { start, end: now };
  }, [isLive, liveStartTime, lookback]);

  // Load traces
  const loadTraces = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      try {
        const { start, end } = calculateTimeRange();
        const tags = buildTagsString();

        const result = await fetchTraces(
          project.id,
          start,
          end,
          TRACES_LIMIT,
          tags
        );

        const currentTraces = tracesRef.current;
        const hasPaginated = currentTraces.length > TRACES_LIMIT;

        if (hasPaginated) {
          // 翻页后刷新：merge 新数据到现有列表
          const existingTraceIds = new Set(currentTraces.map(t => t.traceID));
          const newTraces = result.filter(t => !existingTraceIds.has(t.traceID));
          const merged = [...newTraces, ...currentTraces];
          // 按最早 span 时间倒序排列
          merged.sort((a, b) => {
            const aTime = Math.min(...a.spans.map(s => s.startTime));
            const bTime = Math.min(...b.spans.map(s => s.startTime));
            return bTime - aTime;
          });
          setTraces(merged);
        } else {
          // 未翻页：直接覆盖
          setTraces(result);
          setHasMore(result.length === TRACES_LIMIT);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load traces");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        if (showLoading) {
          setLastRefreshTime(new Date());
          setCountdown(isLive ? 5 : 30);
        }
      }
    },
    [project.id, calculateTimeRange, buildTagsString, isLive]
  );

  // Load more traces (pagination)
  const loadMoreTraces = useCallback(async () => {
    if (logEntries.length === 0 || isLoadingMore) return;

    setIsLoadingMore(true);
    setError(null);

    try {
      const { start } = calculateTimeRange();
      const tags = buildTagsString();

      // Use the last entry's time as the end time for the next page
      const lastEntry = logEntries[logEntries.length - 1];
      const end = lastEntry.time;

      const result = await fetchTraces(
        project.id,
        start,
        end,
        TRACES_LIMIT,
        tags
      );

      // Filter out duplicates based on traceID
      const existingTraceIds = new Set(traces.map((t) => t.traceID));
      const newTraces = result.filter((t) => !existingTraceIds.has(t.traceID));

      setTraces((prev) => [...prev, ...newTraces]);
      setHasMore(result.length === TRACES_LIMIT);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more traces");
    } finally {
      setIsLoadingMore(false);
    }
  }, [logEntries, isLoadingMore, calculateTimeRange, buildTagsString, project.id, traces]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return isLive ? 5 : 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isLive]);

  // Initial load and auto refresh
  useEffect(() => {
    loadTraces();

    const interval = setInterval(() => {
      loadTraces(false);
    }, isLive ? 5000 : 30000);

    return () => clearInterval(interval);
  }, [lookback, isLive, liveStartTime, selectedStatusCodes, selectedMethods, loadTraces]);

  // Handle live mode toggle
  const handleLiveToggle = () => {
    if (!isLive) {
      // Enable live mode
      setLiveStartTime(Date.now() * 1000); // microseconds
      setIsLive(true);
    } else {
      // Disable live mode
      setIsLive(false);
      setLiveStartTime(null);
    }
  };

  // Manual refresh
  const handleRefresh = () => {
    loadTraces(false);
  };

  // Handle row click
  const handleRowClick = (trace: Trace) => {
    setSelectedTrace(trace);
    setIsSheetOpen(true);
  };

  // Get color for HTTP method badge
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

  // Get color for status badge
  const getStatusColor = (status: number | null): string => {
    if (!status) return "";
    if (status >= 200 && status < 300) {
      return "!bg-green-500 !text-white !border-green-500";
    } else if (status >= 400 && status < 500) {
      return "!bg-orange-500 !text-white !border-orange-500";
    } else if (status >= 500) {
      return "!bg-red-500 !text-white !border-red-500";
    }
    return "!bg-gray-500 !text-white !border-gray-500";
  };

  return (
    <>
      {/* Header Section with Border */}
      <div className="py-16 border-b border-muted">
        <div className="mx-auto max-w-6xl px-4 w-full">
          <div className="flex flex-col gap-y-4">
            <div className="flex flex-col md:flex-row md:items-center gap-6 justify-between w-full">
              {/* Title */}
              <div className="flex flex-col md:flex-row md:items-end gap-3 w-full">
                <div>
                  <h1 className="text-3xl">Logs</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isLoading ? "Loading..." : `${logEntries.length} logs found`}
                  </p>
                </div>
              </div>

              {/* Controls - Only Live and Refresh in header */}
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  {/* Live Button */}
                  <Button
                    onClick={handleLiveToggle}
                    variant={isLive ? "default" : "outline"}
                    size="sm"
                    className="relative"
                  >
                    {isLive ? (
                      <Circle className="h-4 w-4 fill-current animate-pulse" />
                    ) : (
                      <Radio className="h-4 w-4" />
                    )}
                    Live
                  </Button>

                  {/* Manual Refresh Button */}
                  <Button
                    onClick={handleRefresh}
                    disabled={isLoading || isRefreshing}
                    variant="outline"
                    size="sm"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${
                        isRefreshing ? "animate-spin" : ""
                      }`}
                    />
                  </Button>
                </div>
                {lastRefreshTime && (
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {lastRefreshTime.toLocaleTimeString()} · Next in {countdown}s
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-6xl p-4 w-full">
        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-4">
            {error}
          </div>
        )}

        {/* Filters Row */}
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          {/* Time Range Selector */}
          <Select
            value={lookback}
            onValueChange={setLookback}
            disabled={isLive || isLoading}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15m">Last 15 minutes</SelectItem>
              <SelectItem value="1h">Last 1 hour</SelectItem>
              <SelectItem value="6h">Last 6 hours</SelectItem>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
            </SelectContent>
          </Select>

          {/* Status Code Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" disabled={isLoading}>
                Status
                {selectedStatusCodes.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {selectedStatusCodes.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56">
              <div className="space-y-2">
                <Label>Status Codes</Label>
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {STATUS_CODES.map((code) => {
                    const isSelected = selectedStatusCodes.includes(code);
                    return (
                      <Button
                        key={code}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        disabled={isLoading}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedStatusCodes(
                              selectedStatusCodes.filter((c) => c !== code)
                            );
                          } else {
                            setSelectedStatusCodes([...selectedStatusCodes, code]);
                          }
                        }}
                        className="h-8"
                      >
                        {code}
                      </Button>
                    );
                  })}
                </div>
                {selectedStatusCodes.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isLoading}
                    onClick={() => setSelectedStatusCodes([])}
                    className="w-full"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Method Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" disabled={isLoading}>
                Method
                {selectedMethods.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {selectedMethods.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56">
              <div className="space-y-2">
                <Label>HTTP Methods</Label>
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {HTTP_METHODS.map((method) => {
                    const isSelected = selectedMethods.includes(method);
                    return (
                      <Button
                        key={method}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        disabled={isLoading}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedMethods(
                              selectedMethods.filter((m) => m !== method)
                            );
                          } else {
                            setSelectedMethods([...selectedMethods, method]);
                          }
                        }}
                        className="h-8"
                      >
                        {method}
                      </Button>
                    );
                  })}
                </div>
                {selectedMethods.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isLoading}
                    onClick={() => setSelectedMethods([])}
                    className="w-full"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Show Chart Toggle - Right aligned */}
          <Button
            onClick={() => setShowChart(!showChart)}
            variant={showChart ? "default" : "outline"}
            size="sm"
            disabled={isLoading}
            className="ml-auto"
          >
            {showChart ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
            Chart
          </Button>
        </div>

        {/* Distribution Chart */}
        {showChart && chartData.length > 0 && (
          <div className="mb-2">
            <ChartContainer
              config={Object.fromEntries(
                HTTP_METHODS.map((method) => [
                  method,
                  {
                    label: method,
                    color: methodColors[method] || "#6b7280",
                  },
                ])
              )}
              className="h-24 w-full"
            >
              <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const data = payload[0].payload;
                    const timestamp = data.timestamp as number;
                    // timestamp is already in milliseconds (bucketTime / 1000 from microseconds)
                    const dateTime = new Date(timestamp).toLocaleString();

                    // Get method counts from payload
                    const methodCounts: Array<{ method: string; count: number }> = [];
                    payload.forEach((item) => {
                      if (item.dataKey && HTTP_METHODS.includes(item.dataKey as string)) {
                        const value = item.value as number;
                        if (value > 0) {
                          methodCounts.push({
                            method: item.dataKey as string,
                            count: value,
                          });
                        }
                      }
                    });

                    return (
                      <div className="bg-background border rounded-lg p-3 shadow-lg">
                        <div className="text-sm font-medium mb-2">{dateTime}</div>
                        {methodCounts.length > 0 ? (
                          <div className="space-y-1">
                            {methodCounts.map(({ method, count }) => (
                              <div key={method} className="text-xs flex items-center justify-between gap-2">
                                <span>{method}:</span>
                                <span className="font-mono font-medium">{count}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">No data</div>
                        )}
                      </div>
                    );
                  }}
                />
                {HTTP_METHODS.map((method, index) => {
                  // Only the last method gets rounded corners on top
                  const isLast = index === HTTP_METHODS.length - 1;
                  return (
                    <Bar
                      key={method}
                      dataKey={method}
                      stackId="a"
                      fill={methodColors[method] || "#6b7280"}
                      name={method}
                      radius={isLast ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    />
                  );
                })}
              </BarChart>
            </ChartContainer>
          </div>
        )}

        {/* Logs Table */}
        {isLoading ? (
          <div className="text-center py-8">Loading logs...</div>
        ) : logEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No logs found
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Spans</TableHead>
                    <TableHead>Path</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logEntries.map((entry) => (
                    <TableRow
                      key={entry.trace.traceID}
                      onClick={() => handleRowClick(entry.trace)}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-mono text-xs">
                        {formatTimestamp(entry.time / 1000)}
                      </TableCell>
                      <TableCell>
                        {entry.status !== null ? (
                          <Badge
                            variant="default"
                            className={`font-mono ${getStatusColor(entry.status)}`}
                          >
                            {entry.status}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.method ? (
                          <Badge
                            variant="default"
                            className={`font-mono text-xs ${getHttpMethodColor(entry.method)}`}
                          >
                            {entry.method}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs">
                            {formatDuration(entry.rootDuration)}
                          </span>
                          {entry.totalDuration !== entry.rootDuration && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1">
                                  <div className="font-medium">Total Duration</div>
                                  <div className="text-xs font-mono">
                                    {formatDuration(entry.totalDuration)}
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{entry.spanCount}</TableCell>
                      <TableCell className="font-mono text-xs truncate max-w-xs">
                        {entry.path}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center">
                <Button
                  onClick={loadMoreTraces}
                  disabled={isLoadingMore}
                  variant="outline"
                  size="sm"
                >
                  {isLoadingMore ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Trace Detail Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-4xl">
          <SheetHeader>
            <div className="flex items-center gap-2">
              <SheetTitle>Trace Details</SheetTitle>
              {selectedTrace && (
                <code
                  className="text-xs bg-muted px-2 py-1 rounded font-mono cursor-pointer hover:bg-muted/80 transition-colors"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(selectedTrace.traceID);
                      toast.success("Trace ID copied to clipboard");
                    } catch {
                      toast.error("Failed to copy Trace ID");
                    }
                  }}
                  title="Click to copy"
                >
                  {selectedTrace.traceID}
                </code>
              )}
            </div>
          </SheetHeader>

          {selectedTrace && (
            <TraceDetailContent trace={selectedTrace} />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

