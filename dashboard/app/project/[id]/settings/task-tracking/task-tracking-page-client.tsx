"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { useTopNavStore } from "@/stores/top-nav";
import { Organization, Project } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateProjectConfigs } from "./actions";
import type { ProjectConfig } from "@/lib/acontext/server";

interface TaskTrackingPageClientProps {
  project: Project;
  currentOrganization: Organization;
  allOrganizations: Organization[];
  projects: Project[];
  role: "owner" | "member";
  projectConfigs?: ProjectConfig;
  projectConfigsError?: string;
}

export function TaskTrackingPageClient({
  project,
  currentOrganization,
  allOrganizations,
  projects,
  role,
  projectConfigs,
  projectConfigsError,
}: TaskTrackingPageClientProps) {
  const { initialize, setHasSidebar } = useTopNavStore();
  const router = useRouter();

  const [successCriteria, setSuccessCriteria] = useState(
    projectConfigs?.task_success_criteria ?? ""
  );
  const [failureCriteria, setFailureCriteria] = useState(
    projectConfigs?.task_failure_criteria ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    initialize({
      title: "",
      organization: currentOrganization,
      project: project,
      organizations: allOrganizations,
      projects: projects,
      hasSidebar: true,
    });

    return () => {
      setHasSidebar(false);
    };
  }, [project, currentOrganization, allOrganizations, projects, initialize, setHasSidebar]);

  const isOwner = role === "owner";

  return (
    <div className="space-y-6">
      {!isOwner && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You don&apos;t have permission to modify task tracking settings. Only project owners can make changes.
          </AlertDescription>
        </Alert>
      )}
      {projectConfigsError && (
        <Alert variant="destructive">
          <AlertDescription>{projectConfigsError}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Task Success Criteria</CardTitle>
          <CardDescription>
            Define custom criteria for determining when a task is considered successful.
            Leave empty to use the default criteria.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={successCriteria}
            onChange={(e) => {
              setSuccessCriteria(e.target.value);
              setError(null);
              setSuccess(false);
            }}
            placeholder="e.g., User explicitly confirms the task is done, or the agent produces a verified output matching the request."
            rows={4}
            disabled={isPending || !isOwner}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Task Failure Criteria</CardTitle>
          <CardDescription>
            Define custom criteria for determining when a task should be marked as failed.
            Leave empty to use the default criteria.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={failureCriteria}
            onChange={(e) => {
              setFailureCriteria(e.target.value);
              setError(null);
              setSuccess(false);
            }}
            placeholder="e.g., The agent encounters unrecoverable errors, or the user explicitly reports the task failed."
            rows={4}
            disabled={isPending || !isOwner}
          />
        </CardContent>
      </Card>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <AlertDescription>Task agent criteria saved successfully.</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setSuccessCriteria(
              projectConfigs?.task_success_criteria ?? ""
            );
            setFailureCriteria(
              projectConfigs?.task_failure_criteria ?? ""
            );
            setError(null);
            setSuccess(false);
          }}
          disabled={isPending || !isOwner}
        >
          Cancel
        </Button>
        <Button
          onClick={() => {
            startTransition(async () => {
              setError(null);
              setSuccess(false);
              const configs: Record<string, string | null> = {};
              configs.task_success_criteria =
                successCriteria.trim() || null;
              configs.task_failure_criteria =
                failureCriteria.trim() || null;
              const result = await updateProjectConfigs(
                project.id,
                configs
              );
              if (result.error) {
                setError(result.error);
              } else {
                setSuccess(true);
                router.refresh();
              }
            });
          }}
          disabled={isPending || !isOwner || !!projectConfigsError}
        >
          {isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
