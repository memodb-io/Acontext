import { notFound } from "next/navigation";
import { UsagePageClient } from "./usage-page-client";
import { getOrganizationDataWithPlan, getOrganizationUsage } from "@/lib/supabase";
import { decodeId } from "@/lib/id-codec";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function UsagePage({ params }: PageProps) {
  const { id } = await params;
  const actualId = decodeId(id);

  let orgData;
  try {
    orgData = await getOrganizationDataWithPlan(actualId);
  } catch {
    notFound();
  }

  const { currentOrganization, allOrganizations } = orgData;

  const usageData = await getOrganizationUsage(
    currentOrganization.id!,
    currentOrganization.plan || "free"
  );

  return (
    <UsagePageClient
      currentOrganization={currentOrganization}
      allOrganizations={allOrganizations}
      usageData={usageData}
    />
  );
}
