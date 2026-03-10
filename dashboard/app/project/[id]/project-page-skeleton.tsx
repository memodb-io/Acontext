"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KeyRound, Loader2 } from "lucide-react";
import { encodeId } from "@/lib/id-codec";

interface ProjectPageSkeletonProps {
  projectId?: string;
  showOverlay?: boolean;
  showDialog?: boolean;
  showLoading?: boolean;
}

// Chart card skeleton component
function ChartCardSkeleton({ title }: { title: string }) {
  return (
    <Card className="bg-surface-100 rounded-md border shadow-sm overflow-hidden mb-0 md:mb-0">
      <CardContent>
        <div className="flex flex-col gap-y-3">
          <div className="grow flex justify-between items-start min-h-16">
            <div className="flex flex-col gap-2">
              <h3 className="text-foreground-lighter text-sm">{title}</h3>
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
          <Skeleton className="h-[160px] w-full rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

export function ProjectPageSkeleton({
  projectId,
  showOverlay = true,
  showDialog = false,
  showLoading = false,
}: ProjectPageSkeletonProps) {
  return (
    <div className="h-full relative">
      {/* Overlay with blur effect */}
      {showOverlay && (
        <div className="fixed inset-0 z-9 bg-background/60 backdrop-blur-[2px] flex items-center justify-center px-4 pointer-events-none">
          {/* Loading spinner - shown when loading data */}
          {showLoading && !showDialog && (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          )}
          {/* Dialog for creating API key - only shown when showDialog is true */}
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
              {projectId ? (
                <div className="flex gap-3">
                  <Button asChild>
                    <Link href={`/project/${encodeId(projectId)}/onboarding`}>Get Started</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/project/${encodeId(projectId)}/api-keys`}>Create API Key</Link>
                  </Button>
                </div>
              ) : (
                <Button disabled>Create API Key</Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Header Section with Border */}
      <div className="animate-pulse py-16 border-b border-muted">
        <div className="mx-auto max-w-6xl px-4 w-full">
          <div className="flex flex-col gap-y-4">
            <div className="flex flex-col md:flex-row md:items-center gap-6 justify-between w-full">
              {/* Title */}
              <div className="flex flex-col md:flex-row md:items-end gap-3 w-full">
                <div>
                  <h1 className="text-3xl text-muted-foreground">Project Dashboard</h1>
                </div>
              </div>

              {/* Statistics */}
              <div className="flex items-center">
                <div className="flex items-center gap-x-6">
                  <div className="flex flex-col gap-y-1">
                    <span className="text-foreground-light text-sm">Tasks</span>
                    <Skeleton className="h-8 w-16" />
                  </div>
                  <div className="flex flex-col gap-y-1">
                    <span className="text-foreground-light text-sm">Skills</span>
                    <Skeleton className="h-8 w-16" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="animate-pulse mx-auto max-w-6xl px-4 py-8 w-full">
        <div className="space-y-6">
          {/* Time Range Selector */}
          <div className="flex flex-row items-center gap-x-2">
            <div className="h-[26px] text-xs px-2.5 py-1 w-[180px] border rounded-md flex items-center">
              Last 7 days
            </div>
            <span className="text-xs text-foreground-light">Statistics for last 7 days</span>
          </div>

          {/* Charts section - Grid layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 xl:grid-cols-3">
            <ChartCardSkeleton title="Task Success Rate" />
            <ChartCardSkeleton title="Task Status Distribution" />
            <ChartCardSkeleton title="Session Avg Message Turns" />
            <ChartCardSkeleton title="Session Avg Task Count" />
            <ChartCardSkeleton title="Task Avg Message Turns" />
            <ChartCardSkeleton title="Storage Usage" />
          </div>

          {/* New counts section - 3 charts in one row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 xl:grid-cols-3">
            <ChartCardSkeleton title="New Sessions" />
            <ChartCardSkeleton title="New Disks" />
            <ChartCardSkeleton title="New Spaces" />
          </div>
        </div>
      </div>
    </div>
  );
}
