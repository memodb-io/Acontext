import { notFound } from "next/navigation";
import { OnboardingPageClient } from "./onboarding-page-client";
import {
  getCurrentUser,
  getProject,
  getOrganizationDataWithPlan,
  getSecretKeyRotations,
} from "@/lib/supabase";
import { decodeId } from "@/lib/id-codec";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

async function getPageData(projectId: string) {
  // Get current user (will redirect if not authenticated)
  await getCurrentUser();

  // Get project data
  const projectData = await getProject(projectId);

  if (!projectData) {
    notFound();
  }

  const project = {
    id: projectData.project_id,
    name: projectData.name,
    organization_id: projectData.organization_id,
  };

  // Get organization data with plan information
  let orgData;
  try {
    orgData = await getOrganizationDataWithPlan(project.organization_id, {
      includeProjects: true,
    });
  } catch {
    notFound();
  }

  const { currentOrganization, allOrganizations, projects = [] } = orgData;

  // Get secret key rotations to check if API key exists
  const keyRotations = await getSecretKeyRotations(projectId);
  const latestKey = keyRotations.length > 0 ? keyRotations[0].secret_key : null;

  return {
    project,
    currentOrganization,
    allOrganizations,
    projects,
    hasApiKey: keyRotations.length > 0,
    currentApiKey: latestKey,
  };
}

export default async function OnboardingPage({ params }: PageProps) {
  const { id } = await params;
  // Decode ID if it's Base64URL encoded
  const actualId = decodeId(id);
  const {
    project,
    currentOrganization,
    allOrganizations,
    projects,
    hasApiKey,
    currentApiKey,
  } = await getPageData(actualId);

  return (
    <OnboardingPageClient
      project={project}
      currentOrganization={currentOrganization}
      allOrganizations={allOrganizations}
      projects={projects}
      hasApiKey={hasApiKey}
      currentApiKey={currentApiKey}
      role={currentOrganization.role ?? "member"}
    />
  );
}

