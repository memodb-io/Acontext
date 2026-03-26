import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LearningSpaceDetailClient } from "./learning-space-detail-client";
import {
  getCurrentUser,
  getProject,
} from "@/lib/supabase/operations";
import { decodeId } from "@/lib/id-codec";

interface PageProps {
  params: Promise<{ id: string; spaceId: string }>;
}

export default async function LearningSpaceDetailPage({ params }: PageProps) {
  const { id: projectId, spaceId } = await params;
  const actualProjectId = decodeId(projectId);
  const actualSpaceId = decodeId(spaceId);

  await getCurrentUser();

  const project = await getProject(actualProjectId);

  if (!project) {
    redirect("/");
  }

  return (
    <Suspense>
      <LearningSpaceDetailClient
        project={{
          id: project.project_id,
          name: project.name,
          organization_id: project.organization_id,
          created_at: project.created_at,
        }}
        spaceId={actualSpaceId}
      />
    </Suspense>
  );
}
