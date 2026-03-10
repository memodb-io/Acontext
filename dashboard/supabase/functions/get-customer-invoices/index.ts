// supabase/functions/get-customer-invoices/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        db: { schema: 'stripe' }
      }
    );

    // 2. 解析请求 body
    const { organization_id } = await req.json();
    console.log("Received organization_id:", organization_id);

    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), { status: 400 });
    }

    // 3. 查询 Stripe Customer
    // 注意：Supabase JS 客户端不支持直接的 JSON 操作符语法
    // 需要先查询所有 customers，然后在 JavaScript 中过滤
    const { data: customers, error: customerError } = await supabase
      .from("customers")
      .select("id, attrs");

    if (customerError) {
      console.error("Error fetching customers:", customerError);
      return new Response(JSON.stringify({ invoices: [] }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Total customers found: ${customers?.length || 0}`);
    if (customers && customers.length > 0) {
      console.log("Sample customer attrs structure:", JSON.stringify(customers[0]?.attrs, null, 2));
      // 打印所有 customers 的 organization_id
      customers.forEach((c: { id: string; attrs?: { metadata?: { organization_id?: string } } | null }, index: number) => {
        const orgId = c.attrs?.metadata?.organization_id;
        console.log(`Customer ${index + 1} (id: ${c.id}) - organization_id: ${orgId}`);
      });
    }

    // 在 JavaScript 中过滤出匹配的 customer
    const customer = customers?.find(
      (c: { id: string; attrs?: { metadata?: { organization_id?: string } } | null }) =>
        c.attrs?.metadata?.organization_id === organization_id
    );

    if (!customer) {
      console.log(`No customer found for organization_id: ${organization_id}`);
      return new Response(JSON.stringify({ invoices: [] }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Found customer: ${customer.id} for organization_id: ${organization_id}`);

    // 4. 查询该 Customer 的发票
    // 注意：created 字段在 attrs JSON 中，不能直接在 SQL 中排序，需要在 JS 中排序
    const { data: invoicesData, error: invoicesError } = await supabase
      .from("invoices")
      .select("id, status, subscription, attrs")
      .eq("customer", customer.id);

    if (invoicesError) {
      console.error("Error fetching invoices:", invoicesError);
    }

    console.log(`Found ${invoicesData?.length || 0} invoices for customer ${customer.id}`);
    if (invoicesData && invoicesData.length > 0) {
      console.log("Sample invoice attrs structure:", JSON.stringify(invoicesData[0]?.attrs, null, 2));
    }

    // 5. 从 attrs 中提取所需字段
    const invoices = (invoicesData || []).map((invoice: {
      id: string;
      status: string;
      subscription: string | null;
      attrs: {
        amount_due?: number;
        amount_paid?: number;
        currency?: string;
        period_start?: number;
        period_end?: number;
        invoice_pdf?: string | null;
        hosted_invoice_url?: string | null;
        created?: number;
      } | null;
    }) => ({
      id: invoice.id,
      status: invoice.status,
      amount_due: invoice.attrs?.amount_due ?? 0,
      amount_paid: invoice.attrs?.amount_paid ?? 0,
      currency: invoice.attrs?.currency ?? "usd",
      subscription: invoice.subscription,
      period_start: invoice.attrs?.period_start ?? 0,
      period_end: invoice.attrs?.period_end ?? 0,
      invoice_pdf: invoice.attrs?.invoice_pdf ?? null,
      hosted_invoice_url: invoice.attrs?.hosted_invoice_url ?? null,
      created: invoice.attrs?.created ?? 0,
    }))
    // 按 created 时间降序排序（最新的在前）
    .sort((a: { created: number }, b: { created: number }) => b.created - a.created);

    console.log(`Returning ${invoices.length} invoices`);

    return new Response(JSON.stringify({ invoices }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
});
