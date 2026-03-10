"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { useTopNavStore } from "@/stores/top-nav";
import { Organization } from "@/types";
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
import { updateOrganizationName, deleteOrganization } from "./actions";
import { MAX_ORG_NAME_LENGTH } from "@/lib/utils";

interface GeneralPageClientProps {
  currentOrganization: Organization;
  allOrganizations: Organization[];
  role: "owner" | "member";
}

export function GeneralPageClient({
  currentOrganization,
  allOrganizations,
  role,
}: GeneralPageClientProps) {
  const { initialize, setHasSidebar } = useTopNavStore();

  const [orgName, setOrgName] = useState(currentOrganization.name);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    // Initialize top-nav state when page loads
    initialize({
      title: "",
      organization: currentOrganization,
      project: null,
      organizations: allOrganizations,
      projects: [],
      hasSidebar: true,
    });

    // Cleanup: reset hasSidebar when leaving this page
    return () => {
      setHasSidebar(false);
    };
  }, [currentOrganization, allOrganizations, initialize, setHasSidebar]);

  // Check if there are unsaved changes
  const hasChanges = orgName.trim() !== currentOrganization.name.trim() && orgName.trim().length > 0;

  // Sync orgName with currentOrganization.name when it changes externally (only if no pending changes)
  useEffect(() => {
    if (!hasChanges) {
      setOrgName(currentOrganization.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization.name]);

  const handleSave = () => {
    const trimmedName = orgName.trim();
    if (!trimmedName || trimmedName === currentOrganization.name.trim()) {
      return;
    }

    if (trimmedName.length > MAX_ORG_NAME_LENGTH) {
      setError(
        `Organization name must be ${MAX_ORG_NAME_LENGTH} characters or less`
      );
      return;
    }

    startTransition(async () => {
      setError(null);
      const result = await updateOrganizationName(
        currentOrganization.id,
        trimmedName
      );
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        router.refresh();
      }
    });
  };

  const handleCancel = () => {
    setOrgName(currentOrganization.name);
    setError(null);
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirmName.trim() !== currentOrganization.name.trim()) {
      setError("Organization name does not match");
      return;
    }

    startTransition(async () => {
      const result = await deleteOrganization(currentOrganization.id);
      if (result.error) {
        setError(result.error);
      } else {
        setDeleteDialogOpen(false);
        setDeleteConfirmName("");
        router.push("/organizations");
      }
    });
  };

  const isOwner = role === "owner";
  const canDelete = isOwner && !currentOrganization.is_default;

  return (
    <>
      <div className="container mx-auto py-8 px-4 max-w-6xl">
          <div className="flex flex-col gap-6">
            {/* Header */}
            <div>
              <h1 className="text-2xl font-semibold">Organization Settings</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Manage your organization settings and preferences
              </p>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="general" className="w-full">
              <TabsList>
                <TabsTrigger value="general">General</TabsTrigger>
              </TabsList>
              <TabsContent value="general" className="space-y-6 mt-6">
                {/* Organization Details */}
                {isOwner && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Organization Details</CardTitle>
                      <CardDescription>
                        Update your organization information
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="org-name">Organization Name</Label>
                          <span className="text-xs text-muted-foreground">
                            {orgName.length}/{MAX_ORG_NAME_LENGTH}
                          </span>
                        </div>
                        <Input
                          id="org-name"
                          value={orgName}
                          onChange={(e) => {
                            setOrgName(e.target.value);
                            setError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && hasChanges) {
                              handleSave();
                            } else if (e.key === "Escape") {
                              handleCancel();
                            }
                          }}
                          maxLength={MAX_ORG_NAME_LENGTH}
                          disabled={isPending}
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
                          disabled={!hasChanges || isPending}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSave}
                          disabled={!hasChanges || isPending}
                        >
                          {isPending ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

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
                              Delete Organization
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {currentOrganization.is_default
                                ? "You cannot delete your default organization."
                                : "Once you delete an organization, there is no going back. Please be certain."}
                            </p>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteDialogOpen(true)}
                            disabled={!canDelete || isPending}
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
              Delete Organization
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;
              {currentOrganization.name}&rdquo;? This action cannot be undone
              and will permanently delete the organization and all its associated
              data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="delete-confirm-name">
                Please type <span className="font-semibold">{currentOrganization.name}</span> to confirm
              </Label>
              <Input
                id="delete-confirm-name"
                value={deleteConfirmName}
                onChange={(e) => {
                  setDeleteConfirmName(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && deleteConfirmName.trim() === currentOrganization.name.trim()) {
                    handleDeleteConfirm();
                  }
                }}
                placeholder={currentOrganization.name}
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
              disabled={isPending || deleteConfirmName.trim() !== currentOrganization.name.trim()}
            >
              {isPending ? "Deleting..." : "Delete Organization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

