import { decodeId, encodeId } from "@/lib/id-codec";
import { SettingsNav } from "./settings-nav";

interface SettingsLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    id: string;
  }>;
}

export default async function SettingsLayout({
  children,
  params,
}: SettingsLayoutProps) {
  const { id } = await params;
  const projectId = encodeId(decodeId(id));

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold">Project Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your project settings and preferences
          </p>
        </div>

        {/* Tab Navigation */}
        <SettingsNav projectId={projectId} />

        {/* Content */}
        {children}
      </div>
    </div>
  );
}
