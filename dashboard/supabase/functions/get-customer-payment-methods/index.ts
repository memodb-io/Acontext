// supabase/functions/get-customer-payment-methods/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@20.3.0";

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

    // 1. 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // 2. 解析请求 body
    const { organization_id } = await req.json();
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), { status: 400 });
    }

    // 3. 从 organization_billing 获取 stripe_customer_id
    const { data: billing, error: billingError } = await supabase
      .from("organization_billing")
      .select("stripe_customer_id")
      .eq("organization_id", organization_id)
      .single();

    if (billingError || !billing?.stripe_customer_id) {
      return new Response(JSON.stringify({ payment_methods: [] }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 4. 使用 Stripe API 查询绑定的卡
    const paymentMethods = await stripe.paymentMethods.list({
      customer: billing.stripe_customer_id,
      type: "card",
    });

    return new Response(JSON.stringify({ payment_methods: paymentMethods.data || [] }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
});
