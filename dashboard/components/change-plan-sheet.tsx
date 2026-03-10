"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink } from "lucide-react";
import { Organization } from "@/types";
import { Price, PlanDescription, usePlanStore, normalizePlan } from "@/stores/plan";
import { encodeId } from "@/lib/id-codec";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChangePlanConfirmDialog } from "./change-plan-confirm-dialog";
import { PaymentMethod } from "@/lib/supabase/operations/prices";

interface ChangePlanSheetProps {
  organization: Organization;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pricingUrl?: string;
  paymentMethods?: PaymentMethod[];
}

export function ChangePlanSheet({
  organization,
  open,
  onOpenChange,
  pricingUrl = "https://acontext.io/pricing",
  paymentMethods = [],
}: ChangePlanSheetProps) {
  const router = useRouter();
  const { getAllPricesWithFree, formatPrice, getPlanDisplayName, getPriceByProduct, getPlanByProduct, getDescriptionByProduct } = usePlanStore();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Price | null>(null);

  const allPrices = getAllPricesWithFree();
  const currentPlan = normalizePlan(organization.plan);

  // Get the current plan's price object for comparison
  const currentPlanPrice = getPriceByProduct(currentPlan);

  const handlePlanClick = (plan: Price) => {
    // Don't open dialog if it's the current plan
    if (isCurrentPlan(plan)) {
      return;
    }

    // Check if this is an upgrade (from free to paid plan)
    const currentRank = currentPlanPrice?.rank ?? 0;
    const targetRank = plan.rank ?? 0;
    const isUpgrade = targetRank > currentRank;
    const isPaidPlan = plan.unit_amount > 0;
    const hasNoPaymentMethods = paymentMethods.length === 0;

    // If upgrading to a paid plan and no payment methods, redirect to payment page
    if (isUpgrade && isPaidPlan && hasNoPaymentMethods) {
      const encodedOrgId = encodeId(organization.id!);
      router.push(`/new/${encodedOrgId}/payment?plan=${plan.product}`);
      onOpenChange(false);
      return;
    }

    setSelectedPlan(plan);
    setConfirmDialogOpen(true);
  };

  const handleConfirmSuccess = () => {
    setConfirmDialogOpen(false);
    onOpenChange(false);
    // Optionally refresh the page or update the organization data
    window.location.reload();
  };

  const getPlanDescription = (productId: string): PlanDescription | null => {
    return getDescriptionByProduct(productId);
  };

  const isCurrentPlan = (plan: Price): boolean => {
    // Compare by product ID - currentPlanPrice is looked up from currentPlan
    if (currentPlanPrice) {
      return plan.product === currentPlanPrice.product;
    }
    // Fallback: compare plan types
    const planType = getPlanByProduct(plan.product);
    return planType === currentPlan;
  };

  const getActionButtonText = (plan: Price): string => {
    if (isCurrentPlan(plan)) {
      return "Current plan";
    }

    // Use Price.rank to determine upgrade/downgrade
    const currentRank = currentPlanPrice?.rank ?? 0;
    const targetRank = plan.rank ?? 0;

    const planName = getPlanDisplayName(plan);
    if (targetRank > currentRank) {
      return `Upgrade to ${planName}`;
    } else {
      return `Downgrade to ${planName}`;
    }
  };

  const getActionButtonVariant = (plan: Price): "default" | "outline" | "secondary" => {
    if (isCurrentPlan(plan)) {
      return "outline";
    }
    if (plan.product === "free") {
      return "outline";
    }
    return "default";
  };

  // Sort plans by rank (prices from API are already sorted by rank, but we need to ensure free plan is first)
  const sortedPlans = allPrices.sort((a, b) => {
    // Free plan always comes first
    if (a.product === "free") return -1;
    if (b.product === "free") return 1;
    // Then sort by rank (lower rank comes first)
    return a.rank - b.rank;
  });

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-screen sm:min-w-[600px] md:min-w-[800px] lg:min-w-[1000px] xl:min-w-[1200px] overflow-y-auto"
        >
          <SheetHeader className="space-y-1 py-4 border-b pr-12">
            <div className="flex items-center justify-between">
              <SheetTitle>Change subscription plan for {organization.name}</SheetTitle>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="text-xs"
              >
                <a href={pricingUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Pricing
                </a>
              </Button>
            </div>
          </SheetHeader>

          <div className="px-4 sm:px-6">
            <div className="py-6 grid grid-cols-12 gap-3 items-stretch">
              {/* Plan Cards */}
              {sortedPlans.map((plan) => {
                const planDescription = getPlanDescription(plan.product);
                const isCurrent = isCurrentPlan(plan);
                const planName = plan.product === "free"
                  ? "Free"
                  : getPlanDisplayName(plan).toUpperCase();

                return (
                  <div
                    key={plan.id}
                    className="px-4 py-4 flex flex-col items-start justify-between border rounded-md col-span-12 md:col-span-4 bg-card h-full"
                  >
                    <div className="w-full">
                      <div className="flex items-center space-x-2">
                        <p className="text-primary text-sm uppercase">{planName}</p>
                        {isCurrent && (
                          <Badge variant="secondary" className="text-xs bg-muted text-foreground-light rounded px-2 py-0.5">
                            Current plan
                          </Badge>
                        )}
                      </div>

                      <div className="mt-4 flex items-center space-x-1 mb-4">
                        {plan.unit_amount > 0 && <p className="text-muted-foreground text-sm">From</p>}
                        <p className="text-foreground text-lg" translate="no">
                          {formatPrice(plan.unit_amount, plan.currency)}
                        </p>
                        {planDescription?.original_amount && planDescription.original_amount > plan.unit_amount && (
                          <p className="text-muted-foreground text-sm line-through" translate="no">
                            {formatPrice(planDescription.original_amount, plan.currency)}
                          </p>
                        )}
                        <p className="text-muted-foreground text-sm">/ month</p>
                        {planDescription?.original_amount && planDescription.original_amount > plan.unit_amount && (
                          <p className="text-green-600 text-sm font-medium">
                            Save {Math.round((1 - plan.unit_amount / planDescription.original_amount) * 100)}%
                          </p>
                        )}
                      </div>

                      <Button
                        variant={getActionButtonVariant(plan)}
                        size="sm"
                        className="w-full text-xs"
                        disabled={isCurrent}
                        onClick={() => handlePlanClick(plan)}
                      >
                        {getActionButtonText(plan)}
                      </Button>

                      <div className="border-t my-4"></div>

                      {planDescription && (
                        <ul role="list" className="space-y-2">
                          {planDescription.pkg.map((item, index) => (
                            <li key={index} className="flex py-2">
                              <div className="w-[12px]">
                                <Check className="h-3 w-3 text-primary translate-y-[2.5px]" strokeWidth={3} />
                              </div>
                              <div>
                                <p className="ml-3 text-xs text-foreground">{item.title}</p>
                                {item.subtitle && (
                                  <p className="ml-3 text-xs text-muted-foreground">{item.subtitle}</p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Enterprise Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 border rounded-md bg-muted/30 py-4 col-span-12 justify-between gap-x-8">
                <div className="flex flex-col justify-center px-4">
                  <div className="flex items-center space-x-2">
                    <p className="text-primary text-sm uppercase">Enterprise</p>
                  </div>
                  <p className="text-sm mt-2 mb-4 text-muted-foreground">
                    For large-scale applications running Internet scale workloads.
                  </p>
                  <a
                    href="mailto:support@acontext.io?subject=Enterprise Plan Inquiry"
                    className="hidden md:block"
                  >
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      Contact Us
                    </Button>
                  </a>
                </div>
                <div className="flex flex-col justify-center col-span-2 px-4 md:px-0">
                  <ul role="list" className="text-xs text-muted-foreground md:grid md:grid-cols-2 md:gap-x-10">
                    <li className="flex items-center py-2 first:mt-0">
                      <Check className="text-primary h-4 w-4" strokeWidth={3} />
                      <span className="text-foreground mb-0 ml-3">Designated Support manager</span>
                    </li>
                    <li className="flex items-center py-2 first:mt-0">
                      <Check className="text-primary h-4 w-4" strokeWidth={3} />
                      <span className="text-foreground mb-0 ml-3">Uptime SLAs</span>
                    </li>
                    <li className="flex items-center py-2 first:mt-0">
                      <Check className="text-primary h-4 w-4" strokeWidth={3} />
                      <span className="text-foreground mb-0 ml-3">BYO Cloud supported</span>
                    </li>
                    <li className="flex items-center py-2 first:mt-0">
                      <Check className="text-primary h-4 w-4" strokeWidth={3} />
                      <span className="text-foreground mb-0 ml-3">24×7×365 premium enterprise support</span>
                    </li>
                    <li className="flex items-center py-2 first:mt-0">
                      <Check className="text-primary h-4 w-4" strokeWidth={3} />
                      <span className="text-foreground mb-0 ml-3">Private Slack channel</span>
                    </li>
                    <li className="flex items-center py-2 first:mt-0">
                      <Check className="text-primary h-4 w-4" strokeWidth={3} />
                      <span className="text-foreground mb-0 ml-3">Custom Security Questionnaires</span>
                    </li>
                  </ul>
                  <a
                    href="mailto:support@acontext.io?subject=Enterprise Plan Inquiry"
                    className="visible md:hidden mt-8"
                  >
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      Contact Us
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {selectedPlan && (
        <ChangePlanConfirmDialog
          open={confirmDialogOpen}
          onOpenChange={setConfirmDialogOpen}
          organization={organization}
          targetPlan={selectedPlan}
          currentPlan={currentPlan}
          onConfirm={handleConfirmSuccess}
        />
      )}
    </>
  );
}

