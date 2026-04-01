import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string; spaceId: string }>;
}

export default async function LearningSpaceDetailPage({ params }: PageProps) {
  const { id, spaceId } = await params;
  redirect(`/project/${id}/learning-spaces/${spaceId}/skills`);
}
