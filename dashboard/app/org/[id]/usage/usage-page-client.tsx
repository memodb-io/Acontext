"use client";

import { useEffect, useState, useMemo } from "react";

import { useTopNavStore } from "@/stores/top-nav";
import { usePlanStore } from "@/stores/plan";
import { Organization } from "@/types";
import { OrganizationUsageData } from "@/lib/supabase/operations/organizations";
import {
  getUpcomingInvoice,
  type OverageLineItem,
} from "@/lib/supabase/operations/prices";
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

function formatCurrency(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amountCents / 100);
}

interface UsageMetric {
  label: string;
  description: string;
  current: number;
  max: number;
  metricKey?: string;
  formatValue?: (v: number) => string;
}

interface OverageInfo {
  quantity: number;
  amount: number;
  unitAmount: number;
  currency: string;
}

function UsageCard({
  metric,
  isFreePlan,
  overage,
}: {
  metric: UsageMetric;
  isFreePlan: boolean;
  overage?: OverageInfo;
}) {
  const percentage =
    metric.max > 0
      ? Math.min((metric.current / metric.max) * 100, 100)
      : 0;
  const format = metric.formatValue || ((v: number) => v.toLocaleString());
  // Paid plans use pay-per-use overage — no alarming colors
  const colorClass = isFreePlan ? getProgressColor(percentage) : "";

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
            {format(metric.current)} /{" "}
            {metric.max > 0 ? format(metric.max) : "∞"}
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
        {isFreePlan && percentage >= 90 && metric.max > 0 && (
          <p className="text-xs mt-2 text-red-500">
            {percentage >= 100
              ? "Quota exceeded. Upgrade your plan to continue."
              : "Approaching quota limit."}
          </p>
        )}
        {/* Overage details for paid plans */}
        {!isFreePlan && overage && overage.quantity > 0 && (
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>
              Overage: {overage.quantity.toLocaleString()} units
            </span>
            <span className="tabular-nums font-medium">
              {formatCurrency(overage.amount, overage.currency)}
            </span>
          </div>
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

  const isFreePlan =
    currentOrganization.plan === "free" || !currentOrganization.plan;

  // Overage data for paid plans
  const [overageData, setOverageData] = useState<{
    lineItems: OverageLineItem[];
    totalOverage: number;
    currency: string;
  } | null>(null);
  const [overageLoading, setOverageLoading] = useState(!isFreePlan && !!currentOrganization.id);

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

  // Fetch overage data for paid plans
  useEffect(() => {
    if (isFreePlan || !currentOrganization.id) return;

    let cancelled = false;

    getUpcomingInvoice(currentOrganization.id).then((result) => {
      if (cancelled) return;
      if (result.data) {
        setOverageData({
          lineItems: result.data.line_items,
          totalOverage: result.data.total_overage,
          currency: result.data.currency,
        });
      }
      setOverageLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isFreePlan, currentOrganization.id]);

  // Build overage lookup by metric_key
  const overageByMetric = useMemo(() => {
    if (!overageData) return new Map<string, OverageInfo>();
    const map = new Map<string, OverageInfo>();
    for (const item of overageData.lineItems) {
      map.set(item.metric_key, {
        quantity: item.quantity,
        amount: item.amount,
        unitAmount: item.unit_amount,
        currency: overageData.currency,
      });
    }
    return map;
  }, [overageData]);

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
      metricKey: "current_task",
    },
    {
      label: "Storage",
      description: "Total storage used across all projects",
      current: usage.current_storage,
      max: limits.max_storage,
      metricKey: "current_storage",
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
          <UsageCard
            key={metric.label}
            metric={metric}
            isFreePlan={isFreePlan}
            overage={
              metric.metricKey
                ? overageByMetric.get(metric.metricKey)
                : undefined
            }
          />
        ))}

        {/* Overage Summary for paid plans */}
        {!isFreePlan && overageData && overageData.totalOverage > 0 && (
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    Estimated Overage This Period
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Usage beyond included quota, billed at period end
                  </p>
                </div>
                <span className="text-lg font-semibold tabular-nums">
                  {formatCurrency(
                    overageData.totalOverage,
                    overageData.currency
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading indicator for overage */}
        {!isFreePlan && overageLoading && (
          <p className="text-xs text-muted-foreground text-center">
            Loading overage details...
          </p>
        )}
      </div>
    </div>
  );
}
