"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Boxes, Pin, Plus } from "lucide-react";
import { encodeId } from "@/lib/id-codec";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OrganizationWithPlan } from "@/types";
import { getPlanTypeDisplayName, isPaidPlan } from "@/stores/plan";

interface OrganizationsListProps {
  organizations: OrganizationWithPlan[];
}

export function OrganizationsList({ organizations }: OrganizationsListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter organizations based on search query
  const filteredOrganizations = useMemo(() => {
    if (!searchQuery.trim()) {
      return organizations;
    }

    const query = searchQuery.toLowerCase();
    return organizations.filter(
      (org) =>
        org.name.toLowerCase().includes(query) ||
        org.id.toLowerCase().includes(query)
    );
  }, [organizations, searchQuery]);

  if (organizations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Boxes className="h-12 w-12 text-muted-foreground mb-4" />
          <CardTitle className="text-lg mb-2">No organizations yet</CardTitle>
          <CardDescription className="text-center mb-6">
            Get started by creating your first organization
          </CardDescription>
          <Link href="/new">
            <Button>
              <Plus className="h-4 w-4" />
              Create Organization
            </Button>
          </Link>
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
          placeholder="Search organizations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Results Count */}
      {searchQuery && (
        <p className="text-sm text-muted-foreground">
          {filteredOrganizations.length} organization
          {filteredOrganizations.length !== 1 ? "s" : ""} found
        </p>
      )}

      {/* Organizations Grid */}
      {filteredOrganizations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-lg mb-2">No organizations found</CardTitle>
            <CardDescription className="text-center">
              Try adjusting your search query
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrganizations.map((org) => (
            <div key={org.id} className="relative group">
              <Link href={`/org/${encodeId(org.id)}`} className="block">
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader className="overflow-hidden">
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Boxes className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <CardTitle className="text-lg truncate">{org.name}</CardTitle>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {org.is_default && (
                          <Pin className="h-4 w-4 text-primary shrink-0 fill-primary" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge
                        variant={isPaidPlan(org.plan) ? "default" : "outline"}
                        className="text-xs"
                      >
                        {getPlanTypeDisplayName(org.plan)}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {org.role === "owner" ? "Owner" : "Member"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <CardDescription className="text-xs">
                        Created {new Date(org.created_at).toLocaleDateString()}
                      </CardDescription>
                      <CardDescription className="text-xs">
                        {org.project_count} project{org.project_count !== 1 ? "s" : ""}
                      </CardDescription>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

