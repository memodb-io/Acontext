// supabase/functions/stripe-webhook/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@20.3.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

// This is needed in order to use the Web Crypto API in Deno.
const cryptoProvider = Stripe.createSubtleCryptoProvider();

console.log("Stripe Webhook Function booted!");

/**
 * Extract plan from subscription metadata or product metadata
 */
async function getPlanFromSubscription(
  subscription: Stripe.Subscription
): Promise<string> {
  // Check subscription metadata first
  if (subscription.metadata?.plan) {
    const plan = subscription.metadata.plan.toLowerCase();
    console.log(`Using plan from subscription metadata: ${plan}`);
    return plan;
  }

  // Fallback: Get the product ID from the subscription items
  const productId = subscription.items.data[0]?.price?.product as string;
  if (!productId) {
    console.error("No product ID in subscription");
    return "pro"; // Default fallback
  }

  // Get product to extract plan from metadata
  const product = await stripe.products.retrieve(productId);
  console.log(
    `Product ID: ${productId}, Product name: ${product.name}, Product metadata:`,
    product.metadata
  );

  // Get plan from product metadata
  let plan = product.metadata?.plan?.toLowerCase();

  // If not in metadata, try to infer from product name
  if (!plan) {
    const productName = (product.name || "").toLowerCase();
    if (productName.includes("team")) {
      plan = "team";
    } else if (productName.includes("pro")) {
      plan = "pro";
    } else if (productName.includes("free")) {
      plan = "free";
    } else {
      // Fallback to "pro" if cannot determine
      plan = "pro";
      console.warn(
        `Could not determine plan from product ${productId}, defaulting to "pro"`
      );
    }
  }

  return plan;
}

/**
 * Get current_period_end from subscription, with fallback to API call
 */
