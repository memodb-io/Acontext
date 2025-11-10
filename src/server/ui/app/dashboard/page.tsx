"use client"

import { useEffect, useMemo, useState, type ReactElement } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts"
import { useTranslations } from "next-intl"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { fetchDashboardData } from "./actions"
import type { DashboardData, TimeRange } from "./actions"

const getDaysFromRange = (timeRange: TimeRange) => parseInt(timeRange, 10)

const buildDateLabels = (days: number) => {
  const now = new Date()
  const labels: string[] = []

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    labels.push(`${date.getMonth() + 1}/${date.getDate()}`)
  }

  return labels
}

const createPlaceholderData = (timeRange: TimeRange): DashboardData => {
  const days = getDaysFromRange(timeRange)
  const labels = buildDateLabels(days)

  return {
    taskSuccessRate: labels.map((label) => ({ date: label, successRate: 0 })),
    taskStatusDistribution: labels.map((label) => ({
      date: label,
      completed: 0,
      inProgress: 0,
      pending: 0,
      failed: 0,
    })),
    sessionAvgMessageTurns: [],
    sessionAvgTasks: [],
    taskAvgMessageTurns: [],
    storageUsage: labels.map((label) => ({
      date: label,
      usage: 0,
    })),
    taskStatistics: [],
  }
}

