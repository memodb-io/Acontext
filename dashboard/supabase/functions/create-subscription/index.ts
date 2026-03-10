// supabase/functions/create-subscription/index.ts
// Create or update subscriptions with support for upgrades, downgrades, and promotion codes

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@20.3.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

interface SubscriptionRequest {
  organization_id: string;
  product_id: string;
  promotion_code?: string;
  payment_method_id?: string;
}

interface SubscriptionResponse {
  subscription_id?: string;
  schedule_id?: string;
  status: string;
  action: "created" | "updated" | "scheduled_downgrade" | "cancelled";
  effective_at?: string;
  plan?: string;
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
          headers: {
            Authorization: req.headers.get("Authorization")!,
          },
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
    const {
      organization_id,
      product_id,
      promotion_code,
      payment_method_id,
    }: SubscriptionRequest = await req.json();

    console.log(
      `Creating/updating subscription - org: ${organization_id}, product: ${product_id}, promo: ${promotion_code || "none"}`
    );

    if (!organization_id || !product_id) {
      return new Response(
        JSON.stringify({ error: "organization_id and product_id required" }),
        { status: 400 }
      );
    }

    // 3. Billing record
    const { data: billing } = await supabase
      .from("organization_billing")
      .select("organization_id, plan, stripe_customer_id, stripe_subscription_id")
      .eq("organization_id", organization_id)
      .single();