async function getPeriodEnd(
  subscription: Stripe.Subscription
): Promise<string | null> {
  let currentPeriodEnd: number | null = null;

  if (subscription.current_period_end) {
    currentPeriodEnd = subscription.current_period_end;
  } else if (subscription.items?.data?.[0]?.current_period_end) {
    currentPeriodEnd = subscription.items.data[0].current_period_end;
  } else {
    // If not in webhook event, retrieve full subscription from Stripe
    console.log(
      `current_period_end not found in webhook event, retrieving from Stripe API...`
    );
    const fullSubscription = await stripe.subscriptions.retrieve(
      subscription.id
    );
    currentPeriodEnd = fullSubscription.current_period_end;
  }

  return currentPeriodEnd
    ? new Date(currentPeriodEnd * 1000).toISOString()
    : null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const signature = req.headers.get("Stripe-Signature");
  if (!signature) {
    return new Response(
      JSON.stringify({ error: "Missing Stripe-Signature header" }),
      {
        status: 400,
      }
    );
  }

  // First step is to verify the event. The .text() method must be used as the
  // verification relies on the raw request body rather than the parsed JSON.
  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
      undefined,
      cryptoProvider
    );
  } catch (err: unknown) {
    console.error("Webhook signature verification failed:", err);
    const message =
      err instanceof Error ? err.message : "Webhook signature verification failed";
    return new Response(message, {
      status: 400,
    });
  }

  console.log(`🔔 Event received: ${event.id} (${event.type})`);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const organizationId = subscription.metadata.organization_id;

        if (!organizationId) {
          console.error("No organization_id in subscription metadata");
          break;
        }

        console.log(
          `Subscription ${subscription.id} status: ${subscription.status}`
        );

        // Handle terminal/failed subscription states — reset to free
        if (
          subscription.status === "incomplete_expired" ||
          subscription.status === "canceled" ||
          subscription.status === "unpaid"
        ) {
          console.log(
            `Subscription ${subscription.id} is in terminal state "${subscription.status}", resetting organization ${organizationId} to free plan`
          );

          const { error } = await supabase
            .from("organization_billing")
            .update({
              plan: "free",
              stripe_subscription_id: null,
              period_end: null,
              pending_plan: null,
              payment_status: "ok",
            })
            .eq("organization_id", organizationId);

          if (error) {
            console.error(
              `Error resetting plan for organization ${organizationId}:`,
              error
            );
            throw error;
          }

          console.log(
            `Reset organization ${organizationId} to free plan due to subscription status: ${subscription.status}`
          );
          break;
        }

        // Only activate plan for subscriptions that have successfully started
        if (
          subscription.status !== "active" &&
          subscription.status !== "trialing"
        ) {
          console.log(
            `Subscription ${subscription.id} status is "${subscription.status}", skipping plan activation for organization ${organizationId}`
          );
          break;
        }

        // Check if subscription is scheduled for cancellation
        if (subscription.cancel_at_period_end) {
          const downgradeTarget = subscription.metadata.downgrade_to;
          const validDowngradePlans = ["free", "pro", "team"];
          const validatedDowngrade = (downgradeTarget && validDowngradePlans.includes(downgradeTarget)) ? downgradeTarget : undefined;
          console.log(
            `Subscription ${subscription.id} is scheduled for cancellation${
              validatedDowngrade ? ` (downgrade to ${validatedDowngrade})` : ""
            }`
          );

          // Always update period_end and stripe_subscription_id even when scheduled for cancellation
          const periodEnd = await getPeriodEnd(subscription);
          const updateData: Record<string, unknown> = {
            stripe_subscription_id: subscription.id,
            period_end: periodEnd,
          };
          if (validatedDowngrade) {
            updateData.pending_plan = validatedDowngrade;
          }

          const { error } = await supabase
            .from("organization_billing")
            .update(updateData)
            .eq("organization_id", organizationId);

          if (error) {
            console.error(
              `Error updating organization ${organizationId} for scheduled cancellation:`,
              error
            );
          } else {
            console.log(
              `Updated organization ${organizationId}: period_end=${periodEnd}${
                validatedDowngrade ? `, pending_plan=${validatedDowngrade}` : ""
              }`
            );
          }
          break;
        }

        // Get plan from subscription
        const plan = await getPlanFromSubscription(subscription);
        const validPlan = ["free", "pro", "team"].includes(plan) ? plan : "pro";
        console.log(`Final plan for organization ${organizationId}: ${validPlan}`);

        // Get period end
        const periodEnd = await getPeriodEnd(subscription);
        console.log(
          `Updating organization ${organizationId} with period_end: ${periodEnd}`
        );

        const { data, error } = await supabase
          .from("organization_billing")
          .update({
            plan: validPlan,
            stripe_subscription_id: subscription.id,
            period_end: periodEnd,
            pending_plan: null, // Clear any pending plan
            payment_status: "ok", // Clear any payment failure state
          })
          .eq("organization_id", organizationId)
          .select();

        if (error) {
          console.error(
            `Error updating subscription for organization ${organizationId}:`,
            error
          );
          throw error;
        }

        console.log(
          `Updated subscription for organization ${organizationId} with plan ${validPlan}, period_end: ${periodEnd}`,
          data
        );
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const organizationId = subscription.metadata.organization_id;

        if (!organizationId) {
          console.error("No organization_id in subscription metadata");
          break;
        }

        // Check if this was a scheduled downgrade — validate against known plans
        const validPlans = ["free", "pro", "team"];
        const downgradeTarget = subscription.metadata.downgrade_to;
        const validatedPlan = (downgradeTarget && validPlans.includes(downgradeTarget)) ? downgradeTarget : "free";

        // Reset to free plan when subscription is cancelled
        const { error } = await supabase
          .from("organization_billing")
          .update({
            plan: validatedPlan,
            stripe_subscription_id: null,
            period_end: null,
            pending_plan: null,
            payment_status: "ok",
          })
          .eq("organization_id", organizationId);

        if (error) {
          console.error(
            `Error resetting plan for organization ${organizationId}:`,
            error
          );
          throw error;
        }

        console.log(
          `Cancelled subscription for organization ${organizationId}, reset to ${validatedPlan} plan`
        );
        break;
      }

      case "subscription_schedule.created":
      case "subscription_schedule.updated": {
        const schedule = event.data.object as Stripe.SubscriptionSchedule;
        console.log(
          `Subscription schedule ${schedule.id} ${event.type}, status: ${schedule.status}`
        );

        // Get organization_id from schedule metadata or subscription
        let organizationId: string | undefined;

        // Check phases for metadata
        for (const phase of schedule.phases) {
          if (phase.metadata?.organization_id) {
            organizationId = phase.metadata.organization_id;
            break;
          }
        }

        // Fallback: get from subscription if schedule is attached
        if (!organizationId && schedule.subscription) {
          const subscriptionId =
            typeof schedule.subscription === "string"
              ? schedule.subscription
              : schedule.subscription.id;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          organizationId = subscription.metadata.organization_id;
        }

        if (!organizationId) {
          console.log("No organization_id found for schedule, skipping...");
          break;
        }

        // Get the next phase's plan (the downgrade target)
        const nextPhase = schedule.phases[1]; // Second phase is the downgrade
        if (nextPhase && schedule.status === "active") {
          const pendingPlan = nextPhase.metadata?.plan;
          if (pendingPlan) {
            const { error } = await supabase
              .from("organization_billing")
              .update({
                pending_plan: pendingPlan,
              })
              .eq("organization_id", organizationId);

            if (error) {
              console.error(
                `Error setting pending_plan for organization ${organizationId}:`,
                error
              );
            } else {
              console.log(
                `Set pending_plan to ${pendingPlan} for organization ${organizationId}`
              );
            }
          }
        }
        break;
      }

      case "subscription_schedule.completed": {
        const schedule = event.data.object as Stripe.SubscriptionSchedule;
        console.log(
          `Subscription schedule ${schedule.id} completed, subscription: ${schedule.subscription}`
        );

        // The subscription has been updated to the new plan
        // customer.subscription.updated will handle the actual plan update
        // Just clear the pending_plan here

        let organizationId: string | undefined;

        // Get from phases metadata
        for (const phase of schedule.phases) {
          if (phase.metadata?.organization_id) {
            organizationId = phase.metadata.organization_id;
            break;
          }
        }

        if (organizationId) {
          const { error } = await supabase
            .from("organization_billing")
            .update({
              pending_plan: null,
            })
            .eq("organization_id", organizationId);

          if (error) {
            console.error(
              `Error clearing pending_plan for organization ${organizationId}:`,
              error
            );
          } else {
            console.log(`Cleared pending_plan for organization ${organizationId}`);
          }
        }
        break;
      }

      case "subscription_schedule.canceled":
      case "subscription_schedule.released": {
        const schedule = event.data.object as Stripe.SubscriptionSchedule;
        console.log(`Subscription schedule ${schedule.id} ${event.type}`);

        // Clear pending_plan when schedule is cancelled or released
        let organizationId: string | undefined;

        for (const phase of schedule.phases) {
          if (phase.metadata?.organization_id) {
            organizationId = phase.metadata.organization_id;
            break;
          }
        }

        if (!organizationId && schedule.subscription) {
          const subscriptionId =
            typeof schedule.subscription === "string"
              ? schedule.subscription
              : schedule.subscription.id;
          try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            organizationId = subscription.metadata.organization_id;
          } catch (e) {
            console.log("Could not retrieve subscription:", e);
          }
        }

        if (organizationId) {
          const { error } = await supabase
            .from("organization_billing")
            .update({
              pending_plan: null,
            })
            .eq("organization_id", organizationId);

          if (error) {
            console.error(
              `Error clearing pending_plan for organization ${organizationId}:`,
              error
            );
          } else {
            console.log(
              `Cleared pending_plan for organization ${organizationId} (schedule ${event.type})`
            );
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        if (!subscriptionId) {
          break;
        }

        // Get subscription to find organization_id
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const organizationId = subscription.metadata.organization_id;

        if (!organizationId) {
          console.error("No organization_id in subscription metadata");
          break;
        }

        // Update period_end on successful payment
        const periodEnd = await getPeriodEnd(subscription);
        console.log(
          `Updating period_end for organization ${organizationId} to: ${periodEnd}`
        );

        // Determine invoice type so we only clear the matching payment_status.
        // Plan invoice success clears 'past_due'; metered invoice success clears 'blocked'.
        // This prevents a plan invoice success from incorrectly clearing a 'blocked' state
        // caused by an unpaid metered invoice (and vice-versa).
        const hasMeteredLineItems = invoice.lines?.data?.some(
          (line) => {
            const price = line.price as Stripe.Price;
            return price?.type === "metered" || price?.recurring?.meter != null;
          }
        );
        const isMeteredInvoice =
          invoice.billing_reason === "subscription_threshold" || hasMeteredLineItems;

        // Fetch current payment_status to decide whether to clear it
        const { data: currentBilling } = await supabase
          .from("organization_billing")
          .select("payment_status")
          .eq("organization_id", organizationId)
          .maybeSingle();

        const currentStatus = currentBilling?.payment_status || "ok";
        let newPaymentStatus = currentStatus;
        if (isMeteredInvoice && currentStatus === "blocked") {
          newPaymentStatus = "ok";
        } else if (!isMeteredInvoice && currentStatus === "past_due") {
          newPaymentStatus = "ok";
        }

        const { data, error } = await supabase
          .from("organization_billing")
          .update({
            period_end: periodEnd,
            payment_status: newPaymentStatus,
          })
          .eq("organization_id", organizationId)
          .select();

        if (error) {
          console.error(
            `Error updating period_end for organization ${organizationId}:`,
            error
          );
          throw error;
        }

        console.log(
          `Payment succeeded for organization ${organizationId}, period_end updated to: ${periodEnd}, payment_status: ${currentStatus} → ${newPaymentStatus} (${isMeteredInvoice ? "metered" : "plan"} invoice)`,
          data
        );
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        if (!subscriptionId) {
          break;
        }

        // Get subscription to find organization_id
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const organizationId = subscription.metadata.organization_id;

        if (!organizationId) {
          console.error("No organization_id in subscription metadata");
          break;
        }

        console.error(`Payment failed for organization ${organizationId}, billing_reason: ${invoice.billing_reason}`);

        // Determine if this is a metered usage invoice or a plan subscription invoice.
        // Legacy metered prices have price.type === 'metered'.
        // New Stripe Billing Meters have price.type === 'recurring' with price.recurring.meter set.
        // billing_reason === 'subscription_threshold' also indicates metered usage.
        const hasMeteredLineItems = invoice.lines?.data?.some(
          (line) => {
            const price = line.price as Stripe.Price;
            return price?.type === "metered" || price?.recurring?.meter != null;
          }
        );
        const isMeteredInvoice =
          invoice.billing_reason === "subscription_threshold" || hasMeteredLineItems;

        if (isMeteredInvoice) {
          // Metered usage payment failed → hard block all writes
          console.log(
            `Metered usage payment failed for organization ${organizationId}, setting payment_status to blocked`
          );

          const { error } = await supabase
            .from("organization_billing")
            .update({
              payment_status: "blocked",
            })
            .eq("organization_id", organizationId);

          if (error) {
            console.error(
              `Error setting payment_status=blocked for organization ${organizationId}:`,
              error
            );
          } else {
            console.log(
              `Set payment_status=blocked for organization ${organizationId} due to metered payment failure`
            );
          }
        } else {
          // Plan subscription payment failed → set past_due and schedule downgrade to free
          console.log(
            `Plan payment failed for organization ${organizationId}, setting payment_status to past_due and scheduling downgrade`
          );

          const { error: statusError } = await supabase
            .from("organization_billing")
            .update({
              payment_status: "past_due",
            })
            .eq("organization_id", organizationId);

          if (statusError) {
            console.error(
              `Error setting payment_status=past_due for organization ${organizationId}:`,
              statusError
            );
          }

          // Schedule downgrade to free plan
          try {
            await stripe.subscriptions.update(subscriptionId, {
              cancel_at_period_end: true,
              metadata: {
                ...subscription.metadata,
                downgrade_to: "free",
                downgrade_reason: "plan_payment_failed",
              },
            });

            const { error } = await supabase
              .from("organization_billing")
              .update({
                pending_plan: "free",
              })
              .eq("organization_id", organizationId);

            if (error) {
              console.error(
                `Error setting pending_plan for organization ${organizationId}:`,
                error
              );
            } else {
              console.log(
                `Scheduled downgrade to free for organization ${organizationId} due to plan payment failure`
              );
            }
          } catch (err) {
            console.error(
              `Error scheduling downgrade for organization ${organizationId}:`,
              err
            );
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error processing webhook:", err);
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
      status: 500,
    });
  }
});
