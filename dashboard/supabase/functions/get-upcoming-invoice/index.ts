// supabase/functions/get-upcoming-invoice/index.ts
//
// Calculates overage for paid plans using local usage data + Stripe metered prices.
// This is more reliable than Stripe's upcoming invoice API because meter events
// may not have been aggregated yet at query time.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@20.3.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

// Stripe meter name → { usage field in organization_usage, max field in product_plans }
const METER_CONFIG: Record<
  string,
  { metricKey: string; usageField: string; maxField: string; label: string }
> = {
  agent_tasks: {
    metricKey: "current_task",
    usageField: "current_task",
    maxField: "max_task",
    label: "Agent Tasks",
  },
  skill_blocks: {
    metricKey: "current_skill",
    usageField: "current_skill",
    maxField: "max_skill",
    label: "Skill Blocks",
  },
  fast_skill_search: {
    metricKey: "current_fast_skill_search",
    usageField: "current_fast_skill_search",
    maxField: "max_fast_skill_search",
    label: "Fast Skill Search",
  },
  agentic_skill_search: {
    metricKey: "current_agentic_skill_search",
    usageField: "current_agentic_skill_search",
    maxField: "max_agentic_skill_search",
    label: "Agentic Skill Search",
  },
  storage_gb_hour: {
    metricKey: "current_storage",
    usageField: "current_storage",
    maxField: "max_storage",
    label: "Storage (GB·h)",
  },
};

const EMPTY_RESPONSE = JSON.stringify({
  line_items: [],
  total_overage: 0,
  currency: "usd",
});
const JSON_HEADERS = { "Content-Type": "application/json" };

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { organization_id } = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "organization_id required" }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch billing, usage, and plan limits in parallel
    const [billingResult, usageResult] = await Promise.all([
      supabase
        .from("organization_billing")
        .select("stripe_customer_id, stripe_subscription_id, plan")
        .eq("organization_id", organization_id)
        .maybeSingle(),
      supabase
        .from("organization_usage")
        .select(
          "current_task, current_skill, current_fast_skill_search, current_agentic_skill_search, current_storage"
        )
        .eq("organization_id", organization_id)
        .maybeSingle(),
    ]);

    if (billingResult.error) {
      console.error("Error fetching billing:", billingResult.error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch billing info" }),
        { status: 500, headers: JSON_HEADERS }
      );
    }

    const billing = billingResult.data;
    if (!billing || billing.plan === "free" || !billing.stripe_subscription_id) {
      return new Response(EMPTY_RESPONSE, { headers: JSON_HEADERS });
    }

    // Fetch plan limits
    const { data: planLimits } = await supabase
      .from("product_plans")
      .select(
        "max_task, max_skill, max_fast_skill_search, max_agentic_skill_search, max_storage"
      )
      .eq("plan", billing.plan)
      .maybeSingle();

    if (!planLimits) {
      console.error(`No product_plans found for plan: ${billing.plan}`);
      return new Response(EMPTY_RESPONSE, { headers: JSON_HEADERS });
    }

    const usage = usageResult.data || {};

    // 2. Get metered prices from the subscription to know unit costs
    const subscription = await stripe.subscriptions.retrieve(
      billing.stripe_subscription_id
    );

    // Build a map of meter name → unit_amount (cents) from subscription items
    const meterUnitPrices = new Map<string, { unitAmount: number; currency: string }>();
    for (const item of subscription.items.data) {
      const price = item.price;
      const meterName = price.recurring?.meter;
      if (meterName && price.unit_amount != null) {
        meterUnitPrices.set(meterName, {
          unitAmount: price.unit_amount,
          currency: price.currency,
        });
      }
    }

    // 3. Calculate overage for each meter
    const lineItems: Array<{
      meter: string;
      metric_key: string;
      description: string;
      quantity: number;
      unit_amount: number;
      amount: number;
    }> = [];

    let totalOverage = 0;
    let currency = "usd";

    for (const [meterName, config] of Object.entries(METER_CONFIG)) {
      const currentUsage = (usage[config.usageField] as number) || 0;
      const maxAllowed = (planLimits[config.maxField] as number) || 0;
      const overage = Math.max(0, currentUsage - maxAllowed);

      if (overage <= 0) continue;

      const priceInfo = meterUnitPrices.get(meterName);
      const unitAmount = priceInfo?.unitAmount ?? 0;
      currency = priceInfo?.currency ?? "usd";
      const amount = overage * unitAmount;

      lineItems.push({
        meter: meterName,
        metric_key: config.metricKey,
        description: config.label,
        quantity: overage,
        unit_amount: unitAmount,
        amount,
      });
      totalOverage += amount;
    }

    return new Response(
      JSON.stringify({
        line_items: lineItems,
        total_overage: totalOverage,
        currency,
      }),
      { headers: JSON_HEADERS }
    );
  } catch (err) {
    console.error("Error calculating overage:", err);
    return new Response(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
});
