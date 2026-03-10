import { create } from "zustand";
import type { Product, Price, PlanDescription } from "@/lib/supabase/operations/prices";

// Re-export types for convenience
export type { Price, Product, PlanDescription };

// Plan type - dynamic, not restricted to specific values
export type PlanType = string;

// Normalize plan string (lowercase, default to "free")
export function normalizePlan(plan: string | null | undefined): string {
  return (plan || "free").toLowerCase();
}

// Get plan display name - capitalize first letter
export function getPlanTypeDisplayName(plan: string): string {
  if (!plan) return "Free";
  return plan.charAt(0).toUpperCase() + plan.slice(1).toLowerCase();
}

// Check if plan is a paid plan (not free)
export function isPaidPlan(plan: string | null | undefined): boolean {
  const normalized = normalizePlan(plan);
  return normalized !== "free";
}

// Default free plan (fallback when no data available)
export const FREE_PLAN: Price = {
  id: "free",
  name: "Free",
  product: "free",
  unit_amount: 0,
  currency: "usd",
  recurring: {
    interval: "month",
    interval_count: 1,
    usage_type: "licensed",
    meter: null,
    trial_period_days: null,
  },
  rank: 0,
};

interface PlanState {
  prices: Price[];
  products: Product[];
  isLoading: boolean;
  setPrices: (prices: Price[]) => void;
  setProducts: (products: Product[]) => void;
  setLoading: (loading: boolean) => void;
  // Helper methods
  isPlanType: (id: string) => boolean;
  getPriceByProduct: (productId: string) => Price | undefined;
  getPriceById: (priceId: string) => Price | undefined;
  getProductByProductId: (productId: string) => Product | undefined;
  getProductByPlan: (plan: string) => Product | undefined;
  getPlanByProduct: (productId: string) => string;
  getDescriptionByProduct: (productId: string) => PlanDescription | null;
  getFreePlan: () => Price;
  getAllPricesWithFree: () => Price[];
  // Formatting helpers
  formatPrice: (amount: number, currency: string) => string;
  getPlanDisplayName: (price: { product: string; name: string }) => string;
}

export const usePlanStore = create<PlanState>((set, get) => ({
  prices: [],
  products: [],
  isLoading: false,
  setPrices: (prices) => set({ prices, isLoading: false }),
  setProducts: (products) => set({ products }),
  setLoading: (isLoading) => set({ isLoading }),

  // Check if id is a plan type (exists in products.plan)
  isPlanType: (id) => {
    return get().products.some((p) => normalizePlan(p.plan) === normalizePlan(id));
  },

  // Get product by plan type
  getProductByPlan: (plan) => {
    return get().products.find((p) => normalizePlan(p.plan) === normalizePlan(plan));
  },

  // Get plan type by product ID
  getPlanByProduct: (productId) => {
    const state = get();
    // Check if it's a plan type first
    if (state.products.some((p) => normalizePlan(p.plan) === normalizePlan(productId))) {
      return normalizePlan(productId);
    }
    // Otherwise, look up the plan from products by product ID
    const product = state.products.find((p) => p.product === productId);
    return normalizePlan(product?.plan);
  },

  // Get description by product ID or plan type
  getDescriptionByProduct: (productId) => {
    const state = get();
    // Check if it's a plan type
    const productByPlan = state.products.find(
      (p) => normalizePlan(p.plan) === normalizePlan(productId)
    );
    if (productByPlan) {
      return productByPlan.description || null;
    }
    // Otherwise, find by product ID
    const product = state.products.find((p) => p.product === productId);
    return product?.description || null;
  },

  // Get price by product ID or plan type
  getPriceByProduct: (productId) => {
    const state = get();
    // Check if it's a plan type
    const productByPlan = state.products.find(
      (p) => normalizePlan(p.plan) === normalizePlan(productId)
    );
    if (productByPlan) {
      // For "free" plan, return FREE_PLAN constant
      if (normalizePlan(productId) === "free") {
        return FREE_PLAN;
      }
      return state.prices.find((p) => p.product === productByPlan.product);
    }
    // Otherwise, find by product ID directly
    if (productId === "free") return FREE_PLAN;
    return state.prices.find((p) => p.product === productId);
  },

  getPriceById: (priceId) => {
    if (priceId === "free") return FREE_PLAN;
    return get().prices.find((p) => p.id === priceId);
  },

  getProductByProductId: (productId) => {
    return get().products.find((p) => p.product === productId);
  },

  getFreePlan: () => FREE_PLAN,
  getAllPricesWithFree: () => [FREE_PLAN, ...get().prices],

  // Formatting helpers
  formatPrice: (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  },
  getPlanDisplayName: (price: { product: string; name: string }) => {
    if (price.name && price.name.trim() !== "") return price.name;
    return (
      price.product.replace("prod_", "").charAt(0).toUpperCase() +
      price.product.slice(5)
    );
  },
}));
