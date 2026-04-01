import { redirect } from "next/navigation";
import { LearningSpaceLayoutClient } from "./learning-space-layout-client";
import {
  getCurrentUser,
  getProject,
} from "@/lib/supabase/operations";
import { decodeId } from "@/lib/id-codec";

interface LayoutProps {
  params: Promise<{ id: string; spaceId: string }>;
  children: React.ReactNode;
}

export default async function LearningSpaceLayout({
  params,
  children,
}: LayoutProps) {
  const { id: projectId, spaceId } = await params;
  const actualProjectId = decodeId(projectId);
  const actualSpaceId = decodeId(spaceId);

  await getCurrentUser();

  const project = await getProject(actualProjectId);

  if (!project) {
    redirect("/");
  }

  return (
    <LearningSpaceLayoutClient
      project={{
        id: project.project_id,
        name: project.name,
        organization_id: project.organization_id,
        created_at: project.created_at,
      }}
      spaceId={actualSpaceId}
    >
      {children}
    </LearningSpaceLayoutClient>
  );
}
