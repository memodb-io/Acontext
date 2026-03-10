"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { createProject } from "@/app/new/[id]/actions";
import { useTopNavStore } from "@/stores/top-nav";
import { MAX_PROJECT_NAME_LENGTH } from "@/lib/utils";
import { Organization } from "@/types";

function SubmitButton({
  label,
  loadingLabel,
}: {
  label: string;
  loadingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? loadingLabel : label}
    </Button>
  );
}

interface NewProjectPageClientProps {
  orgId: string;
  currentOrganization: Organization;
  allOrganizations: Organization[];
}

export function NewProjectPageClient({
  orgId,
  currentOrganization,
  allOrganizations,
}: NewProjectPageClientProps) {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const { initialize } = useTopNavStore();
  const [name, setName] = useState<string>("");

  useEffect(() => {
    // Initialize top-nav state when page loads
    initialize({
      title: "New project",
      organization: currentOrganization,
      project: null,
      organizations: allOrganizations,
      projects: [],
      hasSidebar: false,
    });
  }, [initialize, currentOrganization, allOrganizations]);

  async function handleSubmit(formData: FormData) {
    await createProject(orgId, formData);
  }

  return (
    <div className="flex-1 flex min-h-screen items-start justify-center p-4 pt-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create a new project</CardTitle>
          <CardDescription>
            Projects help you organize and manage your work within an
            organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form action={handleSubmit}>
            <div className="grid gap-6">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="name">Name</Label>
                  <span className="text-xs text-muted-foreground">
                    {name.length}/{MAX_PROJECT_NAME_LENGTH}
                  </span>
                </div>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="My Project"
                  maxLength={MAX_PROJECT_NAME_LENGTH}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <SubmitButton label="Create Project" loadingLabel="Creating..." />
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
