import { notFound } from "next/navigation";
import { GeneralPageClient } from "./general-page-client";
import { getOrganizationDataWithPlan } from "@/lib/supabase";
import { decodeId } from "@/lib/id-codec";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function GeneralPage({ params }: PageProps) {
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
    <GeneralPageClient
      currentOrganization={currentOrganization}
      allOrganizations={allOrganizations}
      role={currentOrganization.role ?? "member"}
    />
  );
}

