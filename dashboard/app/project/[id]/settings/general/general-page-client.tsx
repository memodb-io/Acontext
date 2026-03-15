"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { encodeId } from "@/lib/id-codec";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { updateProjectName, deleteProjectAction, updateProjectConfigs } from "./actions";
import { MAX_PROJECT_NAME_LENGTH } from "@/lib/utils";
import type { ProjectConfig } from "@/lib/acontext/server";

interface GeneralPageClientProps {
  project: Project;
  currentOrganization: Organization;
  allOrganizations: Organization[];
  projects: Project[];
  role: "owner" | "member";
  projectConfigs?: ProjectConfig;
  projectConfigsError?: string;
}

export function GeneralPageClient({
  project,
  currentOrganization,
  allOrganizations,
  projects,
  role,
  projectConfigs,
  projectConfigsError,
}: GeneralPageClientProps) {
  const { initialize, setHasSidebar } = useTopNavStore();

  const [projectName, setProjectName] = useState(project.name);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [successCriteria, setSuccessCriteria] = useState(
    projectConfigs?.task_success_criteria ?? ""
  );
  const [failureCriteria, setFailureCriteria] = useState(
    projectConfigs?.task_failure_criteria ?? ""
  );
  const [taskAgentError, setTaskAgentError] = useState<string | null>(null);
  const [taskAgentSuccess, setTaskAgentSuccess] = useState(false);
  const [isTaskAgentPending, startTaskAgentTransition] = useTransition();

  useEffect(() => {
    // Initialize top-nav state when page loads
    initialize({
      title: "",
      organization: currentOrganization,
      project: project,
      organizations: allOrganizations,
      projects: projects,
      hasSidebar: true,
    });

    // Cleanup: reset hasSidebar when leaving this page
    return () => {
      setHasSidebar(false);
    };
  }, [project, currentOrganization, allOrganizations, projects, initialize, setHasSidebar]);

  // Check if there are unsaved changes
  const hasChanges = projectName.trim() !== project.name.trim() && projectName.trim().length > 0;

  // Sync projectName with project.name when it changes externally (only if no pending changes)
  useEffect(() => {
    if (!hasChanges) {
      setProjectName(project.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.name]);

  useEffect(() => {
    setSuccessCriteria(projectConfigs?.task_success_criteria ?? "");
    setFailureCriteria(projectConfigs?.task_failure_criteria ?? "");
  }, [projectConfigs?.task_success_criteria, projectConfigs?.task_failure_criteria]);

  const handleSave = () => {
    const trimmedName = projectName.trim();
    if (!trimmedName || trimmedName === project.name.trim()) {
      return;
    }

    if (trimmedName.length > MAX_PROJECT_NAME_LENGTH) {
      setError(
        `Project name must be ${MAX_PROJECT_NAME_LENGTH} characters or less`
      );
      return;
    }

    startTransition(async () => {
      setError(null);
      const result = await updateProjectName(project.id, trimmedName);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        router.refresh();
      }
    });
  };

  const handleCancel = () => {
    setProjectName(project.name);
    setError(null);
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirmName.trim() !== project.name.trim()) {
      setError("Project name does not match");
      return;
    }

    startTransition(async () => {
      const result = await deleteProjectAction(project.id);
      if (result.error) {
        setError(result.error);
      } else {
        setDeleteDialogOpen(false);
        setDeleteConfirmName("");
        const encodedOrgId = encodeId(project.organization_id);
        router.push(`/org/${encodedOrgId}`);
      }
    });
  };

  const isOwner = role === "owner";

  return (
    <>
      <div className="container mx-auto py-8 px-4 max-w-6xl">
          <div className="flex flex-col gap-6">
            {/* Header */}
            <div>
              <h1 className="text-2xl font-semibold">Project Settings</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Manage your project settings and preferences
              </p>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="general" className="w-full">
              <TabsList>
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="task-tracking">Task Tracking</TabsTrigger>
              </TabsList>
              <TabsContent value="general" className="space-y-6 mt-6">
                {/* Non-owner Alert */}
                {!isOwner && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      You don&apos;t have permission to modify project settings. Only project owners can make changes.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Project Details */}
                <Card>
                  <CardHeader>
                    <CardTitle>Project Details</CardTitle>
                    <CardDescription>
                      Update your project information
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="project-name">Project Name</Label>
                        <span className="text-xs text-muted-foreground">
                          {projectName.length}/{MAX_PROJECT_NAME_LENGTH}
                        </span>
                      </div>
                      <Input
                        id="project-name"
                        value={projectName}
                        onChange={(e) => {
                          setProjectName(e.target.value);
                          setError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && hasChanges && isOwner) {
                            handleSave();
                          } else if (e.key === "Escape") {
                            handleCancel();
                          }
                        }}
                        maxLength={MAX_PROJECT_NAME_LENGTH}
                        disabled={isPending || !isOwner}
                      />
                    </div>
                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        variant="outline"
                        onClick={handleCancel}
                        disabled={!hasChanges || isPending || !isOwner}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSave}
                        disabled={!hasChanges || isPending || !isOwner}
                      >
                        {isPending ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Danger Zone */}
                {isOwner && (
                  <>
                    <Separator />
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-destructive">
                          Danger Zone
                        </CardTitle>
                        <CardDescription>
                          Irreversible and destructive actions
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-0.5 flex-1">
                            <h4 className="text-sm font-medium">
                              Delete Project
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              Once you delete a project, there is no going back. Please be certain.
                            </p>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteDialogOpen(true)}
                            disabled={isPending}
                          >
                            <AlertTriangle className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </TabsContent>
              <TabsContent value="task-tracking" className="space-y-6 mt-6">
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
                        setTaskAgentError(null);
                        setTaskAgentSuccess(false);
                      }}
                      placeholder="e.g., User explicitly confirms the task is done, or the agent produces a verified output matching the request."
                      rows={4}
                      disabled={isTaskAgentPending || !isOwner}
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
                        setTaskAgentError(null);
                        setTaskAgentSuccess(false);
                      }}
                      placeholder="e.g., The agent encounters unrecoverable errors, or the user explicitly reports the task failed."
                      rows={4}
                      disabled={isTaskAgentPending || !isOwner}
                    />
                  </CardContent>
                </Card>
                {taskAgentError && (
                  <Alert variant="destructive">
                    <AlertDescription>{taskAgentError}</AlertDescription>
                  </Alert>
                )}
                {taskAgentSuccess && (
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
                      setTaskAgentError(null);
                      setTaskAgentSuccess(false);
                    }}
                    disabled={isTaskAgentPending || !isOwner}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      startTaskAgentTransition(async () => {
                        setTaskAgentError(null);
                        setTaskAgentSuccess(false);
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
                          setTaskAgentError(result.error);
                        } else {
                          setTaskAgentSuccess(true);
                          router.refresh();
                        }
                      });
                    }}
                    disabled={isTaskAgentPending || !isOwner || !!projectConfigsError}
                  >
                    {isTaskAgentPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) {
          setDeleteConfirmName("");
          setError(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Project
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;
              {project.name}&rdquo;? This action cannot be undone
              and will permanently delete the project and all its associated
              data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="delete-confirm-name">
                Please type <span className="font-semibold">{project.name}</span> to confirm
              </Label>
              <Input
                id="delete-confirm-name"
                value={deleteConfirmName}
                onChange={(e) => {
                  setDeleteConfirmName(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && deleteConfirmName.trim() === project.name.trim()) {
                    handleDeleteConfirm();
                  }
                }}
                placeholder={project.name}
                disabled={isPending}
              />
            </div>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteConfirmName("");
                setError(null);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isPending || deleteConfirmName.trim() !== project.name.trim()}
            >
              {isPending ? "Deleting..." : "Delete Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

