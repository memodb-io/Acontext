"use client";

import { useEffect } from "react";
import { useTopNavStore } from "@/stores/top-nav";
import { OrganizationsList } from "./organizations-list";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { OrganizationWithPlan } from "@/types";

interface OrganizationsPageClientProps {
  organizations: OrganizationWithPlan[];
}

export function OrganizationsPageClient({
  organizations,
}: OrganizationsPageClientProps) {
  const { initialize } = useTopNavStore();

  useEffect(() => {
    // Initialize top-nav state when page loads
    initialize({
      title: "Organizations",
      organization: null,
      project: null,
      organizations: [],
      projects: [],
      hasSidebar: false,
    });
  }, [initialize]);

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Your Organizations</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage your organizations and access settings
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/new">
              <Plus className="h-4 w-4" />
              <span className="hidden md:inline">New Organization</span>
            </Link>
          </Button>
        </div>

        {/* Organizations List */}
        <OrganizationsList organizations={organizations} />
      </div>
    </div>
  );
}
