"use client";

import { encodeId } from "@/lib/id-codec";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar, NavItem } from "@/components/app-sidebar";
import {
  LayoutDashboard,
  Settings,
  HardDrive,
  MessageSquare,
  KeyRound,
  FileText,
  Users,
  Sparkles,
  Codesandbox,
  BookOpen,
} from "lucide-react";

interface ProjectLayoutClientProps {
  children: React.ReactNode;
  projectId: string;
}

export function ProjectLayoutClient({
  children,
  projectId,
}: ProjectLayoutClientProps) {
  projectId = encodeId(projectId);

  const navItems: NavItem[] = [
    {
      title: "Project Overview",
      icon: LayoutDashboard,
      href: `/project/${projectId}`,
      exactMatch: true,
    },
    {
      title: "Logs",
      icon: FileText,
      href: `/project/${projectId}/logs`,
      exactMatch: false,
    },
    {
      divider: true,
    },
    {
      title: "User",
      icon: Users,
      href: `/project/${projectId}/user`,
      exactMatch: false,
    },
    {
      title: "Session",
      icon: MessageSquare,
      href: `/project/${projectId}/session`,
      exactMatch: false,
    },
    {
      title: "Disk",
      icon: HardDrive,
      href: `/project/${projectId}/disk`,
      exactMatch: false,
    },
    {
      title: "Agent Skills",
      icon: Sparkles,
      href: `/project/${projectId}/agent-skills`,
      exactMatch: false,
    },
    {
      title: "Sandbox",
      icon: Codesandbox,
      href: `/project/${projectId}/sandbox`,
      exactMatch: false,
    },
    {
      title: "Learning Spaces",
      icon: BookOpen,
      href: `/project/${projectId}/learning-spaces`,
      exactMatch: false,
    },
    {
      divider: true,
    },
    {
      title: "API Keys",
      icon: KeyRound,
      href: `/project/${projectId}/api-keys`,
      exactMatch: false,
    },
    {
      title: "Project Settings",
      icon: Settings,
      href: `/project/${projectId}/settings/general`,
      exactMatch: false,
    },
  ];

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar navItems={navItems} />
      <SidebarInset>
        <div className="overflow-y-auto h-full">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
