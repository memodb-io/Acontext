// supabase/functions/preview-subscription-change/index.ts
// Preview subscription changes with real-time pricing calculation and coupon validation

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@20.3.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

interface PreviewRequest {
  organization_id: string;
  product_id: string;
  promotion_code?: string;
}

interface LineItemBreakdown {
  description: string;
  amount: number;
  proration: boolean;
}

interface PreviewResponse {
  charge_today: number;
  unused_credit: number;
  monthly_estimate: number;
  line_items: LineItemBreakdown[];
  discount: {
    amount: number;
    coupon_name: string;
    percent_off?: number;
    amount_off?: number;
    duration?: string;
    duration_in_months?: number;
  } | null;
  coupon_valid: boolean;
  coupon_error?: string;
  currency: string;
  is_upgrade: boolean;
  is_downgrade: boolean;
  is_fully_covered: boolean;
  current_period_end?: string;
  effective_at?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // 1. Auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    // 2. Input
    const { organization_id, product_id, promotion_code }: PreviewRequest =
      await req.json();

    if (!organization_id || !product_id) {
      return new Response(
        JSON.stringify({ error: "organization_id and product_id required" }),
        { status: 400 }
      );
    }

    console.log(
      `Preview subscription change - org: ${organization_id}, product: ${product_id}, promo: ${promotion_code || "none"}`
    );

    // 3. Get billing info
    const { data: billing, error: billingError } = await supabase
      .from("organization_billing")
      .select("organization_id, plan, stripe_customer_id, stripe_subscription_id")
      .eq("organization_id", organization_id)
      .single();

    if (billingError || !billing) {
      return new Response(
        JSON.stringify({ error: "Billing record not found" }),
        { status: 404 }
      );
    }

    if (!billing.stripe_customer_id) {
      return new Response(
        JSON.stringify({
          error: "Customer not found. Please add a payment method first.",
        }),
        { status: 400 }
      );
    }

