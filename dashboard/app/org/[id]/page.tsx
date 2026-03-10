import { notFound } from "next/navigation";
import { OrgPageClient } from "./org-page-client";
import { getOrganizationDataWithPlan } from "@/lib/supabase";
import { decodeId } from "@/lib/id-codec";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function OrgPage({ params }: PageProps) {
  const { id } = await params;
  // Decode ID if it's Base64URL encoded
  const actualId = decodeId(id);

  let orgData;
  try {
    orgData = await getOrganizationDataWithPlan(actualId, {
      includeProjects: true,
    });
  } catch {
    notFound();
  }

  const { currentOrganization, allOrganizations, projects = [] } = orgData;

  return (
    <OrgPageClient
      currentOrganization={currentOrganization}
      allOrganizations={allOrganizations}
      projects={projects}
    />
  );
}
