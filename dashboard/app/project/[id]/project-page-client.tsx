"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { KeyRound, Loader2 } from "lucide-react";
import { fetchDashboardData, fetchInitialDashboardData } from "./actions";
import type { DashboardData, TimeRange } from "./actions";
import DashboardCharts from "./dashboard-charts";

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
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [taskCount, setTaskCount] = useState<number | null>(null);
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  useEffect(() => {
    // Initialize top-nav state when page loads
    initialize({
      title: "",
      organization: currentOrganization,
      project: project,
      organizations: allOrganizations,
      projects: projects,
      hasSidebar: true,
    });

    // Cleanup: reset hasSidebar when leaving this page
    return () => {
      setHasSidebar(false);
    };
  }, [project, currentOrganization, allOrganizations, projects, initialize, setHasSidebar]);

  // Track previous timeRange to detect changes
  const prevTimeRangeRef = useRef(timeRange);

  // Initial data loading - single server action that validates once and fetches all data in parallel
  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      setStatsLoading(true);
      setIsLoading(true);

      try {
        // Single server action - validates once, fetches all data in parallel
        const result = await fetchInitialDashboardData(project.id, timeRange);

        if (isMounted) {
          setHasApiKey(result.hasApiKey);

          if (result.statistics) {
            setTaskCount(result.statistics.taskCount);
            setSessionCount(result.statistics.sessionCount);
          }
          setStatsLoading(false);

          setDashboardData(result.dashboardData);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to fetch initial dashboard data", error);
        if (isMounted) {
          setHasApiKey(false);
          setStatsLoading(false);
          setIsLoading(false);
        }
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // Fetch dashboard data when timeRange changes
  useEffect(() => {
    // Skip if timeRange hasn't changed (initial load already fetched it)
    if (prevTimeRangeRef.current === timeRange) {
      return;
    }
    prevTimeRangeRef.current = timeRange;

    let isMounted = true;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const data = await fetchDashboardData(project.id, timeRange);
        if (isMounted) {
          setDashboardData(data);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
        if (isMounted) {
          setDashboardData(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [project.id, timeRange]);

  // Memoized data checks
  const chartDataFlags = useMemo(() => {
    if (!dashboardData) {
      return {
        hasTaskSuccessRateData: false,
        hasTaskStatusDistributionData: false,
        hasSessionAvgMessageTurnsData: false,
        hasSessionAvgTasksData: false,
        hasTaskAvgMessageTurnsData: false,
        hasStorageUsageData: false,
        hasNewSessionsData: false,
        hasNewDisksData: false,
      };
    }
    return {
      hasTaskSuccessRateData: dashboardData.task_success.some((point) => point.success_rate > 0),
      hasTaskStatusDistributionData: dashboardData.task_status.some(
        (point) =>
          point.completed > 0 || point.in_progress > 0 || point.pending > 0 || point.failed > 0
      ),
      hasSessionAvgMessageTurnsData: dashboardData.session_message.some(
        (point) => point.avg_message_turns > 0
      ),
      hasSessionAvgTasksData: dashboardData.session_task.some((point) => point.avg_tasks > 0),
      hasTaskAvgMessageTurnsData: dashboardData.task_message.some((point) => point.avg_turns > 0),
      hasStorageUsageData: dashboardData.storage.some((point) => point.usage_bytes > 0),
      hasNewSessionsData: dashboardData.new_sessions.some((point) => point.count > 0),
      hasNewDisksData: dashboardData.new_disks.some((point) => point.count > 0),
    };
  }, [dashboardData]);

  // Determine if we should show the overlay
  const showOverlay = hasApiKey === null || hasApiKey === false || isLoading;
  const showDialog = hasApiKey === false;
  const showLoadingSpinner = (hasApiKey === null || isLoading) && !showDialog;

  return (
    <div className="h-full relative">
      {/* Overlay layer - shown during loading or when no API key */}
      {showOverlay && (
        <div
          className={`fixed inset-0 z-9 bg-background/60 backdrop-blur-[2px] flex items-center justify-center px-4 pointer-events-none transition-opacity duration-300 ${
            !isLoading && hasApiKey ? "opacity-0" : "opacity-100"
          }`}
        >
          {/* Loading spinner */}
          {showLoadingSpinner && (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          )}

          {/* Dialog for creating API key */}
          {showDialog && (
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
          )}
        </div>
      )}

      {/* Main content - always rendered, charts use mock data when loading */}
      <div className={!isLoading && hasApiKey ? "animate-in fade-in duration-300" : ""}>
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
              {isLoading && (
                <span className="text-xs text-muted-foreground ml-2">Loading...</span>
              )}
            </div>

            {/* Dashboard Charts - Always rendered, uses mock data when loading */}
            <DashboardCharts
              dashboardData={dashboardData}
              chartDataFlags={chartDataFlags}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
