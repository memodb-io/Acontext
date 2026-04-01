import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LearningSpaceDetailPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/learning_spaces/${id}/skills`);
}
