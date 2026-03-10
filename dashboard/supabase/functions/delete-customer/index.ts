// supabase/functions/delete-customer/index.ts
// Delete Stripe customer and cancel any active subscriptions when organization is deleted

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@20.3.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

interface DeleteCustomerRequest {
  organization_id: string;
}

interface DeleteCustomerResponse {
  success: boolean;
  customer_deleted?: boolean;
  subscription_cancelled?: boolean;
  error?: string;
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
    const { organization_id }: DeleteCustomerRequest = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "organization_id required" }),
        { status: 400 }
      );
    }

    console.log(`Deleting Stripe customer for organization: ${organization_id}`);

    // 3. Get billing record
    const { data: billing, error: billingError } = await supabase
      .from("organization_billing")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("organization_id", organization_id)
      .single();

    if (billingError || !billing) {
      // No billing record, nothing to clean up
      console.log("No billing record found, skipping Stripe cleanup");
      return new Response(
        JSON.stringify({
          success: true,
          customer_deleted: false,
          subscription_cancelled: false,
        } as DeleteCustomerResponse),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    let subscriptionCancelled = false;
    let customerDeleted = false;

    // 4. Cancel subscription if exists
    if (billing.stripe_subscription_id) {
      try {
        console.log(`Cancelling subscription: ${billing.stripe_subscription_id}`);
        await stripe.subscriptions.cancel(billing.stripe_subscription_id, {
          prorate: false, // Don't prorate since we're deleting everything
        });
        subscriptionCancelled = true;
        console.log("Subscription cancelled successfully");
      } catch (err) {
        // Subscription might already be cancelled or deleted
        console.warn(`Failed to cancel subscription: ${err}`);
      }
    }

    // 5. Delete customer if exists
    if (billing.stripe_customer_id) {
      try {
        console.log(`Deleting customer: ${billing.stripe_customer_id}`);
        await stripe.customers.del(billing.stripe_customer_id);
        customerDeleted = true;
        console.log("Customer deleted successfully");
      } catch (err) {
        // Customer might already be deleted
        console.warn(`Failed to delete customer: ${err}`);
      }
    }

    const response: DeleteCustomerResponse = {
      success: true,
      customer_deleted: customerDeleted,
      subscription_cancelled: subscriptionCancelled,
    };

    return new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error in delete-customer:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Internal Server Error",
      } as DeleteCustomerResponse),
      { status: 500 }
    );
  }
});
