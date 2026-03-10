import { notFound } from "next/navigation";
import { BillingPageClient } from "./billing-page-client";
import { getOrganizationDataWithPlan } from "@/lib/supabase";
import { decodeId } from "@/lib/id-codec";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function BillingPage({ params }: PageProps) {
  const { id } = await params;
  // Decode ID if it's Base64URL encoded
  const actualId = decodeId(id);

  let orgData;
  try {
    orgData = await getOrganizationDataWithPlan(actualId);
  } catch {
    notFound();
  }

  const { currentOrganization, allOrganizations } = orgData;

  return (
    <BillingPageClient
      currentOrganization={currentOrganization}
      allOrganizations={allOrganizations}
    />
  );
}

