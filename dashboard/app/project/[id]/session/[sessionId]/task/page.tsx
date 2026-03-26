import { Suspense } from "react";
import { redirect } from "next/navigation";
import { TaskPageClient } from "./task-page-client";
import {
  getCurrentUser,
  getProject,
} from "@/lib/supabase/operations";
import { decodeId } from "@/lib/id-codec";

interface PageProps {
  params: Promise<{ id: string; sessionId: string }>;
}

export default async function TaskPage({ params }: PageProps) {
  const { id: projectId, sessionId } = await params;
  // Decode IDs if they're Base64URL encoded
  const actualProjectId = decodeId(projectId);
  const actualSessionId = decodeId(sessionId);

  await getCurrentUser();

  const project = await getProject(actualProjectId);

  if (!project) {
    redirect("/");
  }

  return (
    <Suspense>
      <TaskPageClient
        project={{
          id: project.project_id,
          name: project.name,
          organization_id: project.organization_id,
          created_at: project.created_at,
        }}
        sessionId={actualSessionId}
      />
    </Suspense>
  );
}
