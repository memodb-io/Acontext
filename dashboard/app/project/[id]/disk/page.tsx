import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DiskPageClient } from "./disk-page-client";
import {
  cachedGetCurrentUser as getCurrentUser,
  cachedGetProject as getProject,
  cachedGetOrganizationDataWithPlan,
} from "@/lib/supabase/operations";
import { decodeId } from "@/lib/id-codec";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DiskPage({ params }: PageProps) {
  const { id: projectId } = await params;
  // Decode ID if it's Base64URL encoded
  const actualProjectId = decodeId(projectId);

  // Run getCurrentUser and getProject in parallel
  const [, project] = await Promise.all([
    getCurrentUser(),
    getProject(actualProjectId),
  ]);

  if (!project) {
    redirect("/");
  }

  // Get organization data with plan information
  let orgData;
  try {
    orgData = await cachedGetOrganizationDataWithPlan(project.organization_id, {
      includeProjects: true,
    });
  } catch {
    redirect("/");
  }

  const { currentOrganization, allOrganizations, projects = [] } = orgData;

  return (
    <Suspense>
      <DiskPageClient
        project={{
          id: project.project_id,
          name: project.name,
          organization_id: project.organization_id,
          created_at: project.created_at,
        }}
        currentOrganization={currentOrganization}
        allOrganizations={allOrganizations}
        projects={projects}
      />
    </Suspense>
  );
}
