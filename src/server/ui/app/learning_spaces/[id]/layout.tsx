import { LearningSpaceLayoutClient } from "./learning-space-layout-client";

export default function LearningSpaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LearningSpaceLayoutClient>{children}</LearningSpaceLayoutClient>;
}
