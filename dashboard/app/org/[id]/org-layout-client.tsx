"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar, NavItem } from "@/components/app-sidebar";
import { FolderKanban, Receipt, Settings, Users } from "lucide-react";
import { encodeId } from "@/lib/id-codec";

interface OrgLayoutClientProps {
  children: React.ReactNode;
  organizationId: string;
}

export function OrgLayoutClient({
  children,
  organizationId,
}: OrgLayoutClientProps) {
  organizationId = encodeId(organizationId);

  const navItems: NavItem[] = [
    {
      title: "Projects",
      icon: FolderKanban,
      href: `/org/${organizationId}`,
      exactMatch: true,
    },
    {
      title: "Team",
      icon: Users,
      href: `/org/${organizationId}/team`,
      exactMatch: false,
    },
    {
      title: "Billing",
      icon: Receipt,
      href: `/org/${organizationId}/billing`,
      exactMatch: false,
    },
    {
      title: "Organization Settings",
      icon: Settings,
      href: `/org/${organizationId}/general`,
      exactMatch: false,
    },
  ];

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar navItems={navItems} />
      <SidebarInset>
        <div className="overflow-y-auto h-full">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

