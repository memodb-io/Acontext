"use client";

import { useEffect } from "react";

import { useTopNavStore } from "@/stores/top-nav";
import { usePlanStore } from "@/stores/plan";
import { Organization } from "@/types";
import { OrganizationUsageData } from "@/lib/supabase/operations/organizations";
import { formatBytes } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlanType } from "@/stores/plan";

interface UsagePageClientProps {
  currentOrganization: Organization;
  allOrganizations: Array<{ id: string; name: string; plan: PlanType }>;
  usageData: OrganizationUsageData;
}

function getProgressColor(percentage: number): string {
  if (percentage >= 90) return "bg-red-500";
  if (percentage >= 70) return "bg-amber-500";
  return "";
}

interface UsageMetric {
  label: string;
  description: string;
  current: number;
  max: number;
  formatValue?: (v: number) => string;
}

function UsageCard({ metric }: { metric: UsageMetric }) {
  const percentage = metric.max > 0 ? Math.min((metric.current / metric.max) * 100, 100) : 0;
  const format = metric.formatValue || ((v: number) => v.toLocaleString());
  const colorClass = getProgressColor(percentage);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{metric.label}</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {metric.description}
            </CardDescription>
          </div>
          <span className="text-sm text-muted-foreground tabular-nums">
            {format(metric.current)} / {metric.max > 0 ? format(metric.max) : "∞"}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${colorClass || "bg-primary"}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {percentage >= 90 && metric.max > 0 && (
          <p className="text-xs text-red-500 mt-2">
            {percentage >= 100
              ? "Quota exceeded. Upgrade your plan to continue."
              : "Approaching quota limit."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function UsagePageClient({
  currentOrganization,
  allOrganizations,
  usageData,
}: UsagePageClientProps) {
  const { initialize, setHasSidebar } = useTopNavStore();
  const { getPriceByProduct, getPlanDisplayName: getPlanDisplayNameFromPrice } =
    usePlanStore();

  useEffect(() => {
    initialize({
      title: "",
      organization: currentOrganization,
      project: null,
      organizations: allOrganizations,
      projects: [],
      hasSidebar: true,
    });

    return () => {
      setHasSidebar(false);
    };
  }, [currentOrganization, allOrganizations, initialize, setHasSidebar]);

  const getPlanDisplayName = (plan: string | undefined) => {
    if (!plan || plan === "free") return "Free Plan";
    const priceInfo = getPriceByProduct(plan);
    if (priceInfo) {
      const displayName = getPlanDisplayNameFromPrice(priceInfo);
      return `${displayName} Plan`;
    }
    return `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`;
  };

  const { usage, limits, period_end } = usageData;

  const metrics: UsageMetric[] = [
    {
      label: "Agent Tasks",
      description: "Total agent tasks created this billing period",
      current: usage.current_task,
      max: limits.max_task,
    },
    {
      label: "Storage",
      description: "Total storage used across all projects",
      current: usage.current_storage,
      max: limits.max_storage,
      formatValue: formatBytes,
    },
  ];

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold">Usage</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Resource usage for the current billing period.
          </p>
        </div>

        {/* Plan & Period */}
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="text-base px-4 py-1">
                  {getPlanDisplayName(currentOrganization.plan)}
                </Badge>
              </div>
              {period_end && (
                <p className="text-sm text-muted-foreground">
                  Current period ends{" "}
                  <span className="font-medium text-foreground">
                    {new Date(period_end).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Usage Metrics */}
        {metrics.map((metric) => (
          <UsageCard key={metric.label} metric={metric} />
        ))}
      </div>
    </div>
  );
}
