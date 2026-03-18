"use client";

import React, { memo, useMemo, cloneElement } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Rectangle,
} from "recharts";
import { formatBytes } from "@/lib/utils";
import type { DashboardData } from "./actions";

// Static mock data with fixed values for initial render
const mockLabels = [
  "Day 1",
  "Day 2",
  "Day 3",
  "Day 4",
  "Day 5",
  "Day 6",
  "Day 7",
];

const mockDashboardData: DashboardData = {
  task_success: [
    { date: mockLabels[0], success_rate: 72.5 },
    { date: mockLabels[1], success_rate: 78.3 },
    { date: mockLabels[2], success_rate: 65.8 },
    { date: mockLabels[3], success_rate: 82.1 },
    { date: mockLabels[4], success_rate: 75.6 },
    { date: mockLabels[5], success_rate: 88.2 },
    { date: mockLabels[6], success_rate: 85.4 },
  ],
  task_status: [
    {
      date: mockLabels[0],
      completed: 18,
      in_progress: 5,
      pending: 3,
      failed: 2,
    },
    {
      date: mockLabels[1],
      completed: 22,
      in_progress: 4,
      pending: 2,
      failed: 3,
    },
    {
      date: mockLabels[2],
      completed: 15,
      in_progress: 6,
      pending: 4,
      failed: 2,
    },
    {
      date: mockLabels[3],
      completed: 25,
      in_progress: 3,
      pending: 2,
      failed: 1,
    },
    {
      date: mockLabels[4],
      completed: 20,
      in_progress: 5,
      pending: 3,
      failed: 2,
    },
    {
      date: mockLabels[5],
      completed: 28,
      in_progress: 4,
      pending: 2,
      failed: 1,
    },
    {
      date: mockLabels[6],
      completed: 24,
      in_progress: 5,
      pending: 3,
      failed: 2,
    },
  ],
  session_message: [
    { date: mockLabels[0], avg_message_turns: 8.5 },
    { date: mockLabels[1], avg_message_turns: 10.2 },
    { date: mockLabels[2], avg_message_turns: 7.8 },
    { date: mockLabels[3], avg_message_turns: 11.5 },
    { date: mockLabels[4], avg_message_turns: 9.3 },
    { date: mockLabels[5], avg_message_turns: 12.1 },
    { date: mockLabels[6], avg_message_turns: 10.8 },
  ],
  session_task: [
    { date: mockLabels[0], avg_tasks: 3.2 },
    { date: mockLabels[1], avg_tasks: 4.1 },
    { date: mockLabels[2], avg_tasks: 2.8 },
    { date: mockLabels[3], avg_tasks: 4.5 },
    { date: mockLabels[4], avg_tasks: 3.6 },
    { date: mockLabels[5], avg_tasks: 5.2 },
    { date: mockLabels[6], avg_tasks: 4.3 },
  ],
  task_message: [
    { date: mockLabels[0], avg_turns: 5.4 },
    { date: mockLabels[1], avg_turns: 6.2 },
    { date: mockLabels[2], avg_turns: 4.8 },
    { date: mockLabels[3], avg_turns: 7.1 },
    { date: mockLabels[4], avg_turns: 5.9 },
    { date: mockLabels[5], avg_turns: 6.8 },
    { date: mockLabels[6], avg_turns: 6.5 },
  ],
  storage: [
    { date: mockLabels[0], usage_bytes: 52428800 },
    { date: mockLabels[1], usage_bytes: 58720256 },
    { date: mockLabels[2], usage_bytes: 65011712 },
    { date: mockLabels[3], usage_bytes: 73400320 },
    { date: mockLabels[4], usage_bytes: 81788928 },
    { date: mockLabels[5], usage_bytes: 92274688 },
    { date: mockLabels[6], usage_bytes: 104857600 },
  ],
  task_stats: [
    { status: "success", count: 85, percentage: 68, avg_time: 12 },
    { status: "running", count: 15, percentage: 12, avg_time: null },
    { status: "pending", count: 12, percentage: 10, avg_time: null },
    { status: "failed", count: 13, percentage: 10, avg_time: 8 },
  ],
  new_sessions: [
    { date: mockLabels[0], count: 12 },
    { date: mockLabels[1], count: 15 },
    { date: mockLabels[2], count: 9 },
    { date: mockLabels[3], count: 18 },
    { date: mockLabels[4], count: 14 },
    { date: mockLabels[5], count: 21 },
    { date: mockLabels[6], count: 16 },
  ],
  new_disks: [
    { date: mockLabels[0], count: 5 },
    { date: mockLabels[1], count: 7 },
    { date: mockLabels[2], count: 4 },
    { date: mockLabels[3], count: 8 },
    { date: mockLabels[4], count: 6 },
    { date: mockLabels[5], count: 9 },
    { date: mockLabels[6], count: 7 },
  ],
};

