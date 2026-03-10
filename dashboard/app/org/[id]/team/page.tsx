import { notFound } from "next/navigation";
import { TeamPageClient } from "./team-page-client";
import {
  getCurrentUser,
  getOrganizationDataWithPlan,
  getOrganizationMembers,
} from "@/lib/supabase";
import { decodeId } from "@/lib/id-codec";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

async function getTeamData(orgId: string) {
  // Get current user (will redirect if not authenticated)
  const currentUser = await getCurrentUser();

  // Get organization data with plan information
  let orgData;
  try {
    orgData = await getOrganizationDataWithPlan(orgId);
  } catch {
    notFound();
  }

  const { currentOrganization } = orgData;

  // Get all organization members
  const members = await getOrganizationMembers(orgId);

  return {
    currentOrganization,
    members,
    currentUserId: currentUser.id,
  };
}

export default async function TeamPage({ params }: PageProps) {
  const { id } = await params;
  // Decode ID if it's Base64URL encoded
  const actualId = decodeId(id);
  const { currentOrganization, members, currentUserId } = await getTeamData(actualId);

  return (
    <TeamPageClient
      organizationId={currentOrganization.id}
      organizationName={currentOrganization.name}
      members={members}
      role={currentOrganization.role ?? "member"}
      currentUserId={currentUserId}
    />
  );
}

