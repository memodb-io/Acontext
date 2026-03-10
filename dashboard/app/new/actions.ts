"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { MAX_ORG_NAME_LENGTH } from "@/lib/utils";
import { encodeId } from "@/lib/id-codec";
import {
  getCurrentUser,
  createOrganization as createOrg,
  getPrices,
} from "@/lib/supabase";

export async function createOrganization(formData: FormData) {
  // Get current user (will redirect if not authenticated)
  await getCurrentUser();

  const name = formData.get("name") as string;
  const plan = formData.get("plan") as string | null;

  if (!name || name.trim() === "") {
    redirect(`/new?error=${encodeURIComponent("Name is required")}`);
  }

  const trimmedName = name.trim();
  if (trimmedName.length > MAX_ORG_NAME_LENGTH) {
    redirect(
      `/new?error=${encodeURIComponent(`Name must be ${MAX_ORG_NAME_LENGTH} characters or less`)}`
    );
  }

  // Validate plan against available prices
  const { prices } = await getPrices();

  // Valid plans are "free" or any product ID from the prices
  const validPlans = ["free", ...prices.map((p) => p.product)];
  const selectedPlan = plan && validPlans.includes(plan) ? plan : "free";

  // Always create organization with "free" plan
  // If user selected a paid plan, they will be redirected to payment page
  const { data, error } = await createOrg(trimmedName, "free");

  if (error) {
    redirect(`/new?error=${encodeURIComponent(error.message)}`);
  }

  if (!data) {
    redirect(`/new?error=${encodeURIComponent("Failed to create organization")}`);
  }

  revalidatePath("/", "layout");

  // Convert organization ID to Base64URL for URL
  const encodedOrgId = encodeId(data);

  // If user selected a paid plan, redirect to payment page
  // Otherwise, redirect to create project page
  if (selectedPlan !== "free") {
    redirect(`/new/${encodedOrgId}/payment?plan=${encodeURIComponent(selectedPlan)}`);
  } else {
    redirect(`/new/${encodedOrgId}`);
  }
}

