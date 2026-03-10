// supabase/functions/create-setup-intent/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@20.3.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

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
    const { organization_id } = await req.json();
    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "organization_id required" }),
        { status: 400 }
      );
    }

    // 3. Billing record
    const { data: billing } = await supabase
      .from("organization_billing")
      .select("organization_id, plan, stripe_customer_id")
      .eq("organization_id", organization_id)
      .single();

    if (!billing) {
      return new Response(
        JSON.stringify({ error: "Billing record not found" }),
        { status: 404 }
      );
    }

    // Allow all plans to create setup intent
    // Organizations are created with "free" plan and users add payment methods to subscribe

    // 4. Get or create customer
    let customerId = billing.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: {
          user_id: user.id,
          organization_id,
        },
      });

      customerId = customer.id;

      await supabase
        .from("organization_billing")
        .update({ stripe_customer_id: customerId })
        .eq("organization_id", organization_id);
    }

    // 5. SetupIntent
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      usage: "off_session",
    });

    return new Response(
      JSON.stringify({ client_secret: setupIntent.client_secret }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }
});
