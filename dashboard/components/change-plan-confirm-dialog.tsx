"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, Info, CreditCard, AlertTriangle, Tag, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Organization } from "@/types";
import { Price, usePlanStore, getPlanTypeDisplayName, PlanType } from "@/stores/plan";
import {
  getPaymentMethods,
  PaymentMethod,
  createSubscription,
  previewSubscriptionChange,
  SubscriptionPreview,
} from "@/lib/supabase/operations/prices";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ChangePlanConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: Organization;
  targetPlan: Price;
  currentPlan: PlanType;
  onConfirm?: () => void;
}

export function ChangePlanConfirmDialog({
  open,
  onOpenChange,
  organization,
  targetPlan,
  currentPlan,
  onConfirm,
}: ChangePlanConfirmDialogProps) {
  const { formatPrice, getPlanByProduct, getDescriptionByProduct } = usePlanStore();

  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(true);

  // Price preview state
  const [preview, setPreview] = useState<SubscriptionPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Promotion code state
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [showPromoInput, setShowPromoInput] = useState(false);

  // Submit state
  const [isLoading, setIsLoading] = useState(false);

  const targetPlanType = getPlanByProduct(targetPlan.product);
  const targetPlanDescription = getDescriptionByProduct(targetPlan.product);
  const currentPlanPrice = usePlanStore.getState().getPriceByProduct(currentPlan);

  // Fetch price preview
  const fetchPreview = useCallback(
    async (promoCodeToUse?: string) => {
      if (!organization.id) return;

      setIsLoadingPreview(true);
      try {
        const result = await previewSubscriptionChange(
          organization.id,
          targetPlan.product,
          promoCodeToUse
        );

        if (result.error) {
          console.error("Preview error:", result.error);
          // If it's a coupon error, handle it separately
          if (promoCodeToUse && result.error.toLowerCase().includes("promotion")) {
            setPromoError(result.error);
            // Fetch preview without coupon
            const fallbackResult = await previewSubscriptionChange(
              organization.id,
              targetPlan.product
            );
            if (fallbackResult.preview) {
              setPreview(fallbackResult.preview);
            }
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
      } finally {
        setIsLoadingPreview(false);
      }
    },
    [organization.id, targetPlan.product]
  );

  // Fetch payment methods and initial preview when dialog opens
  useEffect(() => {
    if (open && organization.id) {
      // Fetch payment methods
      setIsLoadingPaymentMethods(true);
      getPaymentMethods(organization.id).then((result) => {
        if (result.error) {
          toast.error("Failed to load payment methods");
        } else {
          setPaymentMethods(result.paymentMethods || []);
          if (result.paymentMethods && result.paymentMethods.length > 0) {
            setSelectedPaymentMethod(result.paymentMethods[0].id);
          }
        }
        setIsLoadingPaymentMethods(false);
      });

      // Fetch initial preview
      fetchPreview();
    }
  }, [open, organization.id, fetchPreview]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setPromoCode("");
      setAppliedPromoCode(null);
      setPromoError(null);
      setPreview(null);
      setShowPromoInput(false);
    }
  }, [open]);

  const handleApplyPromoCode = async () => {
    if (!promoCode.trim()) return;

    setIsValidatingPromo(true);
    setPromoError(null);

    try {
      await fetchPreview(promoCode.trim());
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const handleRemovePromoCode = () => {
    setAppliedPromoCode(null);
    setPromoCode("");
    setPromoError(null);
    setShowPromoInput(false);
    fetchPreview();
  };

  const handleConfirm = async () => {
    if (!selectedPaymentMethod && targetPlan.unit_amount > 0 && !preview?.is_downgrade) {
      toast.error("Please select a payment method");
      return;
    }

    setIsLoading(true);
    try {
      const result = await createSubscription(
        organization.id!,
        targetPlan.product,
        appliedPromoCode || undefined,
        selectedPaymentMethod || undefined
      );

      if (result.error) {
        toast.error(result.error);
        setIsLoading(false);
        return;
      }

      // Show appropriate success message based on action
      if (result.action === "scheduled_downgrade") {
        const effectiveDate = result.effectiveAt
          ? new Date(result.effectiveAt).toLocaleDateString()
          : "the end of your billing period";
        toast.success(`Plan change scheduled for ${effectiveDate}`);
      } else {
        toast.success("Subscription updated successfully!");
      }

      onConfirm?.();
      onOpenChange(false);
    } catch {
      toast.error("Failed to update subscription");
      setIsLoading(false);
    }
  };

  const getCardBrandIcon = () => {
    return <CreditCard className="h-4 w-4" />;
  };

  const formatCardDisplay = (paymentMethod: PaymentMethod) => {
    return `•••• •••• •••• ${paymentMethod.card.last4}`;
  };

  const isUpgrade = preview?.is_upgrade ?? (
    (currentPlanPrice?.rank ?? 0) < (targetPlan.rank ?? 0)
  );
  const isDowngrade = preview?.is_downgrade ?? (
    (currentPlanPrice?.rank ?? 0) > (targetPlan.rank ?? 0)
  );

  const actionText = isUpgrade ? "Upgrade" : "Downgrade";
  const planDisplayName = targetPlan.name || getPlanTypeDisplayName(targetPlanType);

  // Use preview data for pricing, with fallbacks
  const chargeToday = preview?.charge_today ?? (isDowngrade ? 0 : targetPlan.unit_amount);
  const unusedCredit = preview?.unused_credit ?? 0;
  const monthlyEstimate = preview?.monthly_estimate ?? targetPlan.unit_amount;
  const currency = preview?.currency ?? targetPlan.currency;

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-5xl max-h-[80vh] p-0 flex flex-col overflow-hidden" showCloseButton={true}>
        <DialogHeader className="sr-only">
          <DialogTitle>
            {actionText} {organization.name} to the {planDisplayName} plan
          </DialogTitle>
        </DialogHeader>
        {isDowngrade ? (
          // Downgrade Warning View
          <div className="p-8 flex flex-col">
            <Alert className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20 mb-6">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
              <AlertTitle className="text-yellow-900 dark:text-yellow-100 mb-2">
                Before you downgrade to the {planDisplayName} plan, consider:
              </AlertTitle>
              <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                <ul className="list-disc list-inside space-y-2 mt-2">
                  <li>Your projects no longer require their respective add-ons.</li>
                  <li>Your resource consumption are well within the {planDisplayName} plan&apos;s quota.</li>
                  <li>Alternatively, you may also transfer projects across organizations.</li>
                </ul>
              </AlertDescription>
            </Alert>

            {/* Downgrade timing info */}
            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              <p className="text-sm text-muted-foreground">
                <Info className="h-4 w-4 inline-block mr-2" />
                Your plan will change to <span className="font-medium text-foreground">{planDisplayName}</span> at the end of your current billing period
                {preview?.effective_at && (
                  <span className="font-medium text-foreground">
                    {" "}({new Date(preview.effective_at).toLocaleDateString()})
                  </span>
                )}.
              </p>
            </div>

            {/* Promotion code for downgrade */}
            <div className="mb-6">
              {appliedPromoCode ? (
                // Applied promo code display
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md">
                  <Tag className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700 dark:text-green-400 flex-1">
                    <span className="font-medium">{appliedPromoCode}</span>
                    {preview?.discount && (
                      <span className="ml-2">
                        {preview.discount.percent_off
                          ? `${preview.discount.percent_off}% off`
                          : preview.discount.amount_off
                            ? `${formatPrice(preview.discount.amount_off, currency)} off`
                            : null}
                      </span>
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={handleRemovePromoCode}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : showPromoInput ? (
                // Expanded input field
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">
                      Promotion code
                    </Label>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground transition"
                      onClick={() => {
                        setShowPromoInput(false);
                        setPromoCode("");
                        setPromoError(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Input
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
                      autoFocus
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
              ) : (
                // Collapsed hint link
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition"
                  onClick={() => setShowPromoInput(true)}
                >
                  <Tag className="h-3.5 w-3.5" />
                  <span>Have a promotion code?</span>
                </button>
              )}
            </div>

            <div className="flex space-x-2 mt-auto">
              <Button
                variant="outline"
                onClick={handleCancel}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? "Processing..." : "Confirm downgrade"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 flex-1 min-h-0 items-stretch overflow-hidden">
            {/* Left Side - Payment and Charges */}
            <div className="p-8 pb-8 flex flex-col xl:col-span-3 overflow-y-auto">
              <div className="flex-1">
                {/* Payment Method Selection */}
                <div className="space-y-2 mb-4">
                  <div className="text-sm grid gap-2 md:grid md:grid-cols-12 items-center">
                    <div className="flex flex-row space-x-2 justify-between col-span-12">
                      <label className="block text-muted-foreground text-sm break-all" htmlFor="payment-method">
                        Payment method
                      </label>
                    </div>
                    <div className="col-span-12">
                      {isLoadingPaymentMethods ? (
                        <div className="h-9 w-full border rounded-md bg-muted animate-pulse" />
                      ) : paymentMethods.length > 0 ? (
                        <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                          <SelectTrigger className="w-full">
                            <SelectValue>
                              {selectedPaymentMethod && paymentMethods.find(pm => pm.id === selectedPaymentMethod) && (
                                <span className="w-full flex flex-row items-center space-x-3">
                                  {getCardBrandIcon()}
                                  <span className="truncate">
                                    {formatCardDisplay(paymentMethods.find(pm => pm.id === selectedPaymentMethod)!)}
                                  </span>
                                </span>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {paymentMethods.map((pm) => (
                              <SelectItem key={pm.id} value={pm.id}>
                                <div className="flex items-center space-x-3">
                                  {getCardBrandIcon()}
                                  <span>{formatCardDisplay(pm)}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : targetPlan.unit_amount > 0 ? (
                        <div className="text-sm text-muted-foreground p-4 border rounded-md bg-muted/30">
                          No payment methods found. Please add a payment method first.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Promotion Code Input */}
                <div className="mb-6">
                  {appliedPromoCode ? (
                    // Applied promo code display
                    <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md">
                      <Tag className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-700 dark:text-green-400 flex-1">
                        <span className="font-medium">{appliedPromoCode}</span>
                        {preview?.discount && (
                          <span className="ml-2">
                            {preview.discount.percent_off
                              ? `${preview.discount.percent_off}% off`
                              : preview.discount.amount_off
                                ? `${formatPrice(preview.discount.amount_off, currency)} off`
                                : null}
                            {preview.discount.amount > 0 && (
                              <span className="text-green-600 ml-1">
                                (-{formatPrice(preview.discount.amount, currency)})
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={handleRemovePromoCode}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : showPromoInput ? (
                    // Expanded input field
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm text-muted-foreground">
                          Promotion code
                        </Label>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-foreground transition"
                          onClick={() => {
                            setShowPromoInput(false);
                            setPromoCode("");
                            setPromoError(null);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <Input
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
                          autoFocus
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
                  ) : (
                    // Collapsed hint link
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition"
                      onClick={() => setShowPromoInput(true)}
                    >
                      <Tag className="h-3.5 w-3.5" />
                      <span>Have a promotion code?</span>
                    </button>
                  )}
                </div>

                {/* Charge Breakdown */}
                <div className="mt-2 mb-4 text-muted-foreground text-sm">
                  {isLoadingPreview ? (
                    <div className="space-y-3">
                      <div className="h-6 bg-muted animate-pulse rounded" />
                      <div className="h-6 bg-muted animate-pulse rounded" />
                      <div className="h-6 bg-muted animate-pulse rounded" />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2 border-b border-border text-foreground">
                        <div className="py-2 pl-0">Charge today</div>
                        <div className="py-2 pr-0 text-right" translate="no">
                          {formatPrice(chargeToday, currency)}
                        </div>
                      </div>

                      {unusedCredit > 0 && (
                        <div className="flex items-center justify-between gap-2 border-b border-border text-xs">
                          <div className="py-2 pl-0 flex items-center gap-1">
                            <span>Unused Time on {getPlanTypeDisplayName(currentPlan)} Plan</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="flex"
                                  onClick={(e) => e.preventDefault()}
                                >
                                  <Info className="h-4 w-4 text-muted-foreground" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Credit for unused portion of current billing period</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="py-2 pr-0 text-right text-green-600" translate="no">
                            -{formatPrice(unusedCredit, currency)}
                          </div>
                        </div>
                      )}

                      {preview?.discount && (
                        <div className="flex items-center justify-between gap-2 border-b border-border text-xs">
                          <div className="py-2 pl-0 flex items-center gap-1">
                            <Tag className="h-3 w-3 text-green-600" />
                            <span className="text-green-600">{preview.discount.coupon_name}</span>
                          </div>
                          <div className="py-2 pr-0 text-right text-green-600" translate="no">
                            -{formatPrice(preview.discount.amount, currency)}
                          </div>
                        </div>
                      )}

                      {targetPlan.unit_amount > 0 && (
                        <div className="flex items-center justify-between gap-2 text-muted-foreground text-xs">
                          <div className="py-2 pl-0 flex items-center gap-1">
                            <span>Monthly invoice estimate</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="flex"
                                  onClick={(e) => e.preventDefault()}
                                >
                                  <Info className="h-4 w-4 text-muted-foreground" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Estimated monthly charge after plan change</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="py-2 pr-0 text-right" translate="no">
                            {formatPrice(monthlyEstimate, currency)}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="pt-4">
                <div className="flex space-x-2">
                  <Button
                    onClick={handleConfirm}
                    disabled={isLoading || isLoadingPreview || (targetPlan.unit_amount > 0 && !selectedPaymentMethod)}
                    className="flex-1"
                  >
                    {isLoading ? "Processing..." : `Confirm ${actionText.toLowerCase()}`}
                  </Button>
                </div>
              </div>
            </div>

            {/* Right Side - Features */}
            <div className="bg-muted/30 p-8 flex flex-col border-l xl:col-span-2 overflow-y-auto">
              <h3 className="mb-8">
                {actionText} <span className="font-bold">{organization.name}</span> to the {planDisplayName} plan
                {targetPlanDescription?.plan_desc && ` for ${targetPlanDescription.plan_desc}`}
              </h3>
              {targetPlanDescription && (
                <div className="mb-4">
                  <h3 className="text-sm mb-4 font-semibold">
                    {actionText} features
                  </h3>
                  <div className="space-y-2 mb-4 text-muted-foreground">
                    {targetPlanDescription.pkg.map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-4">
                          <Check className="h-3 w-3 text-primary" strokeWidth={3} />
                        </div>
                        <div className="text-sm">
                          <p className="text-foreground">{item.title}</p>
                          {item.subtitle && (
                            <p className="text-muted-foreground text-xs">{item.subtitle}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
