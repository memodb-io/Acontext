import { notFound } from "next/navigation";
import { getOrganizationDataWithPlan } from "@/lib/supabase";
import { OrgLayoutClient } from "./org-layout-client";

interface OrgLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    id: string;
  }>;
}

async function getOrgNavData(orgId: string) {
  // Get organization data with plan information
  let orgData;
  try {
    orgData = await getOrganizationDataWithPlan(orgId);
  } catch {
    notFound();
  }

  return { currentOrganization: orgData.currentOrganization };
}

export default async function OrgLayout({
  children,
  params,
}: OrgLayoutProps) {
  const { id } = await params;
  const { currentOrganization } = await getOrgNavData(id);

  return (
    <OrgLayoutClient organizationId={currentOrganization.id}>
      {children}
    </OrgLayoutClient>
  );
}