const baseChartConfig = {
  completed: {
    label: "Completed",
    color: "#10b981",
  },
  inProgress: {
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
}

export default function DashboardPage() {
  const t = useTranslations("dashboard")
  const [timeRange, setTimeRange] = useState<TimeRange>("7")
  const [dashboardData, setDashboardData] = useState<DashboardData>(() =>
    createPlaceholderData("7")
  )
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      setIsLoading(true)
      try {
        const data = await fetchDashboardData(timeRange)
        if (isMounted) {
          setDashboardData(data)
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data", error)
        if (isMounted) {
          setDashboardData(createPlaceholderData(timeRange))
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    setDashboardData(createPlaceholderData(timeRange))
    loadData()

    return () => {
      isMounted = false
    }
  }, [timeRange])

  const hasTaskSuccessRateData = useMemo(
    () => dashboardData.taskSuccessRate.some((point) => point.successRate > 0),
    [dashboardData.taskSuccessRate]
  )
  const hasTaskStatusDistributionData = useMemo(
    () =>
      dashboardData.taskStatusDistribution.some(
        (point) =>
          point.completed > 0 ||
          point.inProgress > 0 ||
          point.pending > 0 ||
          point.failed > 0
      ),
    [dashboardData.taskStatusDistribution]
  )
  const hasSessionAvgMessageTurnsData = useMemo(
    () =>
      dashboardData.sessionAvgMessageTurns.some(
        (point) => point.avgMessageTurns > 0
      ),
    [dashboardData.sessionAvgMessageTurns]
  )
  const hasSessionAvgTasksData = useMemo(
    () =>
      dashboardData.sessionAvgTasks.some((point) => point.avgTasks > 0),
    [dashboardData.sessionAvgTasks]
  )
  const hasTaskAvgMessageTurnsData = useMemo(
    () =>
      dashboardData.taskAvgMessageTurns.some((point) => point.avgTurns > 0),
    [dashboardData.taskAvgMessageTurns]
  )
  const hasStorageUsageData = useMemo(
    () => dashboardData.storageUsage.some((point) => point.usage > 0),
    [dashboardData.storageUsage]
  )

  const chartConfig = useMemo(
    () => ({
      ...baseChartConfig,
      successRate: {
        label: t("successRate"),
        color: "#10b981",
      },
      avgMessageTurns: {
        label: t("avgMessageTurns"),
        color: "#6366f1",
      },
      avgTasks: {
        label: t("avgTasks"),
        color: "#f59e0b",
      },
      avgTurns: {
        label: t("avgTaskMessageTurns"),
        color: "#6366f1",
      },
      usage: {
        label: t("storageUsage"),
        color: "#3b82f6",
      },
    }),
    [t]
  )

  const renderChart = (hasData: boolean, chart: ReactElement) =>
    hasData ? (
      <ChartContainer config={chartConfig} className="h-[300px]">
        {chart}
      </ChartContainer>
    ) : (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        {t("noData")}
      </div>
    )

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page header with title and time range selector */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t("timeRange")}:</span>
          <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{t("7days")}</SelectItem>
              <SelectItem value="30">{t("30days")}</SelectItem>
              <SelectItem value="90">{t("90days")}</SelectItem>
            </SelectContent>
          </Select>
          {isLoading && (
            <span className="text-xs text-muted-foreground">Loading...</span>
          )}
        </div>
      </div>

      {/* Charts section - 3 rows */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Task success rate line chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t("taskSuccessRateChart")}</CardTitle>
            <CardDescription>{t("taskSuccessRateChartDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
          {renderChart(
            hasTaskSuccessRateData,
            (
              <LineChart data={dashboardData.taskSuccessRate} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  width={50}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => {
                        const numericValue = Array.isArray(value)
                          ? Number(value[0])
                          : typeof value === "number"
                            ? value
                            : Number(value)
                        if (!Number.isFinite(numericValue)) {
                          return value ?? "-"
                        }
                        return `${numericValue.toFixed(1)}%`
                      }}
                    />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="successRate"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: "#10b981" }}
                  name={t("successRate")}
                />
              </LineChart>
            )
          )}
          </CardContent>
        </Card>

        {/* Task status distribution stacked bar chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t("taskStatusChart")}</CardTitle>
            <CardDescription>{t("taskStatusChartDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
          {renderChart(
            hasTaskStatusDistributionData,
            (
              <BarChart data={dashboardData.taskStatusDistribution} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis width={50} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="completed"
                  stackId="a"
                  fill="#10b981"
                  name={t("completed")}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="inProgress"
                  stackId="a"
                  fill="#3b82f6"
                  name={t("inProgress")}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="pending"
                  stackId="a"
                  fill="#f59e0b"
                  name={t("pending")}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="failed"
                  stackId="a"
                  fill="#ef4444"
                  name={t("failed")}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            )
          )}
          </CardContent>
        </Card>

        {/* Average message turns per session bar chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t("sessionAvgMessageTurnChart")}</CardTitle>
            <CardDescription>{t("sessionAvgMessageTurnChartDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
          {renderChart(
            hasSessionAvgMessageTurnsData,
            (
              <BarChart data={dashboardData.sessionAvgMessageTurns} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis width={50} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="avgMessageTurns"
                  fill="#6366f1"
                  name={t("avgMessageTurns")}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            )
          )}
          </CardContent>
        </Card>

        {/* Average tasks per session bar chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t("sessionAvgTaskCountChart")}</CardTitle>
            <CardDescription>{t("sessionAvgTaskCountChartDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
          {renderChart(
            hasSessionAvgTasksData,
            (
              <BarChart data={dashboardData.sessionAvgTasks} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis width={50} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="avgTasks"
                  fill="#f59e0b"
                  name={t("avgTasks")}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            )
          )}
          </CardContent>
        </Card>

        {/* Average message turns per task bar chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t("taskAvgMessageTurnChart")}</CardTitle>
            <CardDescription>{t("taskAvgMessageTurnChartDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
          {renderChart(
            hasTaskAvgMessageTurnsData,
            (
              <BarChart data={dashboardData.taskAvgMessageTurns} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis width={50} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="avgTurns"
                  fill="#6366f1"
                  name={t("avgTaskMessageTurns")}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            )
          )}
          </CardContent>
        </Card>

        {/* Storage usage bar chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t("storageUsageChart")}</CardTitle>
            <CardDescription>{t("storageUsageChartDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
          {renderChart(
            hasStorageUsageData,
            (
              <BarChart data={dashboardData.storageUsage} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis width={50} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => {
                        const numericValue = Array.isArray(value)
                          ? Number(value[0])
                          : typeof value === "number"
                            ? value
                            : Number(value)
                        if (!Number.isFinite(numericValue)) {
                          return value ?? "-"
                        }
                        return `${numericValue.toFixed(2)} KB`
                      }}
                    />
                  }
                />
                <Bar
                  dataKey="usage"
                  fill="#3b82f6"
                  name={t("storageUsage")}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            )
          )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed task statistics table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("taskDetailTable")}</CardTitle>
          <CardDescription>{t("taskDetailTableDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {dashboardData.taskStatistics.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">{t("status")}</th>
                    <th className="text-right p-2">{t("count")}</th>
                    <th className="text-right p-2">{t("percentage")}</th>
                    <th className="text-right p-2">{t("avgTime")}</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.taskStatistics.map((stat, index) => (
                    <tr key={stat.status} className={index < dashboardData.taskStatistics.length - 1 ? "border-b" : ""}>
                      <td className="p-2">
                        {stat.status === "success"
                          ? t("completed")
                          : stat.status === "running"
                            ? t("inProgress")
                            : stat.status === "pending"
                              ? t("pending")
                              : stat.status === "failed"
                                ? t("failed")
                                : stat.status}
                      </td>
                      <td className="text-right p-2">{stat.count}</td>
                      <td className="text-right p-2">{stat.percentage}%</td>
                      <td className="text-right p-2">
                        {stat.avgTime !== null ? `${stat.avgTime} ${t("minutes")}` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex h-[150px] items-center justify-center text-sm text-muted-foreground">
              {t("noData")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
