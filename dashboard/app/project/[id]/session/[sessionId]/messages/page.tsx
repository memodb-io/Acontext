import { redirect } from "next/navigation";
import { MessagesPageClient } from "./messages-page-client";
import {
  getCurrentUser,
  getProject,
} from "@/lib/supabase/operations";
import { decodeId } from "@/lib/id-codec";

interface PageProps {
  params: Promise<{ id: string; sessionId: string }>;
}

export default async function MessagesPage({ params }: PageProps) {
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
    <MessagesPageClient
      project={{
        id: project.project_id,
        name: project.name,
        organization_id: project.organization_id,
        created_at: project.created_at,
      }}
      sessionId={actualSessionId}
    />
  );
}