// Chart config defined outside component to avoid recreation
const baseChartConfig = {
  completed: {
    label: "Completed",
    color: "#10b981",
  },
  in_progress: {
    label: "In Progress",
    color: "#3b82f6",
  },
  pending: {
    label: "Pending",
    color: "#f59e0b",
  },
  failed: {
    label: "Failed",
    color: "#ef4444",
  },
};

export const chartConfig = {
  ...baseChartConfig,
  success_rate: {
    label: "Success Rate",
    color: "#10b981",
  },
  avg_message_turns: {
    label: "Avg Message Turns",
    color: "#6366f1",
  },
  avg_tasks: {
    label: "Avg Tasks",
    color: "#f59e0b",
  },
  avg_turns: {
    label: "Avg Task Message Turns",
    color: "#6366f1",
  },
  usage: {
    label: "Storage Usage",
    color: "#3b82f6",
  },
  count: {
    label: "Count",
    color: "#8b5cf6",
  },
};

// Stacked bar shape components defined outside to prevent recreation
const STACK_ORDER = ["completed", "in_progress", "pending", "failed"] as const;
const STACK_COLORS = {
  completed: "#10b981",
  in_progress: "#3b82f6",
  pending: "#f59e0b",
  failed: "#ef4444",
} as const;

// Helper function to create stacked bar shapes with proper rounded corners
function createStackedBarShapeRenderer(dataKey: keyof typeof STACK_COLORS) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function StackedBarShapeRenderer(props: any) {
    const { payload, ...rest } = props;

    let topDataKey: string | null = null;
    if (payload) {
      for (let i = STACK_ORDER.length - 1; i >= 0; i--) {
        const key = STACK_ORDER[i];
        const value = payload[key];
        if (typeof value === "number" && value > 0) {
          topDataKey = key;
          break;
        }
      }
    }

    const radius: [number, number, number, number] =
      topDataKey === dataKey ? [4, 4, 0, 0] : [0, 0, 0, 0];

    return <Rectangle {...rest} fill={STACK_COLORS[dataKey]} radius={radius} />;
  };
}

// Create stable shape component references - these are created once at module load
const CompletedBarShape = createStackedBarShapeRenderer("completed");
const InProgressBarShape = createStackedBarShapeRenderer("in_progress");
const PendingBarShape = createStackedBarShapeRenderer("pending");
const FailedBarShape = createStackedBarShapeRenderer("failed");

// Formatters defined outside component
const percentageFormatter = (value: unknown): string => {
  const numericValue = Array.isArray(value)
    ? Number(value[0])
    : typeof value === "number"
      ? value
      : Number(value);
  if (!Number.isFinite(numericValue)) {
    return "-";
  }
  return `${numericValue.toFixed(1)}%`;
};

const bytesFormatter = (value: unknown): string => {
  const numericValue = Array.isArray(value)
    ? Number(value[0])
    : typeof value === "number"
      ? value
      : Number(value);
  if (!Number.isFinite(numericValue)) {
    return "-";
  }
  return formatBytes(numericValue);
};

// Memoized chart card components
interface ChartCardProps {
  title: string;
  value: string | number;
  isLoading?: boolean;
  children: React.ReactNode;
}

