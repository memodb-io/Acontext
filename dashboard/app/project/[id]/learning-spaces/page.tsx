import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LearningSpacesPageClient } from "./learning-spaces-page-client";
import {
  getCurrentUser,
  getProject,
  getOrganizationDataWithPlan,
} from "@/lib/supabase/operations";
import { decodeId } from "@/lib/id-codec";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LearningSpacesPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const actualProjectId = decodeId(projectId);

  await getCurrentUser();

  const project = await getProject(actualProjectId);

  if (!project) {
    redirect("/");
  }

  let orgData;
  try {
    orgData = await getOrganizationDataWithPlan(project.organization_id, {
      includeProjects: true,
    });
  } catch {
    redirect("/");
  }

  const { currentOrganization, allOrganizations, projects = [] } = orgData;

  return (
    <Suspense>
      <LearningSpacesPageClient
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
