"use server";

import { createClient } from "@/lib/supabase/server";

// Plan description type (used in Product)
export interface PlanDescription {
  plan_desc: string;
  pkg_title: string;
  pkg: Array<{
    title: string;
    subtitle?: string;
  }>;
  original_amount?: number; // in cents, for showing strikethrough price
}

// Price type from Stripe
export interface Price {
  id: string;
  product: string;
  unit_amount: number; // in cents
  currency: string;
  recurring: {
    interval: string;
    interval_count: number;
    usage_type: string;
    meter: string | null;
    trial_period_days: number | null;
  };
  name: string;
  rank: number;
}

// Product type (combines Stripe product with plan info)
export interface Product {
  plan: string; // "free" | "pro" | "team"
  product: string; // Stripe product ID
  description: PlanDescription;
}

export interface GetPricesResult {
  prices: Price[];
  products: Product[];
  error?: string;
}

interface PricingData {
  prices: Price[];
  product: Product[];
}

/**
 * Get product prices and product plans from Stripe via Edge Function
 * This combines both prices and product_plans data in a single request
 */
export async function getPrices(): Promise<GetPricesResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.functions.invoke("get-prices-by-product");

    if (error) {
      console.error("Error fetching prices:", error);
      return { prices: [], products: [], error: error.message || "Failed to fetch prices" };
    }

    const response = data as PricingData;
    return {
      prices: response?.prices || [],
      products: response?.product || [],
    };
  } catch (error) {
    console.error("Error fetching prices:", error);
    return {
      prices: [],
      products: [],
      error: error instanceof Error ? error.message : "Failed to fetch prices",
    };
  }
}

export interface PaymentMethod {
  id: string;
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  billing_details: {
    name: string | null;
    email: string | null;
  };
}

export interface GetPaymentMethodsResult {
  paymentMethods?: PaymentMethod[];
  error?: string;
}

interface GetPaymentMethodsResponse {
  payment_methods: PaymentMethod[];
}

export async function getPaymentMethods(
  organizationId: string
): Promise<GetPaymentMethodsResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.functions.invoke(
      "get-customer-payment-methods",
      {
        body: { organization_id: organizationId },
      }
    );

    if (error) {
      console.error("Error fetching payment methods:", error);
      return { error: error.message || "Failed to fetch payment methods" };
    }

    return { paymentMethods: (data as GetPaymentMethodsResponse)?.payment_methods || [] };
  } catch (error) {
    console.error("Error fetching payment methods:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to fetch payment methods",
    };
  }
}

export interface Invoice {
  id: string;
  status: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  subscription: string | null;
  period_start: number;
  period_end: number;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
}

export interface GetInvoicesResult {
  invoices?: Invoice[];
  error?: string;
}

interface GetInvoicesResponse {
  invoices: Invoice[];
}

export async function getInvoices(
  organizationId: string
): Promise<GetInvoicesResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.functions.invoke(
      "get-customer-invoices",
      {
        body: { organization_id: organizationId },
      }
    );

    if (error) {
      console.error("Error fetching invoices:", error);
      return { error: error.message || "Failed to fetch invoices" };
    }

    return { invoices: (data as GetInvoicesResponse)?.invoices || [] };
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to fetch invoices",
    };
  }
}

export interface CreateSetupIntentResult {
  clientSecret?: string;
  error?: string;
}

interface CreateSetupIntentResponse {
  client_secret: string;
}

export async function createSetupIntent(
  organizationId: string
): Promise<CreateSetupIntentResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.functions.invoke(
      "create-setup-intent",
      {
        body: { organization_id: organizationId },
      }
    );

    if (error) {
      console.error("Error creating setup intent:", error);
      return { error: error.message || "Failed to create setup intent" };
    }

    return { clientSecret: (data as CreateSetupIntentResponse)?.client_secret };
  } catch (error) {
    console.error("Error creating setup intent:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to create setup intent",
    };
  }
}

// ============ Subscription Preview ============

export interface LineItemBreakdown {
  description: string;
  amount: number;
  proration: boolean;
}

export interface SubscriptionPreview {
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
  is_fully_covered?: boolean;
  current_period_end?: string;
  effective_at?: string;
}

export interface PreviewSubscriptionChangeResult {
  preview?: SubscriptionPreview;
  error?: string;
}

