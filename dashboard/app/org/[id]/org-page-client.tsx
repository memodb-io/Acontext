"use client";

import { useEffect } from "react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useTopNavStore } from "@/stores/top-nav";
import { Organization, Project } from "@/types";
import { encodeId } from "@/lib/id-codec";
import { ProjectsList } from "./projects-list";
import { Button } from "@/components/ui/button";

interface OrgPageClientProps {
  currentOrganization: Organization;
  allOrganizations: Organization[];
  projects: Project[];
}

export function OrgPageClient({
  currentOrganization,
  allOrganizations,
  projects,
}: OrgPageClientProps) {
  const { initialize, setHasSidebar } = useTopNavStore();

  useEffect(() => {
    // Initialize top-nav state when page loads
    initialize({
      title: "",
      organization: currentOrganization,
      project: null,
      organizations: allOrganizations,
      projects: projects,
      hasSidebar: true,
    });

    // Cleanup: reset hasSidebar when leaving this page
    return () => {
      setHasSidebar(false);
    };
  }, [currentOrganization, allOrganizations, projects, initialize, setHasSidebar]);

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
          <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Projects</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Manage your projects and access settings
              </p>
            </div>
            <Button asChild size="sm">
              <Link href={`/new/${encodeId(currentOrganization.id)}`}>
                <Plus className="h-4 w-4" />
                <span className="hidden md:inline">New Project</span>
              </Link>
            </Button>
          </div>

          {/* Projects List */}
          <ProjectsList projects={projects} />
        </div>
      </div>
  );
}

