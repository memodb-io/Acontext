"use client";

import { useState, useMemo } from "react";
import { Search, Folder, Plus, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { encodeId } from "@/lib/id-codec";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Project } from "@/types";

interface ProjectsListProps {
  projects: Project[];
}

export function ProjectsList({ projects }: ProjectsListProps) {
  const params = useParams();
  const orgId = params.id as string;
  const [searchQuery, setSearchQuery] = useState("");

  // Filter projects based on search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) {
      return projects;
    }

    const query = searchQuery.toLowerCase();
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(query) ||
        project.id.toLowerCase().includes(query)
    );
  }, [projects, searchQuery]);

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Folder className="h-12 w-12 text-muted-foreground mb-4" />
          <CardTitle className="text-lg mb-2">No projects yet</CardTitle>
          <CardDescription className="text-center mb-6">
            Get started by creating your first project
          </CardDescription>
          <Button asChild>
            <Link href={`/new/${encodeId(orgId)}`}>
              <Plus className="h-4 w-4" />
              New Project
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Results Count */}
      {searchQuery && (
        <p className="text-sm text-muted-foreground">
          {filteredProjects.length} project
          {filteredProjects.length !== 1 ? "s" : ""} found
        </p>
      )}

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-lg mb-2">No projects found</CardTitle>
            <CardDescription className="text-center">
              Try adjusting your search query
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <Link key={project.id} href={`/project/${encodeId(project.id)}`}>
              <Card className="group hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Folder className="h-5 w-5 text-muted-foreground shrink-0" />
                      <CardTitle className="text-lg truncate">
                        {project.name}
                      </CardTitle>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-1" />
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-xs flex justify-between">
                    <span>
                      {project.created_at
                        ? new Date(project.created_at).toLocaleString("en-US", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>
                    <span>{project.id.slice(0, 8)}</span>
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