    if (!billing) {
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

    // 4. Handle downgrade to free plan
    if (product_id === "free") {
      if (billing.stripe_subscription_id) {
        // Cancel subscription at period end
        const subscription = await stripe.subscriptions.update(
          billing.stripe_subscription_id,
          {
            cancel_at_period_end: true,
            metadata: {
              downgrade_to: "free",
              organization_id,
              user_id: user.id,
            },
          }
        );

        const response: SubscriptionResponse = {
          subscription_id: subscription.id,
          status: "scheduled_cancellation",
          action: "scheduled_downgrade",
          effective_at: new Date(
            subscription.current_period_end * 1000
          ).toISOString(),
          plan: "free",
        };

        return new Response(JSON.stringify(response), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // No subscription to cancel
      return new Response(
        JSON.stringify({
          status: "already_free",
          action: "updated",
          plan: "free",
        } as SubscriptionResponse),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // 5. Get all price IDs for the product (moved before payment method check)
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

    // Calculate total price for licensed items
    let totalPrice = 0;
    for (const price of prices.data) {
      if (price.unit_amount && price.recurring?.usage_type === "licensed") {
        totalPrice += price.unit_amount;
      }
    }

    // 6. Get product to extract plan from metadata
    const product = await stripe.products.retrieve(product_id);
    const targetRank = parseInt(product.metadata?.rank || "0");

    // Get plan from product metadata
    let plan = product.metadata?.plan?.toLowerCase();
    if (!plan) {
      const productName = (product.name || "").toLowerCase();
      if (productName.includes("team")) {
        plan = "team";
      } else if (productName.includes("pro")) {
        plan = "pro";
      } else if (productName.includes("free")) {
        plan = "free";
      } else {
        plan = "pro";
        console.warn(
          `Could not determine plan from product ${product_id}, defaulting to "pro"`
        );
      }
    }

    const validPlan = ["free", "pro", "team"].includes(plan) ? plan : "pro";

    // 7. Validate promotion code if provided (moved before payment method check)
    let validPromoCodeId: string | undefined;
    let validCoupon: Stripe.Coupon | null = null;
    let isFullyCovered = false;

    if (promotion_code) {
      const promoCodes = await stripe.promotionCodes.list({
        code: promotion_code,
        active: true,
        limit: 1,
      });

      if (promoCodes.data.length > 0) {
        const promoCode = promoCodes.data[0];

        // Get coupon - handle nested structure (some API versions have promotion.coupon)
        let coupon: Stripe.Coupon | null = null;

        if (typeof promoCode.coupon === "string") {
          try {
            coupon = await stripe.coupons.retrieve(promoCode.coupon);
          } catch {
            // Coupon not found
          }
        } else if (promoCode.coupon && typeof promoCode.coupon === "object") {
          coupon = promoCode.coupon as Stripe.Coupon;
        } else {
          // Try nested promotion.coupon structure
          const rawPromoCode = promoCode as Record<string, unknown>;
          if (rawPromoCode.promotion && typeof rawPromoCode.promotion === "object") {
            const promotion = rawPromoCode.promotion as Record<string, unknown>;
            if (promotion.coupon && typeof promotion.coupon === "string") {
              try {
                coupon = await stripe.coupons.retrieve(promotion.coupon as string);
              } catch {
                // Coupon not found
              }
            }
          }
        }

        // Validate coupon restrictions
        let isValid = !!coupon;
        if (coupon) {
          const appliesTo = coupon.applies_to as { products?: string[] } | undefined;
          if (appliesTo?.products && Array.isArray(appliesTo.products)) {
            if (!appliesTo.products.includes(product_id)) {
              isValid = false;
            }
          }
          if (coupon.max_redemptions && coupon.times_redeemed !== undefined) {
            if (coupon.times_redeemed >= coupon.max_redemptions) {
              isValid = false;
            }
          }
          if (coupon.redeem_by && coupon.redeem_by < Math.floor(Date.now() / 1000)) {
            isValid = false;
          }
        }

        if (isValid && coupon) {
          validPromoCodeId = promoCode.id;
          validCoupon = coupon;

          // Check if coupon fully covers the price (100% off)
          if (coupon.percent_off === 100) {
            isFullyCovered = true;
          } else if (coupon.amount_off && coupon.amount_off >= totalPrice) {
            isFullyCovered = true;
          }
        }
      }
    }

    console.log(
      `Coupon validation - valid: ${!!validPromoCodeId}, isFullyCovered: ${isFullyCovered}, totalPrice: ${totalPrice}`
    );

    // 8. Get payment method (skip if fully covered by coupon)
    let defaultPaymentMethod: Stripe.PaymentMethod | null = null;

    if (!isFullyCovered) {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: billing.stripe_customer_id,
        type: "card",
      });

      if (paymentMethods.data.length === 0) {
        return new Response(
          JSON.stringify({
            error: "No payment method found. Please add a payment method first.",
          }),
          { status: 400 }
        );
      }

      defaultPaymentMethod =
        payment_method_id
          ? paymentMethods.data.find((pm) => pm.id === payment_method_id) ||
            paymentMethods.data[0]
          : paymentMethods.data[0];
    } else {
      // For 100% off coupon, try to get payment method but don't require it
      const paymentMethods = await stripe.paymentMethods.list({
        customer: billing.stripe_customer_id,
        type: "card",
      });
      if (paymentMethods.data.length > 0) {
        defaultPaymentMethod =
          payment_method_id
            ? paymentMethods.data.find((pm) => pm.id === payment_method_id) ||
              paymentMethods.data[0]
            : paymentMethods.data[0];
      }
    }

    // 9. Check if we need to upgrade, downgrade, or create new subscription
    if (billing.stripe_subscription_id) {
      // Has existing subscription - need to update or schedule
      const currentSub = await stripe.subscriptions.retrieve(
        billing.stripe_subscription_id
      );

      const currentProductId = currentSub.items.data[0]?.price?.product as string;
      let currentRank = 0;

      if (currentProductId) {
        const currentProduct = await stripe.products.retrieve(currentProductId);
        currentRank = parseInt(currentProduct.metadata?.rank || "0");
      }

      const isDowngrade = targetRank < currentRank;

      if (isDowngrade) {
        // 10a. DOWNGRADE: Use Subscription Schedule to change at period end

        // Check if there's already an active schedule
        const existingSchedules = await stripe.subscriptionSchedules.list({
          customer: billing.stripe_customer_id,
          limit: 10,
        });

        const activeSchedule = existingSchedules.data.find(
          (s) =>
            s.status === "active" &&
            s.subscription === billing.stripe_subscription_id
        );

        let schedule: Stripe.SubscriptionSchedule;

        if (activeSchedule) {
          // Update existing schedule
          schedule = await stripe.subscriptionSchedules.update(activeSchedule.id, {
            phases: [
              {
                items: currentSub.items.data.map((item) => ({
                  price: item.price.id,
                  quantity: item.quantity,
                })),
                start_date: activeSchedule.phases[0].start_date,
                end_date: currentSub.current_period_end,
              },
              {
                items: prices.data.map((price) => ({
                  price: price.id,
                })),
                start_date: currentSub.current_period_end,
                ...(validPromoCodeId && { coupon: validPromoCodeId }),
                metadata: {
                  organization_id,
                  user_id: user.id,
                  plan: validPlan,
                },
              },
            ],
          });
        } else {
          // Create schedule from existing subscription
          schedule = await stripe.subscriptionSchedules.create({
            from_subscription: billing.stripe_subscription_id,
          });

          // Update the schedule with two phases
          schedule = await stripe.subscriptionSchedules.update(schedule.id, {
            phases: [
              {
                items: currentSub.items.data.map((item) => ({
                  price: item.price.id,
                  quantity: item.quantity,
                })),
                start_date: schedule.phases[0].start_date,
                end_date: currentSub.current_period_end,
              },
              {
                items: prices.data.map((price) => ({
                  price: price.id,
                })),
                start_date: currentSub.current_period_end,
                ...(validPromoCodeId && { coupon: validPromoCodeId }),
                metadata: {
                  organization_id,
                  user_id: user.id,
                  plan: validPlan,
                },
              },
            ],
          });
        }

        const response: SubscriptionResponse = {
          subscription_id: billing.stripe_subscription_id,
          schedule_id: schedule.id,
          status: "scheduled",
          action: "scheduled_downgrade",
          effective_at: new Date(
            currentSub.current_period_end * 1000
          ).toISOString(),
          plan: validPlan,
        };

        return new Response(JSON.stringify(response), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // 10b. UPGRADE or SAME TIER: Update subscription immediately

      // Build subscription items update
      const updateItems: Stripe.SubscriptionUpdateParams.Item[] = [];

      // Replace existing items with new prices
      for (let i = 0; i < Math.max(currentSub.items.data.length, prices.data.length); i++) {
        const existingItem = currentSub.items.data[i];
        const newPrice = prices.data[i];

        if (existingItem && newPrice) {
          // Replace item
          updateItems.push({
            id: existingItem.id,
            price: newPrice.id,
          });
        } else if (existingItem && !newPrice) {
          // Delete extra item
          updateItems.push({
            id: existingItem.id,
            deleted: true,
          });
        } else if (!existingItem && newPrice) {
          // Add new item
          updateItems.push({
            price: newPrice.id,
          });
        }
      }

      const updateParams: Stripe.SubscriptionUpdateParams = {
        items: updateItems,
        proration_behavior: "create_prorations",
        metadata: {
          organization_id,
          user_id: user.id,
          plan: validPlan,
          activated_with_promo: isFullyCovered ? "true" : undefined,
        },
      };

      // Only set payment method if available
      if (defaultPaymentMethod) {
        updateParams.default_payment_method = defaultPaymentMethod.id;
      }

      // Add discount if valid promotion code (Stripe API uses discounts array)
      if (validPromoCodeId) {
        updateParams.discounts = [{ promotion_code: validPromoCodeId }];
      }

      // Cancel any existing schedule (upgrade overrides scheduled downgrade)
      const existingSchedules = await stripe.subscriptionSchedules.list({
        customer: billing.stripe_customer_id,
        limit: 10,
      });

      for (const schedule of existingSchedules.data) {
        if (
          schedule.status === "active" &&
          schedule.subscription === billing.stripe_subscription_id
        ) {
          await stripe.subscriptionSchedules.release(schedule.id);
        }
      }

      const subscription = await stripe.subscriptions.update(
        billing.stripe_subscription_id,
        updateParams
      );

      const response: SubscriptionResponse = {
        subscription_id: subscription.id,
        status: subscription.status,
        action: "updated",
        plan: validPlan,
      };

      return new Response(JSON.stringify(response), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 11. No existing subscription - create new one

    const createParams: Stripe.SubscriptionCreateParams = {
      customer: billing.stripe_customer_id,
      items: prices.data.map((price) => ({
        price: price.id,
      })),
      metadata: {
        organization_id,
        user_id: user.id,
        plan: validPlan,
        activated_with_promo: isFullyCovered ? "true" : undefined,
      },
    };

    // Only set payment method if available
    if (defaultPaymentMethod) {
      createParams.default_payment_method = defaultPaymentMethod.id;
    }

    // Add discount if valid promotion code (Stripe API uses discounts array)
    if (validPromoCodeId) {
      createParams.discounts = [{ promotion_code: validPromoCodeId }];
    }

    const subscription = await stripe.subscriptions.create(createParams);

    const response: SubscriptionResponse = {
      subscription_id: subscription.id,
      status: subscription.status,
      action: "created",
      plan: validPlan,
    };

    return new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error in create-subscription:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal Server Error",
      }),
      { status: 500 }
    );
  }
});
