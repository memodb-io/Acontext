import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 内置产品ID
const PRODUCT_IDS = ["prod_TdbjWmNvEWDcX5", "prod_Tdblrdy2uemVy8"];

Deno.serve(async (_req: Request) => {
  try {
    // 创建 stripe schema 的客户端（用于访问 stripe schema 的表）
    const supabaseStripe = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        db: { schema: "stripe" },
      }
    );

    // 如果需要访问其他 schema（如 public），可以创建额外的客户端
    const supabasePublic = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        db: { schema: "public" }, // 或者不指定 schema，默认就是 public
      }
    );

    // 并行查询 products 和 product_plans（这两个查询互不依赖）
    const [productsResult, productPlansResult] = await Promise.all([
      supabaseStripe
        .from("products")
        .select("id, name, default_price, attrs")
        .in("id", PRODUCT_IDS),
      supabasePublic
        .from("product_plans")
        .select("plan, product, description"),
    ]);

    const { data: products, error: productsError } = productsResult;
    const { data: productPlans, error: productPlansError } = productPlansResult;

    if (productsError) {
      console.error("Error fetching products:", productsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch products" }),
        { status: 500 }
      );
    }

    if (productPlansError) {
      console.error("Error fetching product plans:", productPlansError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch product plans" }),
        { status: 500 }
      );
    }

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ prices: [], product: productPlans }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 提取所有 default_price IDs
    const priceIds = products
      .map((product: { default_price: string | null }) => product.default_price)
      .filter(
        (priceId: string | null | undefined): priceId is string =>
          priceId !== null && priceId !== undefined
      );

    if (priceIds.length === 0) {
      return new Response(
        JSON.stringify({ prices: [], product: productPlans }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 通过 default_price 查询 prices 表获取价格信息
    // 注意：recurring 在 attrs.recurring 中
    const { data: prices, error: pricesError } = await supabaseStripe
      .from("prices")
      .select("id, product, unit_amount, currency, attrs")
      .in("id", priceIds);

    if (pricesError) {
      console.error("Error fetching prices:", pricesError);
      return new Response(JSON.stringify({ error: "Failed to fetch prices" }), {
        status: 500,
      });
    }

    // 合并产品信息和价格信息，从 attrs 中提取 recurring 和其他信息
    const pricesWithProductName = (prices || []).map(
      (price: {
        id: string;
        product: string;
        unit_amount: number;
        currency: string;
        attrs: {
          recurring?: {
            interval: string;
            interval_count: number;
            usage_type?: string;
            meter?: string | null;
            trial_period_days?: number | null;
          };
          metadata?: { [key: string]: string };
        } | null;
      }) => {
        const product = products.find(
          (p: {
            default_price: string | null;
            attrs?: { metadata?: { rank?: string } } | null;
          }) => p.default_price === price.id
        );
        
        // 从 attrs.recurring 中提取 recurring 信息，提供默认值
        const recurringData = price.attrs?.recurring;
        const recurring = {
          interval: recurringData?.interval || "month",
          interval_count: recurringData?.interval_count || 1,
          usage_type: recurringData?.usage_type || "licensed",
          meter: recurringData?.meter || null,
          trial_period_days: recurringData?.trial_period_days || null,
        };
        
        // 从 product.attrs.metadata.rank 中提取 rank，如果没有则返回 999（排在最后）
        const rank = product?.attrs?.metadata?.rank
          ? parseInt(product.attrs.metadata.rank, 10)
          : 999;
        
        // 如果产品有名称且不为空，使用产品名称；否则使用产品 ID 作为后备
        const productName = product?.name?.trim() || `Product ${price.product.slice(-6)}`;

        return {
          id: price.id,
          product: price.product,
          unit_amount: price.unit_amount,
          currency: price.currency,
          recurring: recurring,
          name: productName,
          rank: rank,
        };
      }
    );

    // 按 rank 增序排序
    const sortedPrices = pricesWithProductName.sort((a, b) => a.rank - b.rank);

    return new Response(
      JSON.stringify({ prices: sortedPrices, product: productPlans }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }
});
