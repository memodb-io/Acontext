import { notFound, redirect } from "next/navigation";
import { PaymentPageClient } from "./payment-page-client";
import {
  getOrganizationDataWithPlan,
  getPrices,
} from "@/lib/supabase";
import { decodeId, encodeId } from "@/lib/id-codec";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    plan?: string;
  }>;
}

export default async function PaymentPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  // Decode ID if it's Base64URL encoded
  const actualId = decodeId(id);
  const { plan: planId } = await searchParams;

  // If no plan specified or plan is "free", redirect to create project page
  if (!planId || planId === "free") {
    const encodedOrgId = encodeId(actualId);
    redirect(`/new/${encodedOrgId}`);
  }

  // Get organization data with plan information
  let orgData;
  try {
    orgData = await getOrganizationDataWithPlan(actualId);
  } catch {
    notFound();
  }

  const { currentOrganization, allOrganizations } = orgData;

  // Get prices to find the selected plan details
  const { prices } = await getPrices();
  const selectedPlan = prices.find((p) => p.product === planId);

  // If plan not found, redirect to create project page
  if (!selectedPlan) {
    const encodedOrgId = encodeId(actualId);
    redirect(`/new/${encodedOrgId}`);
  }

  return (
    <PaymentPageClient
      orgId={actualId}
      currentOrganization={currentOrganization}
      allOrganizations={allOrganizations}
      selectedPlan={selectedPlan}
    />
  );
}

