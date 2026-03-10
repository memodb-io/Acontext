"use client";

import { useState, useMemo, useCallback, memo } from "react";
import { ChevronDown, ChevronRight, Layers, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type Trace, type TraceSpan } from "@/lib/acontext/server";

/**
 * Format duration from microseconds to human-readable string
 */
function formatDuration(microseconds: number): string {
  if (microseconds < 1000) {
    return `${microseconds}µs`;
  } else if (microseconds < 1000000) {
    return `${(microseconds / 1000).toFixed(2)}ms`;
  } else {
    return `${(microseconds / 1000000).toFixed(2)}s`;
  }
}

// Minimum width in pixels for span bars
const MIN_SPAN_BAR_WIDTH = 3;

// Aggregated span group
interface SpanGroup {
  operationName: string;
  processID: string;
  spans: TraceSpan[];
  totalDuration: number;
  avgDuration: number;
  minStartTime: number;
  maxEndTime: number;
}

// Get Tailwind color classes for span bars
const getSpanColorClass = (serviceName: string) => {
  const serviceColorClasses: Record<string, string> = {
    "acontext-api": "bg-teal-400 dark:bg-teal-400",
    "acontext-core": "bg-blue-400 dark:bg-blue-400",
  };
  return serviceColorClasses[serviceName] || "bg-gray-400 dark:bg-gray-400";
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

// Get HTTP method from span tags
const getHttpMethod = (span: TraceSpan): string | null => {
  const httpMethodTag = span.tags?.find(
    (tag) => tag.key === "http.request.method"
  );
  return httpMethodTag ? String(httpMethodTag.value).toUpperCase() : null;
};

interface SpanRowProps {
  span: TraceSpan;
  serviceName: string;
  indentLevel?: number;
  hasChildren?: boolean;
  onRowClick?: () => void;
  isExpanded?: boolean;
  showHttpMethod?: boolean;
  traceStartTime: number;
  totalDuration: number;
}

// Memoized SpanRow component
const SpanRow = memo(function SpanRow({
  span,
  serviceName,
  indentLevel = 0,
  hasChildren = false,
  onRowClick,
  isExpanded: expanded,
  showHttpMethod = true,
  traceStartTime,
  totalDuration,
}: SpanRowProps) {
  const spanStart = span.startTime - traceStartTime;
  const spanStartPercent =
    totalDuration > 0 ? (spanStart / totalDuration) * 100 : 0;
  const spanWidthPercent =
    totalDuration > 0 ? (span.duration / totalDuration) * 100 : 0;
  const spanColorClass = getSpanColorClass(serviceName);

  // Check if span bar is too narrow for text
  const isNarrowBar = spanWidthPercent < 8;
  // Check if duration label should be on the left (when start time > 50%)
  const showDurationOnLeft = spanStartPercent > 50;

  return (
    <div
      className={`flex items-center border-b last:border-b-0 hover:bg-muted/50 transition-colors ${
        hasChildren ? "cursor-pointer" : ""
      }`}
      style={{ height: "29px" }}
      onClick={hasChildren ? onRowClick : undefined}
    >
      {/* Left: Service name and operation name - with overflow protection */}
      <div
        className="shrink-0 overflow-visible relative z-0 hover:z-10 group/left"
        style={{ width: "35%", minWidth: "200px", maxWidth: "400px" }}
      >
        <div className="flex items-center w-full h-full px-2 min-w-0 overflow-hidden group-hover/left:overflow-visible group-hover/left:w-auto group-hover/left:bg-background group-hover/left:shadow-md group-hover/left:rounded-r group-hover/left:pr-4" style={{ height: "29px" }}>
          {/* Expand/collapse icon - fixed width to maintain alignment */}
          <div className="w-4 shrink-0 flex items-center justify-center">
            {hasChildren && (
              <span className="text-muted-foreground">
                {expanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </span>
            )}
          </div>
          {/* Indent guides - smaller width */}
          <div className="flex items-center h-full shrink-0">
            {Array.from({ length: indentLevel }).map((_, i) => (
              <div
                key={i}
                className="w-1.5 h-full border-l border-border shrink-0"
              />
            ))}
          </div>
          <div
            className={`h-4 w-0.5 rounded-sm shrink-0 mx-1 ${spanColorClass}`}
          />
          <div className="flex-1 min-w-0 truncate text-xs flex items-center gap-1.5 group-hover/left:overflow-visible group-hover/left:whitespace-nowrap">
            <span className="font-medium shrink-0">{serviceName}</span>
            {showHttpMethod && getHttpMethod(span) && (
              <Badge
                variant="default"
                className={`font-mono text-[10px] px-1.5 py-0 h-4 shrink-0 ${getHttpMethodColor(
                  getHttpMethod(span)
                )}`}
              >
                {getHttpMethod(span)}
              </Badge>
            )}
            <span className="text-muted-foreground truncate group-hover/left:overflow-visible group-hover/left:text-clip">
              {span.operationName}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Timeline with span bar */}
      <div
        className="flex-1 relative h-full overflow-hidden"
        style={{ minWidth: "200px" }}
      >
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

        {/* Span bar with minimum width */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`absolute h-full hover:opacity-100 transition-opacity cursor-pointer ${spanColorClass}`}
              style={{
                left: `${spanStartPercent}%`,
                width: `max(${MIN_SPAN_BAR_WIDTH}px, ${spanWidthPercent}%)`,
              }}
            >
              {/* Show duration label if bar is wide enough */}
              {!isNarrowBar && (
                <div className="absolute inset-0 flex items-center px-1.5 text-[10px] text-foreground font-semibold truncate pointer-events-none">
                  {formatDuration(span.duration)}
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <div className="text-xs">
              <div className="font-medium">{span.operationName}</div>
              <div className="text-muted-foreground">{serviceName}</div>
              <div className="font-mono mt-1">
                Duration: {formatDuration(span.duration)}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Duration label outside bar for narrow bars */}
        {isNarrowBar && (
          <div
            className="absolute h-full flex items-center text-[10px] text-muted-foreground font-medium pointer-events-none whitespace-nowrap"
            style={
              showDurationOnLeft
                ? { right: `calc(${100 - spanStartPercent}% + 4px)` }
                : { left: `calc(${spanStartPercent}% + ${MIN_SPAN_BAR_WIDTH + 4}px)` }
            }
          >
            {formatDuration(span.duration)}
          </div>
        )}
      </div>
    </div>
  );
});

interface GroupRowProps {
  group: SpanGroup;
  serviceName: string;
  isGroupExpanded: boolean;
  onToggleExpansion: () => void;
  traceStartTime: number;
  totalDuration: number;
}

// Memoized GroupRow component
const GroupRow = memo(function GroupRow({
  group,
  serviceName,
  isGroupExpanded,
  onToggleExpansion,
  traceStartTime,
  totalDuration,
}: GroupRowProps) {
  const spanColorClass = getSpanColorClass(serviceName);

  // Calculate the span of all grouped spans
  const groupStart = group.minStartTime - traceStartTime;
  const groupEnd = group.maxEndTime - traceStartTime;
  const groupStartPercent =
    totalDuration > 0 ? (groupStart / totalDuration) * 100 : 0;
  const groupWidthPercent =
    totalDuration > 0 ? ((groupEnd - groupStart) / totalDuration) * 100 : 0;

  const isNarrowBar = groupWidthPercent < 8;
  // Check if duration label should be on the left (when start time > 50%)
  const showDurationOnLeft = groupStartPercent > 50;

  return (
    <>
      <div
        className="flex items-center border-b last:border-b-0 hover:bg-muted/50 transition-colors cursor-pointer"
        style={{ height: "29px" }}
        onClick={onToggleExpansion}
      >
        {/* Left: Service name and operation name */}
        <div
          className="shrink-0 overflow-visible relative z-0 hover:z-10 group/left"
          style={{ width: "35%", minWidth: "200px", maxWidth: "400px" }}
        >
          <div className="flex items-center w-full h-full px-2 min-w-0 overflow-hidden group-hover/left:overflow-visible group-hover/left:w-auto group-hover/left:bg-background group-hover/left:shadow-md group-hover/left:rounded-r group-hover/left:pr-4" style={{ height: "29px" }}>
            {/* Expand/collapse icon */}
            <div className="w-4 shrink-0 flex items-center justify-center">
              <span className="text-muted-foreground">
                {isGroupExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </span>
            </div>
            {/* Single indent for grouped items - smaller width */}
            <div className="w-1.5 h-full border-l border-border shrink-0" />
            <div
              className={`h-4 w-0.5 rounded-sm shrink-0 mx-1 ${spanColorClass}`}
            />
            <div className="flex-1 min-w-0 truncate text-xs flex items-center gap-1.5 group-hover/left:overflow-visible group-hover/left:whitespace-nowrap">
              <span className="font-medium shrink-0">{serviceName}</span>
              <Badge
                variant="outline"
                className="font-mono text-[10px] px-1.5 py-0 h-4 shrink-0 bg-muted"
              >
                <Layers className="w-3 h-3" />
                {group.spans.length}
              </Badge>
              <span className="text-muted-foreground truncate group-hover/left:overflow-visible group-hover/left:text-clip">
                {group.operationName}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Timeline showing span range */}
        <div
          className="flex-1 relative h-full overflow-hidden"
          style={{ minWidth: "200px" }}
        >
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

          {/* Group span bar (striped to indicate aggregation) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={`absolute h-full hover:opacity-100 transition-opacity cursor-pointer ${spanColorClass} opacity-60`}
                style={{
                  left: `${groupStartPercent}%`,
                  width: `max(${MIN_SPAN_BAR_WIDTH}px, ${groupWidthPercent}%)`,
                  backgroundImage: `repeating-linear-gradient(
                    45deg,
                    transparent,
                    transparent 2px,
                    rgba(255,255,255,0.15) 2px,
                    rgba(255,255,255,0.15) 4px
                  )`,
                }}
              >
                {!isNarrowBar && (
                  <div className="absolute inset-0 flex items-center px-1.5 text-[10px] text-foreground font-semibold truncate pointer-events-none">
                    {group.spans.length}× avg{" "}
                    {formatDuration(Math.round(group.avgDuration))}
                  </div>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              <div className="text-xs">
                <div className="font-medium">{group.operationName}</div>
                <div className="text-muted-foreground">{serviceName}</div>
                <div className="mt-1 space-y-0.5 font-mono">
                  <div>Count: {group.spans.length}</div>
                  <div>
                    Avg: {formatDuration(Math.round(group.avgDuration))}
                  </div>
                  <div>Total: {formatDuration(group.totalDuration)}</div>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>

          {/* Duration label outside for narrow bars */}
          {isNarrowBar && (
            <div
              className="absolute h-full flex items-center text-[10px] text-muted-foreground font-medium pointer-events-none whitespace-nowrap"
              style={
                showDurationOnLeft
                  ? { right: `calc(${100 - groupStartPercent}% + 4px)` }
                  : { left: `calc(${groupStartPercent}% + ${MIN_SPAN_BAR_WIDTH + 4}px)` }
              }
            >
              {group.spans.length}× avg{" "}
              {formatDuration(Math.round(group.avgDuration))}
            </div>
          )}
        </div>
      </div>

      {/* Expanded individual spans */}
      {isGroupExpanded && (
        <div className="bg-muted/30">
          {group.spans.map((span) => (
            <SpanRow
              key={span.spanID}
              span={span}
              serviceName={serviceName}
              indentLevel={1}
              showHttpMethod={true}
              traceStartTime={traceStartTime}
              totalDuration={totalDuration}
            />
          ))}
        </div>
      )}
    </>
  );
});

interface SpansTimelineProps {
  trace: Trace;
}

export function SpansTimeline({ trace }: SpansTimelineProps) {
  const [isAggregated, setIsAggregated] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedSpans, setExpandedSpans] = useState<Set<string>>(() => {
    // Initialize with root span expanded
    const rootSpan = trace.spans.find((s) => s.references.length === 0);
    return rootSpan ? new Set([rootSpan.spanID]) : new Set();
  });

  // Sort spans by start time
  const sortedSpans = useMemo(
    () => [...trace.spans].sort((a, b) => a.startTime - b.startTime),
    [trace.spans]
  );

  const traceStartTime = sortedSpans[0]?.startTime || 0;
  // Calculate total duration from earliest start to latest end
  const traceEndTime = useMemo(
    () =>
      sortedSpans.reduce((max, span) => {
        const spanEndTime = span.startTime + span.duration;
        return Math.max(max, spanEndTime);
      }, traceStartTime),
    [sortedSpans, traceStartTime]
  );
  const totalDuration = traceEndTime - traceStartTime;

  // Build parent-children relationship map
  const { spanChildrenMap, spanParentMap } = useMemo(() => {
    const childrenMap = new Map<string, string[]>();
    const parentMap = new Map<string, string>();

    trace.spans.forEach((span) => {
      const parentRef = span.references.find((ref) => ref.refType === "CHILD_OF");
      if (parentRef) {
        parentMap.set(span.spanID, parentRef.spanID);
        const children = childrenMap.get(parentRef.spanID) || [];
        children.push(span.spanID);
        childrenMap.set(parentRef.spanID, children);
      }
    });

    return { spanChildrenMap: childrenMap, spanParentMap: parentMap };
  }, [trace.spans]);

  // Calculate depth for each span based on parent-child relationships
  const spanDepthMap = useMemo(() => {
    const depthMap = new Map<string, number>();

    const calculateDepth = (
      spanID: string,
      visited = new Set<string>()
    ): number => {
      if (visited.has(spanID)) return 0; // Prevent cycles
      if (depthMap.has(spanID)) return depthMap.get(spanID)!;

      visited.add(spanID);
      const span = trace.spans.find((s) => s.spanID === spanID);
      if (!span || span.references.length === 0) {
        depthMap.set(spanID, 0);
        return 0;
      }

      // Find parent span and calculate its depth
      const parentRef = span.references.find(
        (ref) => ref.refType === "CHILD_OF"
      );
      if (!parentRef) {
        depthMap.set(spanID, 0);
        return 0;
      }

      const parentDepth = calculateDepth(parentRef.spanID, visited);
      const depth = parentDepth + 1;
      depthMap.set(spanID, depth);
      return depth;
    };

    trace.spans.forEach((span) => calculateDepth(span.spanID));
    return depthMap;
  }, [trace.spans]);

  // Check if a span is visible (all ancestors are expanded)
  const isSpanVisible = useCallback(
    (spanID: string): boolean => {
      let currentID = spanID;
      while (spanParentMap.has(currentID)) {
        const parentID = spanParentMap.get(currentID)!;
        if (!expandedSpans.has(parentID)) {
          return false;
        }
        currentID = parentID;
      }
      return true;
    },
    [spanParentMap, expandedSpans]
  );

  // Toggle span expansion
  const toggleSpanExpansion = useCallback((spanID: string) => {
    setExpandedSpans((prev) => {
      const next = new Set(prev);
      if (next.has(spanID)) {
        next.delete(spanID);
      } else {
        next.add(spanID);
      }
      return next;
    });
  }, []);

  // Group spans by operation name for aggregation
  const spanGroups = useMemo(() => {
    const groups = new Map<string, SpanGroup>();

    sortedSpans.forEach((span) => {
      // Skip root span from aggregation
      if (span.references.length === 0) return;

      const key = `${span.processID}:${span.operationName}`;
      const existing = groups.get(key);

      if (existing) {
        existing.spans.push(span);
        existing.totalDuration += span.duration;
        existing.minStartTime = Math.min(existing.minStartTime, span.startTime);
        existing.maxEndTime = Math.max(
          existing.maxEndTime,
          span.startTime + span.duration
        );
        existing.avgDuration = existing.totalDuration / existing.spans.length;
      } else {
        groups.set(key, {
          operationName: span.operationName,
          processID: span.processID,
          spans: [span],
          totalDuration: span.duration,
          avgDuration: span.duration,
          minStartTime: span.startTime,
          maxEndTime: span.startTime + span.duration,
        });
      }
    });

    return Array.from(groups.values()).sort(
      (a, b) => a.minStartTime - b.minStartTime
    );
  }, [sortedSpans]);

  // Find root span
  const rootSpan = useMemo(
    () =>
      sortedSpans.find((span) => span.references.length === 0) ||
      sortedSpans[0],
    [sortedSpans]
  );

  // Get service name for a processID
  const getServiceName = useCallback(
    (processID: string) => {
      return trace.processes[processID]?.serviceName || "unknown";
    },
    [trace.processes]
  );

  // Toggle group expansion
  const toggleGroupExpansion = useCallback((groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  // Toggle aggregation
  const toggleAggregation = useCallback(() => {
    setIsAggregated((prev) => !prev);
    // If root is collapsed, expand it when toggling aggregation
    if (rootSpan && !expandedSpans.has(rootSpan.spanID)) {
      setExpandedSpans((prev) => new Set([...prev, rootSpan.spanID]));
    }
  }, [rootSpan, expandedSpans]);

  // Check if all items are expanded
  const isAllExpanded = useMemo(() => {
    if (isAggregated) {
      // In aggregated mode, check if all groups with multiple spans are expanded
      const groupKeys = spanGroups
        .filter((g) => g.spans.length > 1)
        .map((g) => `${g.processID}:${g.operationName}`);
      return groupKeys.length > 0 && groupKeys.every((key) => expandedGroups.has(key));
    } else {
      // In non-aggregated mode, check if all spans with children are expanded
      const spansWithChildren = sortedSpans.filter((span) => spanChildrenMap.has(span.spanID));
      return spansWithChildren.length > 0 && spansWithChildren.every((span) => expandedSpans.has(span.spanID));
    }
  }, [isAggregated, spanGroups, expandedGroups, sortedSpans, spanChildrenMap, expandedSpans]);

  // Toggle expand/collapse all
  const toggleExpandAll = useCallback(() => {
    if (isAggregated) {
      // In aggregated mode, expand/collapse all groups
      const groupKeys = spanGroups
        .filter((g) => g.spans.length > 1)
        .map((g) => `${g.processID}:${g.operationName}`);
      if (isAllExpanded) {
        setExpandedGroups(new Set());
      } else {
        setExpandedGroups(new Set(groupKeys));
      }
    } else {
      // In non-aggregated mode, expand/collapse all spans
      if (isAllExpanded) {
        // Keep only root expanded
        setExpandedSpans(rootSpan ? new Set([rootSpan.spanID]) : new Set());
      } else {
        // Expand all spans that have children
        const allSpanIds = sortedSpans
          .filter((span) => spanChildrenMap.has(span.spanID))
          .map((span) => span.spanID);
        setExpandedSpans(new Set(allSpanIds));
      }
    }
  }, [isAggregated, spanGroups, isAllExpanded, sortedSpans, spanChildrenMap, rootSpan]);

  if (!rootSpan) return null;

  // Check if root span has children (is expanded means children are visible)
  const rootHasChildren = spanChildrenMap.has(rootSpan.spanID);
  const isRootExpanded = expandedSpans.has(rootSpan.spanID);

  // Check if aggregation would be useful (more than 10 spans or duplicates exist)
  const hasAggregableSpans = spanGroups.some((g) => g.spans.length > 1);
  const totalNonRootSpans = sortedSpans.filter(
    (s) => s.spanID !== rootSpan?.spanID
  ).length;
  const showAggregateToggle = hasAggregableSpans || totalNonRootSpans > 10;

  const rootServiceName = getServiceName(rootSpan.processID);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">Spans Timeline</div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleExpandAll}
            className="text-xs px-2 py-1 rounded-md transition-colors flex items-center gap-1.5 bg-muted hover:bg-muted/80 text-muted-foreground"
          >
            {isAllExpanded ? (
              <>
                <ChevronsDownUp className="w-3 h-3" />
                Collapse
              </>
            ) : (
              <>
                <ChevronsUpDown className="w-3 h-3" />
                Expand
              </>
            )}
          </button>
          {showAggregateToggle && (
            <button
              onClick={toggleAggregation}
              className={`text-xs px-2 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                isAggregated
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              }`}
            >
              <Layers className="w-3 h-3" />
              {isAggregated ? "Grouped" : "Group Similar"}
            </button>
          )}
        </div>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <SpanRow
          span={rootSpan}
          serviceName={rootServiceName}
          indentLevel={0}
          hasChildren={rootHasChildren}
          onRowClick={() => toggleSpanExpansion(rootSpan.spanID)}
          isExpanded={isRootExpanded}
          showHttpMethod={false}
          traceStartTime={traceStartTime}
          totalDuration={totalDuration}
        />
        {isRootExpanded && (
          <div className="border-t">
            {isAggregated
              ? // Aggregated view - show GroupRow for groups with multiple spans, SpanRow for single spans
                spanGroups.map((group) => {
                  const groupKey = `${group.processID}:${group.operationName}`;
                  const groupServiceName = getServiceName(group.processID);

                  return group.spans.length > 1 ? (
                    <GroupRow
                      key={groupKey}
                      group={group}
                      serviceName={groupServiceName}
                      isGroupExpanded={expandedGroups.has(groupKey)}
                      onToggleExpansion={() => toggleGroupExpansion(groupKey)}
                      traceStartTime={traceStartTime}
                      totalDuration={totalDuration}
                    />
                  ) : (
                    <SpanRow
                      key={group.spans[0].spanID}
                      span={group.spans[0]}
                      serviceName={groupServiceName}
                      indentLevel={1}
                      hasChildren={false}
                      traceStartTime={traceStartTime}
                      totalDuration={totalDuration}
                    />
                  );
                })
              : // Normal view with hierarchical expansion
                sortedSpans
                  .filter((span) => span.spanID !== rootSpan?.spanID && isSpanVisible(span.spanID))
                  .map((span) => {
                    const indentLevel = spanDepthMap.get(span.spanID) || 0;
                    const hasChildren = spanChildrenMap.has(span.spanID);
                    return (
                      <SpanRow
                        key={span.spanID}
                        span={span}
                        serviceName={getServiceName(span.processID)}
                        indentLevel={indentLevel}
                        hasChildren={hasChildren}
                        onRowClick={() => toggleSpanExpansion(span.spanID)}
                        isExpanded={expandedSpans.has(span.spanID)}
                        traceStartTime={traceStartTime}
                        totalDuration={totalDuration}
                      />
                    );
                  })}
          </div>
        )}
      </div>
    </div>
  );
}
