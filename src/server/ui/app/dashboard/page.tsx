"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts"
import { HardDrive, MessageSquare, ListChecks, Database, Users, Mail } from "lucide-react"
import { useTranslations } from "next-intl"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Time range type
type TimeRange = "7" | "30" | "90"

// Generate mock data for different time ranges
const generateDailyDiskUsage = (days: number) => {
  const data = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    data.push({
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      usage: Math.floor(Math.random() * 50) + 600, // 600-650 GB
    })
  }
  return data
}

const generateMessageTokenData = (days: number) => {
  const data = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    data.push({
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      tokens: Math.floor(Math.random() * 5000) + 40000, // 40000-45000
    })
  }
  return data
}

const generateAvgTokenPerMessage = (days: number) => {
  const data = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    data.push({
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      avgTokens: Math.floor(Math.random() * 50) + 100, // 100-150 tokens per message
    })
  }
  return data
}

// Task status data - stacked bar chart format
const generateTaskStatusData = (days: number) => {
  const data = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    data.push({
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      completed: Math.floor(Math.random() * 20) + 10,
      inProgress: Math.floor(Math.random() * 5) + 2,
      pending: Math.floor(Math.random() * 10) + 5,
      failed: Math.floor(Math.random() * 3) + 1,
    })
  }
  return data
}

const chartConfig = {
  tokens: {
    label: "Tokens",
    color: "#3b82f6",
  },
  usage: {
    label: "Usage",
    color: "#3b82f6",
  },
  quota: {
    label: "Quota",
    color: "#e5e7eb",
  },
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

  // Mock statistics
  const totalDiskUsage = 650 // GB
  const totalTokens = 371000
  const totalTasks = 247
  const totalSpaces = 5
  const totalSessions = 128
  const totalMessages = 3542

  // Generate data based on selected time range
  const days = useMemo(() => parseInt(timeRange), [timeRange])
  const dailyDiskUsage = useMemo(() => generateDailyDiskUsage(days), [days])
  const messageTokenData = useMemo(() => generateMessageTokenData(days), [days])
  const taskStatusData = useMemo(() => generateTaskStatusData(days), [days])
  const avgTokenPerMessageData = useMemo(() => generateAvgTokenPerMessage(days), [days])

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
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Disk usage card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("diskUsage")}</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDiskUsage} GB</div>
            <p className="text-xs text-muted-foreground">
              {t("diskUsageDetail")}
            </p>
          </CardContent>
        </Card>

        {/* Total tokens card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("totalTokens")}</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTokens.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {t("totalTokensDetail")}
            </p>
          </CardContent>
        </Card>

        {/* Total tasks card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("totalTasks")}</CardTitle>
            <ListChecks className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTasks}</div>
            <p className="text-xs text-muted-foreground">
              {t("totalTasksDetail", { completed: 145, inProgress: 32 })}
            </p>
          </CardContent>
        </Card>

        {/* Total spaces card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("totalSpaces")}</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSpaces}</div>
            <p className="text-xs text-muted-foreground">
              {t("totalSpacesDetail")}
            </p>
          </CardContent>
        </Card>

        {/* Total sessions card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("totalSessions")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSessions}</div>
            <p className="text-xs text-muted-foreground">
              {t("totalSessionsDetail")}
            </p>
          </CardContent>
        </Card>

        {/* Total messages card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("totalMessages")}</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMessages.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {t("totalMessagesDetail")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts section - 2x2 grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Daily disk usage bar chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t("diskUsageChart")}</CardTitle>
            <CardDescription>{t("diskUsageChartDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <BarChart data={dailyDiskUsage}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="usage"
                  fill="#3b82f6"
                  name={t("usage")}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Task status distribution stacked bar chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t("taskStatusChart")}</CardTitle>
            <CardDescription>{t("taskStatusChartDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <BarChart data={taskStatusData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
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
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Message token trend line chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t("tokenTrendChart")}</CardTitle>
            <CardDescription>{t("tokenTrendChartDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <LineChart data={messageTokenData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="tokens"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6" }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Average token per message line chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t("avgTokenPerMessageChart")}</CardTitle>
            <CardDescription>{t("avgTokenPerMessageChartDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <LineChart data={avgTokenPerMessageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="avgTokens"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: "#10b981" }}
                  name={t("avgTokens")}
                />
              </LineChart>
            </ChartContainer>
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
                <tr className="border-b">
                  <td className="p-2">{t("completed")}</td>
                  <td className="text-right p-2">145</td>
                  <td className="text-right p-2">58.7%</td>
                  <td className="text-right p-2">2.3 {t("minutes")}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">{t("inProgress")}</td>
                  <td className="text-right p-2">32</td>
                  <td className="text-right p-2">13.0%</td>
                  <td className="text-right p-2">-</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">{t("pending")}</td>
                  <td className="text-right p-2">58</td>
                  <td className="text-right p-2">23.5%</td>
                  <td className="text-right p-2">-</td>
                </tr>
                <tr>
                  <td className="p-2">{t("failed")}</td>
                  <td className="text-right p-2">12</td>
                  <td className="text-right p-2">4.9%</td>
                  <td className="text-right p-2">1.8 {t("minutes")}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