export const ChartCard = memo(function ChartCard({
  title,
  value,
  isLoading = false,
  children,
}: ChartCardProps) {
  return (
    <Card className="bg-surface-100 rounded-md border shadow-sm overflow-hidden mb-0 md:mb-0 relative">
      <CardContent>
        <div className="flex flex-col gap-y-3">
          <div className="grow flex justify-between items-start min-h-16">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h3 className="text-foreground-lighter text-sm">{title}</h3>
              </div>
              <div className="h-4">
                <h4 className="text-foreground font-normal text-2xl">
                  {value}
                </h4>
              </div>
            </div>
          </div>
          <div className="w-full" style={{ height: "160px" }}>
            {children}
          </div>
        </div>
      </CardContent>
      {/* Per-card loading overlay */}
      <div
        className={`absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center transition-opacity duration-300 ${
          isLoading ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {isLoading && (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        )}
      </div>
    </Card>
  );
});

// Chart wrapper
interface ChartWrapperProps {
  children: React.ReactElement;
  hasData: boolean;
}

export const ChartWrapper = memo(function ChartWrapper({
  children,
  hasData,
}: ChartWrapperProps) {
  if (!hasData) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
        No data available
      </div>
    );
  }

  // Clone the chart element and inject responsive prop and style
  const chartWithResponsive = cloneElement(children as React.ReactElement<{ responsive?: boolean; style?: React.CSSProperties }>, {
    responsive: true,
    style: { width: "100%", height: "100%" },
  });

  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      {chartWithResponsive}
    </ChartContainer>
  );
});

// Chart data flags interface (kept for external consumers)
export interface ChartDataFlags {
  hasTaskSuccessRateData: boolean;
  hasTaskStatusDistributionData: boolean;
  hasSessionAvgMessageTurnsData: boolean;
  hasSessionAvgTasksData: boolean;
  hasTaskAvgMessageTurnsData: boolean;
  hasStorageUsageData: boolean;
  hasNewSessionsData: boolean;
  hasNewDisksData: boolean;
}

export interface LoadingGroups {
  tasks: boolean;
  session_metrics: boolean;
  task_metrics: boolean;
  storage: boolean;
  counts: boolean;
}

interface DashboardChartsProps {
  tasksData: Partial<DashboardData> | null;
  sessionMetricsData: Partial<DashboardData> | null;
  taskMetricsData: Partial<DashboardData> | null;
  storageData: Partial<DashboardData> | null;
  countsData: Partial<DashboardData> | null;
  loadingGroups: LoadingGroups;
}

export function DashboardCharts({
  tasksData,
  sessionMetricsData,
  taskMetricsData,
  storageData,
  countsData,
  loadingGroups,
}: DashboardChartsProps) {
  // Merge group data into a single object, falling back to mock data per-group when loading
  const data = useMemo(() => {
    return {
      task_success: loadingGroups.tasks ? mockDashboardData.task_success : (tasksData?.task_success ?? mockDashboardData.task_success),
      task_status: loadingGroups.tasks ? mockDashboardData.task_status : (tasksData?.task_status ?? mockDashboardData.task_status),
      task_stats: loadingGroups.tasks ? mockDashboardData.task_stats : (tasksData?.task_stats ?? []),
      session_message: loadingGroups.session_metrics ? mockDashboardData.session_message : (sessionMetricsData?.session_message ?? mockDashboardData.session_message),
      session_task: loadingGroups.session_metrics ? mockDashboardData.session_task : (sessionMetricsData?.session_task ?? mockDashboardData.session_task),
      task_message: loadingGroups.task_metrics ? mockDashboardData.task_message : (taskMetricsData?.task_message ?? mockDashboardData.task_message),
      storage: loadingGroups.storage ? mockDashboardData.storage : (storageData?.storage ?? mockDashboardData.storage),
      new_sessions: loadingGroups.counts ? mockDashboardData.new_sessions : (countsData?.new_sessions ?? mockDashboardData.new_sessions),
      new_disks: loadingGroups.counts ? mockDashboardData.new_disks : (countsData?.new_disks ?? mockDashboardData.new_disks),
    };
  }, [tasksData, sessionMetricsData, taskMetricsData, storageData, countsData, loadingGroups]);

  // Compute data flags per-group
  const hasTaskSuccessRateData = loadingGroups.tasks ? true : (data.task_success?.some((p) => p.success_rate > 0) ?? false);
  const hasTaskStatusDistributionData = loadingGroups.tasks ? true : (data.task_status?.some(
    (p) => p.completed > 0 || p.in_progress > 0 || p.pending > 0 || p.failed > 0
  ) ?? false);
  const hasSessionAvgMessageTurnsData = loadingGroups.session_metrics ? true : (data.session_message?.some((p) => p.avg_message_turns > 0) ?? false);
  const hasSessionAvgTasksData = loadingGroups.session_metrics ? true : (data.session_task?.some((p) => p.avg_tasks > 0) ?? false);
  const hasTaskAvgMessageTurnsData = loadingGroups.task_metrics ? true : (data.task_message?.some((p) => p.avg_turns > 0) ?? false);
  const hasStorageUsageData = loadingGroups.storage ? true : (data.storage?.some((p) => p.usage_bytes > 0) ?? false);
  const hasNewSessionsData = loadingGroups.counts ? true : (data.new_sessions?.some((p) => p.count > 0) ?? false);
  const hasNewDisksData = loadingGroups.counts ? true : (data.new_disks?.some((p) => p.count > 0) ?? false);

  return (
    <>
      {/* Charts section - Grid layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 xl:grid-cols-3">
        {/* Task success rate line chart */}
        <ChartCard
          title="Task Success Rate"
          isLoading={loadingGroups.tasks}
          value={
            hasTaskSuccessRateData
              ? `${data.task_success[data.task_success.length - 1]?.success_rate.toFixed(1)}%`
              : "0%"
          }
        >
          <ChartWrapper hasData={hasTaskSuccessRateData}>
            <LineChart
              data={data.task_success}
              margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
            >
              <XAxis dataKey="date" hide />
              <YAxis hide domain={[0, 100]} />
              <ChartTooltip
                content={
                  <ChartTooltipContent formatter={percentageFormatter} />
                }
              />
              <Line
                type="monotone"
                dataKey="success_rate"
                stroke={chartConfig.success_rate.color}
                strokeWidth={2}
                dot={false}
                name="Success Rate"
                isAnimationActive={false}
              />
            </LineChart>
          </ChartWrapper>
        </ChartCard>

        {/* Task status distribution stacked bar chart */}
        <ChartCard
          title="Task Status Distribution"
          isLoading={loadingGroups.tasks}
          value={
            hasTaskStatusDistributionData
              ? (() => {
                  const lastData =
                    data.task_status[data.task_status.length - 1];
                  return (
                    lastData.completed +
                    lastData.in_progress +
                    lastData.pending +
                    lastData.failed
                  );
                })()
              : "0"
          }
        >
          <ChartWrapper hasData={hasTaskStatusDistributionData}>
            <BarChart
              data={data.task_status}
              margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
            >
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="completed"
                stackId="a"
                fill="#10b981"
                name="Completed"
                shape={CompletedBarShape}
                isAnimationActive={false}
              />
              <Bar
                dataKey="in_progress"
                stackId="a"
                fill="#3b82f6"
                name="In Progress"
                shape={InProgressBarShape}
                isAnimationActive={false}
              />
              <Bar
                dataKey="pending"
                stackId="a"
                fill="#f59e0b"
                name="Pending"
                shape={PendingBarShape}
                isAnimationActive={false}
              />
              <Bar
                dataKey="failed"
                stackId="a"
                fill="#ef4444"
                name="Failed"
                shape={FailedBarShape}
                isAnimationActive={false}
              />
            </BarChart>
          </ChartWrapper>
        </ChartCard>

        {/* Average message turns per session bar chart */}
        <ChartCard
          title="Session Avg Message Turns"
          isLoading={loadingGroups.session_metrics}
          value={
            hasSessionAvgMessageTurnsData
              ? data.session_message[
                  data.session_message.length - 1
                ]?.avg_message_turns.toFixed(1)
              : "0"
          }
        >
          <ChartWrapper hasData={hasSessionAvgMessageTurnsData}>
            <BarChart
              data={data.session_message}
              margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
            >
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="avg_message_turns"
                fill={chartConfig.avg_message_turns.color}
                name="Avg Message Turns"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ChartWrapper>
        </ChartCard>

        {/* Average tasks per session bar chart */}
        <ChartCard
          title="Session Avg Task Count"
          isLoading={loadingGroups.session_metrics}
          value={
            hasSessionAvgTasksData
              ? data.session_task[
                  data.session_task.length - 1
                ]?.avg_tasks.toFixed(1)
              : "0"
          }
        >
          <ChartWrapper hasData={hasSessionAvgTasksData}>
            <BarChart
              data={data.session_task}
              margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
            >
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="avg_tasks"
                fill={chartConfig.avg_tasks.color}
                name="Avg Tasks"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ChartWrapper>
        </ChartCard>

        {/* Average message turns per task bar chart */}
        <ChartCard
          title="Task Avg Message Turns"
          isLoading={loadingGroups.task_metrics}
          value={
            hasTaskAvgMessageTurnsData
              ? data.task_message[
                  data.task_message.length - 1
                ]?.avg_turns.toFixed(1)
              : "0"
          }
        >
          <ChartWrapper hasData={hasTaskAvgMessageTurnsData}>
            <BarChart
              data={data.task_message}
              margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
            >
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="avg_turns"
                fill={chartConfig.avg_turns.color}
                name="Avg Task Message Turns"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ChartWrapper>
        </ChartCard>

        {/* Storage usage bar chart */}
        <ChartCard
          title="Storage Usage"
          isLoading={loadingGroups.storage}
          value={
            hasStorageUsageData
              ? formatBytes(
                  data.storage[data.storage.length - 1]?.usage_bytes ?? 0,
                )
              : "0 KB"
          }
        >
          <ChartWrapper hasData={hasStorageUsageData}>
            <BarChart
              data={data.storage}
              margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
            >
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <ChartTooltip
                content={<ChartTooltipContent formatter={bytesFormatter} />}
              />
              <Bar
                dataKey="usage_bytes"
                fill={chartConfig.usage.color}
                name="Storage Usage"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ChartWrapper>
        </ChartCard>
      </div>

      {/* New counts section - 2 charts in one row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* New sessions count bar chart */}
        <ChartCard
          title="New Sessions"
          isLoading={loadingGroups.counts}
          value={
            hasNewSessionsData
              ? data.new_sessions[data.new_sessions.length - 1]?.count
              : "0"
          }
        >
          <ChartWrapper hasData={hasNewSessionsData}>
            <BarChart
              data={data.new_sessions}
              margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
            >
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="count"
                fill={chartConfig.count.color}
                name="New Sessions"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ChartWrapper>
        </ChartCard>

        {/* New disks count bar chart */}
        <ChartCard
          title="New Disks"
          isLoading={loadingGroups.counts}
          value={
            hasNewDisksData
              ? data.new_disks[data.new_disks.length - 1]?.count
              : "0"
          }
        >
          <ChartWrapper hasData={hasNewDisksData}>
            <BarChart
              data={data.new_disks}
              margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
            >
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="count"
                fill={chartConfig.count.color}
                name="New Disks"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ChartWrapper>
        </ChartCard>
      </div>

      {/* Detailed task statistics table - only show when not loading and has data */}
      {!loadingGroups.tasks && data.task_stats.length > 0 && (
        <Card className="bg-surface-100 rounded-md border shadow-sm overflow-hidden">
          <CardContent>
            <div>
              <h3 className="text-foreground text-lg mb-4">
                Task Detail Statistics
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Status</th>
                      <th className="text-right p-2">Count</th>
                      <th className="text-right p-2">Percentage</th>
                      <th className="text-right p-2">Avg Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.task_stats.map((stat, index) => (
                      <tr
                        key={stat.status}
                        className={
                          index < data.task_stats.length - 1 ? "border-b" : ""
                        }
                      >
                        <td className="p-2">
                          {stat.status === "success"
                            ? "Completed"
                            : stat.status === "running"
                              ? "In Progress"
                              : stat.status === "pending"
                                ? "Pending"
                                : stat.status === "failed"
                                  ? "Failed"
                                  : stat.status}
                        </td>
                        <td className="text-right p-2">{stat.count}</td>
                        <td className="text-right p-2">
                          {stat.percentage || 0}%
                        </td>
                        <td className="text-right p-2">
                          {stat.avg_time !== null
                            ? `${stat.avg_time || 0} minutes`
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default DashboardCharts;
