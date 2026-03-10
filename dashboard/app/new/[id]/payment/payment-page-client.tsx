"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, CheckCircle2, Tag, X, Loader2, Gift } from "lucide-react";
import { toast } from "sonner";
import { useTopNavStore } from "@/stores/top-nav";
import { Price, usePlanStore } from "@/stores/plan";
import { Organization } from "@/types";
import { encodeId } from "@/lib/id-codec";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaymentMethodForm } from "@/app/org/[id]/billing/payment-method-form";
import {
  createSubscription,
  previewSubscriptionChange,
  SubscriptionPreview,
} from "@/lib/supabase/operations/prices";

interface PaymentPageClientProps {
  orgId: string;
  currentOrganization: Organization;
  allOrganizations: Organization[];
  selectedPlan: Price;
}

export function PaymentPageClient({
  orgId,
  currentOrganization,
  allOrganizations,
  selectedPlan,
}: PaymentPageClientProps) {
  const router = useRouter();
  const { initialize } = useTopNavStore();
  const { formatPrice } = usePlanStore();
  const [isCreatingSubscription, setIsCreatingSubscription] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("card");

  // Promo code state
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SubscriptionPreview | null>(null);

  useEffect(() => {
    // Initialize top-nav state when page loads
    initialize({
      title: "Add Payment Method",
      organization: currentOrganization,
      project: null,
      organizations: allOrganizations,
      projects: [],
      hasSidebar: false,
    });
  }, [initialize, currentOrganization, allOrganizations]);

  // Fetch preview with promo code
  const fetchPreview = useCallback(
    async (promoCodeToUse?: string) => {
      setIsValidatingPromo(true);
      setPromoError(null);

      try {
        const result = await previewSubscriptionChange(
          orgId,
          selectedPlan.product,
          promoCodeToUse
        );

        if (result.error) {
          console.error("Preview error:", result.error);
          if (promoCodeToUse) {
            setPromoError(result.error);
          }
        } else if (result.preview) {
          setPreview(result.preview);
          // Update promo error from preview
          if (result.preview.coupon_error) {
            setPromoError(result.preview.coupon_error);
          } else if (result.preview.coupon_valid && promoCodeToUse) {
            setPromoError(null);
            setAppliedPromoCode(promoCodeToUse);
          }
        }
      } catch (error) {
        console.error("Error fetching preview:", error);
        if (promoCodeToUse) {
          setPromoError("Failed to validate promotion code");
        }
      } finally {
        setIsValidatingPromo(false);
      }
    },
    [orgId, selectedPlan.product]
  );

  const handleApplyPromoCode = async () => {
    if (!promoCode.trim()) return;
    await fetchPreview(promoCode.trim());
  };

  const handleRemovePromoCode = () => {
    setAppliedPromoCode(null);
    setPromoCode("");
    setPromoError(null);
    setPreview(null);
  };

  const handlePaymentSuccess = async () => {
    setIsCreatingSubscription(true);

    try {
      // Log the selected plan for debugging
      console.log("Creating subscription with plan:", {
        orgId,
        productId: selectedPlan.product,
        planName: selectedPlan.name,
        priceId: selectedPlan.id,
      });

      // Create subscription after payment method is added
      const result = await createSubscription(orgId, selectedPlan.product);

      if (result.error) {
        toast.error(result.error);
        setIsCreatingSubscription(false);
        return;
      }

      toast.success("Subscription created successfully!");
      // Redirect to create project page (convert orgId to Base64URL for URL)
      const encodedOrgId = encodeId(orgId);
      router.push(`/new/${encodedOrgId}`);
    } catch {
      toast.error("Failed to create subscription");
      setIsCreatingSubscription(false);
    }
  };

  const handlePromoActivation = async () => {
    if (!appliedPromoCode || !preview?.is_fully_covered) {
      toast.error("Please enter a valid 100% off promotion code");
      return;
    }

    setIsCreatingSubscription(true);

    try {
      console.log("Creating subscription with promo code:", {
        orgId,
        productId: selectedPlan.product,
        promoCode: appliedPromoCode,
      });

      // Create subscription with promo code (no payment method needed)
      const result = await createSubscription(
        orgId,
        selectedPlan.product,
        appliedPromoCode
      );

      if (result.error) {
        toast.error(result.error);
        setIsCreatingSubscription(false);
        return;
      }

      toast.success("Subscription activated successfully!");
      // Redirect to create project page
      const encodedOrgId = encodeId(orgId);
      router.push(`/new/${encodedOrgId}`);
    } catch {
      toast.error("Failed to activate subscription");
      setIsCreatingSubscription(false);
    }
  };

  const handleCancel = () => {
    // Redirect to create project page with free plan (convert orgId to Base64URL for URL)
    toast.info("Continuing with free plan");
    const encodedOrgId = encodeId(orgId);
    router.push(`/new/${encodedOrgId}`);
  };

  const planDisplayName = selectedPlan.name || "Pro";
  const priceDisplay = formatPrice(selectedPlan.unit_amount, selectedPlan.currency);
  const interval = selectedPlan.recurring?.interval || "month";

  const isFullyCovered = preview?.is_fully_covered === true;

  // Get coupon duration text
  const getCouponDurationText = () => {
    if (!preview?.discount) return null;
    const { duration, duration_in_months } = preview.discount;
    if (duration === "forever") return "Forever";
    if (duration === "once") return "First payment only";
    if (duration === "repeating" && duration_in_months) {
      return `For ${duration_in_months} month${duration_in_months > 1 ? "s" : ""}`;
    }
    return null;
  };

  return (
    <div className="flex-1 flex min-h-screen items-start justify-center p-4 pt-16">
      <div className="w-full max-w-2xl space-y-6">
        {/* Plan Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Complete Your Subscription
            </CardTitle>
            <CardDescription>
              Choose a payment method to activate your subscription for{" "}
              <span className="font-medium text-foreground">{currentOrganization.name}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">{planDisplayName} Plan</div>
                  <div className="text-sm text-muted-foreground">
                    Billed {interval === "year" ? "annually" : "monthly"}
                  </div>
                </div>
              </div>
              <Badge variant="secondary" className="text-lg px-4 py-1">
                {priceDisplay}/{interval}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Payment Options Card */}
        <Card>
          <CardContent>
            {isCreatingSubscription ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-muted-foreground">Creating your subscription...</p>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="card" className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Credit Card
                  </TabsTrigger>
                  <TabsTrigger value="promo" className="flex items-center gap-2">
                    <Gift className="h-4 w-4" />
                    Promo Code
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="card">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium">Payment Method</h3>
                      <p className="text-sm text-muted-foreground">
                        Your card will be charged {priceDisplay} {interval === "year" ? "annually" : "monthly"}.
                        You can cancel anytime.
                      </p>
                    </div>
                    <PaymentMethodForm
                      organizationId={orgId}
                      onSuccess={handlePaymentSuccess}
                      onCancel={handleCancel}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="promo">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium">Activate with Promo Code</h3>
                      <p className="text-sm text-muted-foreground">
                        If you have a 100% off promotion code, you can activate your subscription without a credit card.
                      </p>
                    </div>

                    {/* Promo Code Input */}
                    <div className="space-y-4">
                      {appliedPromoCode ? (
                        // Applied promo code display
                        <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                          <Tag className="h-5 w-5 text-green-600" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-green-700 dark:text-green-400">
                                {appliedPromoCode}
                              </span>
                              {preview?.discount && (
                                <Badge variant="secondary" className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                                  {preview.discount.percent_off
                                    ? `${preview.discount.percent_off}% off`
                                    : preview.discount.amount_off
                                      ? `${formatPrice(preview.discount.amount_off, preview.currency)} off`
                                      : null}
                                </Badge>
                              )}
                            </div>
                            {getCouponDurationText() && (
                              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                                {getCouponDurationText()}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={handleRemovePromoCode}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        // Promo code input
                        <div className="space-y-2">
                          <Label htmlFor="promo-code">Promotion Code</Label>
                          <div className="flex gap-2">
                            <Input
                              id="promo-code"
                              placeholder="Enter promotion code"
                              value={promoCode}
                              onChange={(e) => {
                                setPromoCode(e.target.value);
                                setPromoError(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleApplyPromoCode();
                                }
                              }}
                              className="flex-1"
                            />
                            <Button
                              variant="outline"
                              onClick={handleApplyPromoCode}
                              disabled={isValidatingPromo || !promoCode.trim()}
                            >
                              {isValidatingPromo ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Apply"
                              )}
                            </Button>
                          </div>
                          {promoError && (
                            <p className="text-sm text-destructive">{promoError}</p>
                          )}
                        </div>
                      )}

                      {/* Charge Summary */}
                      {appliedPromoCode && preview && (
                        <div className="p-4 bg-muted/50 rounded-lg border space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Plan Price</span>
                            <span>{formatPrice(preview.monthly_estimate, preview.currency)}</span>
                          </div>
                          {preview.discount && (
                            <div className="flex justify-between text-sm text-green-600">
                              <span>Discount ({preview.discount.coupon_name})</span>
                              <span>-{formatPrice(preview.discount.amount || preview.monthly_estimate, preview.currency)}</span>
                            </div>
                          )}
                          <div className="flex justify-between font-medium pt-2 border-t">
                            <span>Charge Today</span>
                            <span>{formatPrice(preview.charge_today, preview.currency)}</span>
                          </div>
                        </div>
                      )}

                      {/* Status Message */}
                      {appliedPromoCode && !isFullyCovered && (
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                          <p className="text-sm text-yellow-700 dark:text-yellow-300">
                            This promotion code does not cover 100% of the subscription cost.
                            Please switch to the Credit Card tab to complete your subscription with this discount.
                          </p>
                        </div>
                      )}

                      {isFullyCovered && (
                        <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                          <p className="text-sm text-green-700 dark:text-green-300">
                            This promotion code covers 100% of your subscription.
                            No credit card required to activate!
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                      <Button
                        variant="outline"
                        onClick={handleCancel}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handlePromoActivation}
                        disabled={!isFullyCovered}
                        className="flex-1"
                      >
                        Activate {planDisplayName} Plan
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