export async function previewSubscriptionChange(
  organizationId: string,
  productId: string,
  promotionCode?: string
): Promise<PreviewSubscriptionChangeResult> {
  try {
    console.log(
      `previewSubscriptionChange called - organizationId: ${organizationId}, productId: ${productId}, promotionCode: ${promotionCode || "none"}`
    );

    const supabase = await createClient();
    const { data, error } = await supabase.functions.invoke(
      "preview-subscription-change",
      {
        body: {
          organization_id: organizationId,
          product_id: productId,
          promotion_code: promotionCode,
        },
      }
    );

    if (error) {
      console.error("Error previewing subscription change:", error);
      return { error: error.message || "Failed to preview subscription change" };
    }

    // Check if the response contains an error
    if (data?.error) {
      return { error: data.error };
    }

    return { preview: data as SubscriptionPreview };
  } catch (error) {
    console.error("Error previewing subscription change:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to preview subscription change",
    };
  }
}

// ============ Create/Update Subscription ============

export interface CreateSubscriptionResult {
  subscriptionId?: string;
  scheduleId?: string;
  status?: string;
  action?: "created" | "updated" | "scheduled_downgrade" | "cancelled";
  effectiveAt?: string;
  plan?: string;
  error?: string;
}

interface CreateSubscriptionResponse {
  subscription_id?: string;
  schedule_id?: string;
  status: string;
  action: "created" | "updated" | "scheduled_downgrade" | "cancelled";
  effective_at?: string;
  plan?: string;
}

export async function createSubscription(
  organizationId: string,
  productId: string,
  promotionCode?: string,
  paymentMethodId?: string
): Promise<CreateSubscriptionResult> {
  try {
    console.log(
      `createSubscription called - organizationId: ${organizationId}, productId: ${productId}, promotionCode: ${promotionCode || "none"}`
    );

    const supabase = await createClient();
    const { data, error } = await supabase.functions.invoke(
      "create-subscription",
      {
        body: {
          organization_id: organizationId,
          product_id: productId,
          promotion_code: promotionCode,
          payment_method_id: paymentMethodId,
        },
      }
    );

    if (error) {
      console.error("Error creating subscription:", error);
      return { error: error.message || "Failed to create subscription" };
    }

    // Check if the response contains an error
    if (data?.error) {
      return { error: data.error };
    }

    const response = data as CreateSubscriptionResponse;
    return {
      subscriptionId: response?.subscription_id,
      scheduleId: response?.schedule_id,
      status: response?.status,
      action: response?.action,
      effectiveAt: response?.effective_at,
      plan: response?.plan,
    };
  } catch (error) {
    console.error("Error creating subscription:", error);
    return {
      error:
        error instanceof Error ? error.message : "Failed to create subscription",
    };
  }
}

// ============ Delete Customer ============

export interface DeleteCustomerResult {
  success: boolean;
  customerDeleted?: boolean;
  subscriptionCancelled?: boolean;
  error?: string;
}

interface DeleteCustomerResponse {
  success: boolean;
  customer_deleted?: boolean;
  subscription_cancelled?: boolean;
  error?: string;
}

/**
 * Delete Stripe customer and cancel subscriptions when organization is deleted
 */
// ============ Upcoming Invoice (Overage) ============

export interface OverageLineItem {
  meter: string;
  metric_key: string;
  description: string;
  quantity: number;
  unit_amount: number; // in cents
  amount: number; // in cents
}

export interface UpcomingInvoiceData {
  line_items: OverageLineItem[];
  total_overage: number; // in cents
  currency: string;
}

export interface GetUpcomingInvoiceResult {
  data?: UpcomingInvoiceData;
  error?: string;
}

export async function getUpcomingInvoice(
  organizationId: string
): Promise<GetUpcomingInvoiceResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.functions.invoke(
      "get-upcoming-invoice",
      {
        body: { organization_id: organizationId },
      }
    );

    if (error) {
      console.error("Error fetching upcoming invoice:", error);
      return { error: error.message || "Failed to fetch upcoming invoice" };
    }

    return { data: data as UpcomingInvoiceData };
  } catch (error) {
    console.error("Error fetching upcoming invoice:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch upcoming invoice",
    };
  }
}

// ============ Delete Customer ============

export async function deleteCustomer(
  organizationId: string
): Promise<DeleteCustomerResult> {
  try {
    console.log(`deleteCustomer called - organizationId: ${organizationId}`);

    const supabase = await createClient();
    const { data, error } = await supabase.functions.invoke("delete-customer", {
      body: { organization_id: organizationId },
    });

    if (error) {
      console.error("Error deleting customer:", error);
      return { success: false, error: error.message || "Failed to delete customer" };
    }

    // Check if the response contains an error
    if (data?.error) {
      return { success: false, error: data.error };
    }

    const response = data as DeleteCustomerResponse;
    return {
      success: response.success,
      customerDeleted: response.customer_deleted,
      subscriptionCancelled: response.subscription_cancelled,
    };
  } catch (error) {
    console.error("Error deleting customer:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete customer",
    };
  }
}

