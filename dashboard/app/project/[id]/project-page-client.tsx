"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTopNavStore } from "@/stores/top-nav";
import { Organization, Project } from "@/types";
import { encodeId } from "@/lib/id-codec";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { KeyRound } from "lucide-react";
import {
  validateDashboardAccess,
  fetchProjectStatistics,
  fetchDashboardGroup,
} from "./actions";

const CHART_GROUPS: Record<string, string[]> = {
  tasks: ["task_success", "task_status", "task_stats"],
  session_metrics: ["session_message", "session_task"],
  task_metrics: ["task_message"],
  storage: ["storage"],
  counts: ["new_sessions", "new_disks"],
};
import type { DashboardData, TimeRange } from "./actions";
import DashboardCharts from "./dashboard-charts";
import type { LoadingGroups } from "./dashboard-charts";

const ALL_LOADING: LoadingGroups = {
  tasks: true,
  session_metrics: true,
  task_metrics: true,
  storage: true,
  counts: true,
};

interface ProjectPageClientProps {
  project: Project;
  currentOrganization: Organization;
  allOrganizations: Organization[];
  projects: Project[];
}

export function ProjectPageClient({
  project,
  currentOrganization,
  allOrganizations,
  projects,
}: ProjectPageClientProps) {
  const { initialize, setHasSidebar } = useTopNavStore();
  const [timeRange, setTimeRange] = useState<TimeRange>("7");
  const [taskCount, setTaskCount] = useState<number | null>(null);
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  // Per-group state
  const [tasksData, setTasksData] = useState<Partial<DashboardData> | null>(null);
  const [sessionMetricsData, setSessionMetricsData] = useState<Partial<DashboardData> | null>(null);
  const [taskMetricsData, setTaskMetricsData] = useState<Partial<DashboardData> | null>(null);
  const [storageData, setStorageData] = useState<Partial<DashboardData> | null>(null);
  const [countsData, setCountsData] = useState<Partial<DashboardData> | null>(null);
  const [loadingGroups, setLoadingGroups] = useState<LoadingGroups>(ALL_LOADING);

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
  }, [project, currentOrganization, allOrganizations, projects, initialize, setHasSidebar]);

  const prevTimeRangeRef = useRef(timeRange);

  // Fire all 5 group fetches. Each resolves independently via .then()
  const fetchAllGroups = useCallback(
    (tr: TimeRange, isMountedRef: { current: boolean }) => {
      setLoadingGroups(ALL_LOADING);

      const setGroupLoading = (key: keyof LoadingGroups, value: boolean) => {
        if (isMountedRef.current) {
          setLoadingGroups((prev) => ({ ...prev, [key]: value }));
        }
      };

      fetchDashboardGroup(project.id, tr, CHART_GROUPS.tasks).then((data) => {
        if (isMountedRef.current) {
          setTasksData(data);
          setGroupLoading("tasks", false);
        }
      });

      fetchDashboardGroup(project.id, tr, CHART_GROUPS.session_metrics).then((data) => {
        if (isMountedRef.current) {
          setSessionMetricsData(data);
          setGroupLoading("session_metrics", false);
        }
      });

      fetchDashboardGroup(project.id, tr, CHART_GROUPS.task_metrics).then((data) => {
        if (isMountedRef.current) {
          setTaskMetricsData(data);
          setGroupLoading("task_metrics", false);
        }
      });

      fetchDashboardGroup(project.id, tr, CHART_GROUPS.storage).then((data) => {
        if (isMountedRef.current) {
          setStorageData(data);
          setGroupLoading("storage", false);
        }
      });

      fetchDashboardGroup(project.id, tr, CHART_GROUPS.counts).then((data) => {
        if (isMountedRef.current) {
          setCountsData(data);
          setGroupLoading("counts", false);
        }
      });
    },
    [project.id]
  );

  // Initial data loading
  useEffect(() => {
    const isMountedRef = { current: true };

    // 1. Validate access + check API key
    validateDashboardAccess(project.id).then((result) => {
      if (isMountedRef.current) {
        setHasApiKey(result.hasApiKey);
      }
    });

    // 2. Fetch statistics
    fetchProjectStatistics(project.id).then((result) => {
      if (isMountedRef.current) {
        if ("data" in result && result.data) {
          setTaskCount(result.data.taskCount);
          setSessionCount(result.data.sessionCount);
        }
        setStatsLoading(false);
      }
    });

    // 3. Fire 5 group fetches in parallel
    fetchAllGroups(timeRange, isMountedRef);

    return () => {
      isMountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // Re-fetch when timeRange changes
  useEffect(() => {
    if (prevTimeRangeRef.current === timeRange) {
      return;
    }
    prevTimeRangeRef.current = timeRange;

    const isMountedRef = { current: true };
    fetchAllGroups(timeRange, isMountedRef);

    return () => {
      isMountedRef.current = false;
    };
  }, [timeRange, fetchAllGroups]);

  // Any group still loading?
  const anyLoading = Object.values(loadingGroups).some(Boolean);

  // Show dialog only when confirmed no API key
  const showDialog = hasApiKey === false;

  return (
    <div className="h-full relative">
      {/* No API key dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-9 bg-background/60 flex items-center justify-center px-4 pointer-events-none">
          <div className="flex flex-col items-center gap-4 text-center px-6 py-8 w-full max-w-md rounded-xl bg-background border shadow-md mx-4 pointer-events-auto">
            <div className="rounded-full bg-muted p-4">
              <KeyRound className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Create Your First API Key</h3>
              <p className="text-muted-foreground text-sm">
                Generate an API key to start collecting dashboard statistics and unlock the full
                potential of your project.
              </p>
            </div>
            <div className="flex gap-3">
              <Button asChild>
                <Link href={`/project/${encodeId(project.id)}/onboarding`}>Get Started</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/project/${encodeId(project.id)}/api-keys`}>Create API Key</Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main content - always rendered, charts use mock data per-card when loading */}
      <div>
        {/* Header Section with Border */}
        <div className="py-16 border-b border-muted">
          <div className="mx-auto max-w-6xl px-4 w-full">
            <div className="flex flex-col gap-y-4">
              <div className="flex flex-col md:flex-row md:items-center gap-6 justify-between w-full">
                {/* Title */}
                <div className="flex flex-col md:flex-row md:items-end gap-3 w-full">
                  <div>
                    <h1 className="text-3xl">{project.name}</h1>
                  </div>
                </div>

                {/* Statistics */}
                <div className="flex items-center">
                  <div className="flex items-center gap-x-6">
                    <div className="flex flex-col gap-y-1">
                      <span className="transition text-foreground-light hover:text-foreground text-sm">
                        Sessions
                      </span>
                      {statsLoading ? (
                        <p className="text-2xl tabular-nums">...</p>
                      ) : (
                        <p className="text-2xl tabular-nums">{sessionCount ?? 0}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-y-1">
                      <span className="transition text-foreground-light hover:text-foreground text-sm">
                        Tasks
                      </span>
                      {statsLoading ? (
                        <p className="text-2xl tabular-nums">...</p>
                      ) : (
                        <p className="text-2xl tabular-nums">{taskCount ?? 0}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="mx-auto max-w-6xl px-4 py-8 w-full">
          <div className="space-y-6">
            {/* Time Range Selector */}
            <div className="flex flex-row items-center gap-x-2">
              <Select
                value={timeRange}
                onValueChange={(value) => setTimeRange(value as TimeRange)}
              >
                <SelectTrigger className="h-[26px] text-xs px-2.5 py-1 w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-foreground-light">
                Statistics for last {timeRange} days
              </span>
              {anyLoading && (
                <span className="text-xs text-muted-foreground ml-2">Loading...</span>
              )}
            </div>

            {/* Dashboard Charts - per-group data and loading */}
            <DashboardCharts
              tasksData={tasksData}
              sessionMetricsData={sessionMetricsData}
              taskMetricsData={taskMetricsData}
              storageData={storageData}
              countsData={countsData}
              loadingGroups={loadingGroups}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