    // 4. Handle special case: downgrade to free
    if (product_id === "free") {
      // For free plan, just calculate the credit from remaining time
      if (billing.stripe_subscription_id) {
        const currentSub = await stripe.subscriptions.retrieve(
          billing.stripe_subscription_id
        );
        const now = Math.floor(Date.now() / 1000);
        const periodEnd = currentSub.current_period_end;
        const periodStart = currentSub.current_period_start;
        const totalPeriod = periodEnd - periodStart;
        const remainingPeriod = periodEnd - now;
        const remainingRatio = remainingPeriod / totalPeriod;

        // Calculate unused credit based on current subscription amount
        let currentAmount = 0;
        for (const item of currentSub.items.data) {
          if (item.price.unit_amount) {
            currentAmount += item.price.unit_amount;
          }
        }
        const unusedCredit = Math.round(currentAmount * remainingRatio);

        return new Response(
          JSON.stringify({
            charge_today: 0,
            unused_credit: unusedCredit,
            monthly_estimate: 0,
            line_items: [],
            discount: null,
            coupon_valid: false,
            currency: "usd",
            is_upgrade: false,
            is_downgrade: true,
            is_fully_covered: false,
            current_period_end: new Date(periodEnd * 1000).toISOString(),
            effective_at: new Date(periodEnd * 1000).toISOString(),
          } as PreviewResponse),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          charge_today: 0,
          unused_credit: 0,
          monthly_estimate: 0,
          line_items: [],
          discount: null,
          coupon_valid: false,
          currency: "usd",
          is_upgrade: false,
          is_downgrade: false,
          is_fully_covered: false,
        } as PreviewResponse),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // 5. Get target product's prices
    const prices = await stripe.prices.list({
      product: product_id,
      active: true,
    });

    if (prices.data.length === 0) {
      return new Response(
        JSON.stringify({ error: "No active price found for this product" }),
        { status: 400 }
      );
    }

    // 6. Get target product to determine rank
    const targetProduct = await stripe.products.retrieve(product_id);
    const targetRank = parseInt(targetProduct.metadata?.rank || "0");

    // 7. Validate promotion code if provided
    // In Stripe, a "promotion code" is a customer-facing code that maps to a coupon
    // The code entered could be: 1) a promotion code, or 2) a coupon ID directly
    let validCouponId: string | null = null;
    let validCoupon: Stripe.Coupon | null = null;
    let couponError: string | undefined;

    if (promotion_code) {
      try {
        // First, try to find as a promotion code (exact match)
        const promoCodes = await stripe.promotionCodes.list({
          code: promotion_code,
          active: true,
          limit: 1,
          expand: ["data.coupon"],
        });

        // If not found, try case-insensitive search
        if (promoCodes.data.length === 0) {
          const allPromoCodes = await stripe.promotionCodes.list({
            active: true,
            limit: 10,
            expand: ["data.coupon"],
          });
          for (const pc of allPromoCodes.data) {
            if (pc.code.toLowerCase() === promotion_code.toLowerCase()) {
              promoCodes.data.push(pc);
              break;
            }
          }
        }

        if (promoCodes.data.length > 0) {
          // Found as promotion code
          const promoCodeFromList = promoCodes.data[0];

          // Retrieve full promotion code by ID
          const promoCode = await stripe.promotionCodes.retrieve(promoCodeFromList.id, {
            expand: ["coupon"],
          });

          // The coupon might be a string (coupon ID) or an object
          let coupon: Stripe.Coupon | null = null;

          if (typeof promoCode.coupon === "string") {
            // coupon is an ID, need to retrieve it
            try {
              coupon = await stripe.coupons.retrieve(promoCode.coupon);
            } catch (e) {
              console.error(`Failed to retrieve coupon: ${e}`);
            }
          } else if (promoCode.coupon && typeof promoCode.coupon === "object") {
            // coupon is already an object
            coupon = promoCode.coupon as Stripe.Coupon;
          } else {
            // Try the "promotion" field as a fallback (some API versions have nested structure)
            const rawPromoCode = promoCode as Record<string, unknown>;

            if (rawPromoCode.promotion) {
              const promotion = rawPromoCode.promotion as Record<string, unknown>;

              // promotion might be an object like { coupon: "coupon_id", type: "coupon" }
              if (typeof promotion === "object" && promotion.coupon) {
                const couponId = promotion.coupon as string;
                try {
                  coupon = await stripe.coupons.retrieve(couponId);
                } catch (e) {
                  console.error(`Failed to retrieve coupon: ${e}`);
                }
              } else if (typeof promotion === "string") {
                try {
                  coupon = await stripe.coupons.retrieve(promotion as string);
                } catch {
                  // Not a coupon ID
                }
              }
            }
          }

          if (!coupon) {
            couponError = "Invalid promotion code";
          } else {
            // Check if coupon is valid for this product
            const appliesTo = coupon.applies_to as { products?: string[] } | undefined;
            if (appliesTo?.products && Array.isArray(appliesTo.products)) {
              if (!appliesTo.products.includes(product_id)) {
                couponError = "This promotion code is not valid for this plan";
              }
            }

            // Check redemption limits
            if (!couponError && coupon.max_redemptions && coupon.times_redeemed !== undefined) {
              if (coupon.times_redeemed >= coupon.max_redemptions) {
                couponError = "This promotion code has reached its redemption limit";
              }
            }

            // Check expiration
            if (!couponError && coupon.redeem_by) {
              if (coupon.redeem_by < Math.floor(Date.now() / 1000)) {
                couponError = "This promotion code has expired";
              }
            }

            if (!couponError) {
              validCouponId = coupon.id;
              validCoupon = coupon;
            }
          }
        } else {
          // Not found as promotion code - try as coupon ID directly
          try {
            const coupon = await stripe.coupons.retrieve(promotion_code);

            if (!coupon.valid) {
              couponError = "This coupon is no longer valid";
            } else {
              // Check if coupon is valid for this product
              const appliesTo = coupon.applies_to as { products?: string[] } | undefined;
              if (appliesTo?.products && Array.isArray(appliesTo.products)) {
                if (!appliesTo.products.includes(product_id)) {
                  couponError = "This coupon is not valid for this plan";
                }
              }

              // Check redemption limits
              if (!couponError && coupon.max_redemptions && coupon.times_redeemed !== undefined) {
                if (coupon.times_redeemed >= coupon.max_redemptions) {
                  couponError = "This coupon has reached its redemption limit";
                }
              }

              // Check expiration
              if (!couponError && coupon.redeem_by) {
                if (coupon.redeem_by < Math.floor(Date.now() / 1000)) {
                  couponError = "This coupon has expired";
                }
              }

              if (!couponError) {
                validCouponId = coupon.id;
                validCoupon = coupon;
              }
            }
          } catch {
            couponError = "Invalid or expired promotion code";
          }
        }
      } catch (err) {
        console.error("Error validating promotion code:", err);
        couponError = "Failed to validate promotion code";
      }
    }

    // 8. Determine if upgrade or downgrade
    let isUpgrade = true;
    let isDowngrade = false;
    let currentPeriodEnd: number | undefined;

    if (billing.stripe_subscription_id) {
      const currentSub = await stripe.subscriptions.retrieve(
        billing.stripe_subscription_id
      );
      currentPeriodEnd = currentSub.current_period_end;

      const currentProductId = currentSub.items.data[0]?.price?.product as string;
      if (currentProductId) {
        const currentProduct = await stripe.products.retrieve(currentProductId);
        const currentRank = parseInt(currentProduct.metadata?.rank || "0");

        isUpgrade = targetRank > currentRank;
        isDowngrade = targetRank < currentRank;
      }
    }

    // 9. Build invoice preview parameters
    // Using Stripe SDK v20+ createPreview API (replaces deprecated upcoming)
    // See: https://docs.stripe.com/api/invoices/create_preview
    const previewParams: Record<string, unknown> = {
      customer: billing.stripe_customer_id,
    };

    if (billing.stripe_subscription_id) {
      // Existing subscription - preview update
      const currentSub = await stripe.subscriptions.retrieve(
        billing.stripe_subscription_id
      );

      // For existing subscription, pass the subscription ID
      previewParams.subscription = billing.stripe_subscription_id;

      // Build subscription items for the update
      const subscriptionItems: Array<{ id?: string; price?: string; deleted?: boolean }> = [];

      // Add new price items
      for (const price of prices.data) {
        // Find if there's an existing item for this price type
        const existingItem = currentSub.items.data.find(
          (item) =>
            item.price.recurring?.usage_type === price.recurring?.usage_type
        );

        if (existingItem) {
          subscriptionItems.push({
            id: existingItem.id,
            price: price.id,
          });
        } else {
          subscriptionItems.push({
            price: price.id,
          });
        }
      }

      // Delete items that don't have a corresponding new price
      for (const item of currentSub.items.data) {
        const hasNewPrice = prices.data.some(
          (p) => p.recurring?.usage_type === item.price.recurring?.usage_type
        );
        if (!hasNewPrice) {
          subscriptionItems.push({
            id: item.id,
            deleted: true,
          });
        }
      }

      // Use subscription_details for the new API
      previewParams.subscription_details = {
        items: subscriptionItems,
        proration_behavior: isUpgrade ? "create_prorations" : "none",
      };
    } else {
      // New subscription - use subscription_details.items
      previewParams.subscription_details = {
        items: prices.data.map((price) => ({
          price: price.id,
        })),
      };
    }

    // Add discounts if valid coupon (new API uses discounts array)
    if (validCouponId) {
      previewParams.discounts = [{ coupon: validCouponId }];
    }

    // 10. Get invoice preview using createPreview API
    // Note: Stripe SDK v20+ uses stripe.invoices.createPreview() instead of upcoming()
    let previewInvoice: Stripe.Invoice;
    try {
      previewInvoice = await stripe.invoices.createPreview(previewParams);
    } catch (err) {
      console.error("Error creating invoice preview:", err);
      // If we can't get an upcoming invoice (e.g., no payment method), estimate from prices
      let monthlyEstimate = 0;
      for (const price of prices.data) {
        if (price.unit_amount && price.recurring?.usage_type === "licensed") {
          monthlyEstimate += price.unit_amount;
        }
      }

      // Calculate if coupon fully covers the price
      const isFullyCovered = !!validCoupon && (
        validCoupon.percent_off === 100 ||
        (!!validCoupon.amount_off && validCoupon.amount_off >= monthlyEstimate)
      );

      return new Response(
        JSON.stringify({
          charge_today: isFullyCovered ? 0 : monthlyEstimate,
          unused_credit: 0,
          monthly_estimate: monthlyEstimate,
          line_items: [],
          discount: validCoupon ? {
            amount: isFullyCovered ? monthlyEstimate : (validCoupon.amount_off || 0),
            coupon_name: validCoupon.name || promotion_code || "Discount",
            percent_off: validCoupon.percent_off || undefined,
            amount_off: validCoupon.amount_off || undefined,
            duration: validCoupon.duration || undefined,
            duration_in_months: validCoupon.duration_in_months || undefined,
          } : null,
          coupon_valid: !!validCouponId,
          coupon_error: couponError,
          currency: "usd",
          is_upgrade: isUpgrade,
          is_downgrade: isDowngrade,
          is_fully_covered: isFullyCovered,
          current_period_end: currentPeriodEnd
            ? new Date(currentPeriodEnd * 1000).toISOString()
            : undefined,
        } as PreviewResponse),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // 11. Parse invoice breakdown
    let chargeToday = previewInvoice.amount_due || 0;
    let unusedCredit = 0;
    const lineItems: LineItemBreakdown[] = [];

    // Handle lines data - may be in lines.data or directly accessible
    const invoiceLines = previewInvoice.lines?.data || [];
    for (const line of invoiceLines) {
      const lineAmount = line.amount || 0;
      const isProration = (line as { proration?: boolean }).proration || false;

      lineItems.push({
        description: line.description || "Subscription",
        amount: lineAmount,
        proration: isProration,
      });

      if (isProration && lineAmount < 0) {
        unusedCredit += Math.abs(lineAmount);
      }
    }

    // Calculate monthly estimate from base prices (before discount)
    // This shows what the user will pay monthly at full price
    let monthlyEstimate = 0;
    for (const price of prices.data) {
      if (price.unit_amount && price.recurring?.usage_type === "licensed") {
        monthlyEstimate += price.unit_amount;
      }
    }

    // 12. Build discount info from validated coupon
    let discountInfo: PreviewResponse["discount"] = null;
    const totalDiscountAmounts = previewInvoice.total_discount_amounts;
    const discountAmount = totalDiscountAmounts?.[0]?.amount || 0;

    // Use the validated coupon data we saved earlier
    if (validCoupon) {
      discountInfo = {
        amount: discountAmount,
        coupon_name: validCoupon.name || promotion_code || "Discount",
        percent_off: validCoupon.percent_off || undefined,
        amount_off: validCoupon.amount_off || undefined,
        duration: validCoupon.duration || undefined,
        duration_in_months: validCoupon.duration_in_months || undefined,
      };
    }

    // 13. Calculate if coupon fully covers the price
    const isFullyCovered = !!validCoupon && (
      validCoupon.percent_off === 100 ||
      (!!validCoupon.amount_off && validCoupon.amount_off >= monthlyEstimate)
    );

    // 14. For downgrades, the charge today should be 0 (change happens at period end)
    if (isDowngrade) {
      chargeToday = 0;
    }

    const response: PreviewResponse = {
      charge_today: chargeToday,
      unused_credit: unusedCredit,
      monthly_estimate: monthlyEstimate,
      line_items: lineItems,
      discount: discountInfo,
      coupon_valid: !!validCouponId,
      coupon_error: couponError,
      currency: previewInvoice.currency || "usd",
      is_upgrade: isUpgrade,
      is_downgrade: isDowngrade,
      is_fully_covered: isFullyCovered,
      current_period_end: currentPeriodEnd
        ? new Date(currentPeriodEnd * 1000).toISOString()
        : undefined,
      effective_at: isDowngrade && currentPeriodEnd
        ? new Date(currentPeriodEnd * 1000).toISOString()
        : undefined,
    };

    return new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error in preview-subscription-change:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal Server Error",
      }),
      { status: 500 }
    );
  }
});
