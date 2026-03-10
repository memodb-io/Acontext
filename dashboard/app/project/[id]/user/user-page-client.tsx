"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { encodeId } from "@/lib/id-codec";
import { useTopNavStore } from "@/stores/top-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { Organization, Project, User, UserResourceCounts } from "@/types";
import { getUsers, deleteUser, getUserResources } from "./actions";
import { toast } from "sonner";

interface UserPageClientProps {
  project: Project;
  currentOrganization: Organization;
  allOrganizations: Organization[];
  projects: Project[];
}

interface UserWithCounts extends User {
  counts?: UserResourceCounts;
  loadingCounts?: boolean;
}

export function UserPageClient({
  project,
  currentOrganization,
  allOrganizations,
  projects,
}: UserPageClientProps) {
  const router = useRouter();
  const { initialize, setHasSidebar } = useTopNavStore();

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
  const [users, setUsers] = useState<UserWithCounts[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isRefreshingUsers, setIsRefreshingUsers] = useState(false);
  const [userFilterText, setUserFilterText] = useState("");
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [hasMoreUsers, setHasMoreUsers] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithCounts | null>(null);
  const [deleteConfirmValue, setDeleteConfirmValue] = useState("");
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filteredUsers = users.filter((user) =>
    user.identifier.toLowerCase().includes(userFilterText.toLowerCase())
  );

  const loadUsers = useCallback(async () => {
    try {
      setIsLoadingUsers(true);
      const res = await getUsers(project.id, 50, undefined, false);
      // Initialize users without counts
      setUsers(res.items.map((u) => ({ ...u, loadingCounts: true })));
      setNextCursor(res.next_cursor);
      setHasMoreUsers(res.has_more || false);

      // Load counts for each user
      const usersWithCounts = await Promise.all(
        res.items.map(async (user) => {
          try {
            const countsRes = await getUserResources(project.id, user.identifier);
            return { ...user, counts: countsRes.counts, loadingCounts: false };
          } catch {
            return { ...user, loadingCounts: false };
          }
        })
      );
      setUsers(usersWithCounts);
    } catch (error) {
      console.error("Failed to load users:", error);
      toast.error("Failed to load users");
    } finally {
      setIsLoadingUsers(false);
    }
  }, [project.id]);

  const loadMoreUsers = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;

    try {
      setIsLoadingMore(true);
      const res = await getUsers(project.id, 50, nextCursor, false);

      // Add new users with loading state
      const newUsersWithLoadingState = res.items.map((u) => ({
        ...u,
        loadingCounts: true
      }));
      setUsers((prev) => [...prev, ...newUsersWithLoadingState]);
      setNextCursor(res.next_cursor);
      setHasMoreUsers(res.has_more || false);

      // Load counts for new users only
      const newUsersWithCounts = await Promise.all(
        res.items.map(async (user) => {
          try {
            const countsRes = await getUserResources(project.id, user.identifier);
            return { ...user, counts: countsRes.counts, loadingCounts: false };
          } catch {
            return { ...user, loadingCounts: false };
          }
        })
      );

      // Update only the new users with their counts
      setUsers((prev) => {
        const existingCount = prev.length - res.items.length;
        return [
          ...prev.slice(0, existingCount),
          ...newUsersWithCounts
        ];
      });
    } catch (error) {
      console.error("Failed to load more users:", error);
      toast.error("Failed to load more users");
    } finally {
      setIsLoadingMore(false);
    }
  }, [project.id, nextCursor, isLoadingMore]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleRefreshUsers = async () => {
    setIsRefreshingUsers(true);
    await loadUsers();
    setIsRefreshingUsers(false);
  };

  const handleOpenDeleteDialog = (user: UserWithCounts) => {
    setUserToDelete(user);
    setDeleteConfirmValue("");
    setDeleteError(null);
    setDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    if (deleteConfirmValue.trim() !== userToDelete.identifier.trim()) {
      setDeleteError("User identifier does not match");
      return;
    }

    try {
      setIsDeletingUser(true);
      setDeleteError(null);
      await deleteUser(project.id, userToDelete.identifier);
      await loadUsers();
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      setDeleteConfirmValue("");
      toast.success("User deleted successfully");
    } catch (error) {
      console.error("Failed to delete user:", error);
      setDeleteError(
        error instanceof Error ? error.message : "Failed to delete user"
      );
      toast.error("Failed to delete user");
    } finally {
      setIsDeletingUser(false);
    }
  };

  const formatCount = (count: number | undefined) => {
    if (count === undefined) return "-";
    return count.toString();
  };

  const handleGoToDisks = (userIdentifier: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const encodedProjectId = encodeId(project.id);
    router.push(`/project/${encodedProjectId}/disk?user=${encodeURIComponent(userIdentifier)}`);
  };

  const handleGoToSessions = (userIdentifier: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const encodedProjectId = encodeId(project.id);
    router.push(`/project/${encodedProjectId}/session?user=${encodeURIComponent(userIdentifier)}`);
  };

  const handleGoToAgentSkills = (userIdentifier: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const encodedProjectId = encodeId(project.id);
    router.push(`/project/${encodedProjectId}/agent-skills?user=${encodeURIComponent(userIdentifier)}`);
  };

  return (
    <div className="h-full bg-background p-6 flex flex-col overflow-hidden space-y-2">
      <div className="shrink-0 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              User List
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage all Users
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRefreshUsers}
              disabled={isRefreshingUsers}
            >
              {isRefreshingUsers ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Filter by identifier"
            value={userFilterText}
            onChange={(e) => setUserFilterText(e.target.value)}
            className="max-w-sm"
          />
        </div>
      </div>

      <div className="flex-1 rounded-md border overflow-hidden flex flex-col min-h-0">
        {isLoadingUsers ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">
              {users.length === 0 ? "No users found" : "No matching users"}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Identifier</TableHead>
                    <TableHead className="text-center">Disks</TableHead>
                    <TableHead className="text-center">Sessions</TableHead>
                    <TableHead className="text-center">Agent Skills</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-mono">{user.identifier}</TableCell>
                      <TableCell className="text-center">
                        {user.loadingCounts ? (
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        ) : (
                          formatCount(user.counts?.disks_count)
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {user.loadingCounts ? (
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        ) : (
                          formatCount(user.counts?.sessions_count)
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {user.loadingCounts ? (
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        ) : (
                          formatCount(user.counts?.skills_count)
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => handleGoToDisks(user.identifier, e)}
                            disabled={!user.counts?.disks_count}
                          >
                            Disks
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => handleGoToSessions(user.identifier, e)}
                            disabled={!user.counts?.sessions_count}
                          >
                            Sessions
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => handleGoToAgentSkills(user.identifier, e)}
                            disabled={!user.counts?.skills_count}
                          >
                            Agent Skills
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleOpenDeleteDialog(user)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {hasMoreUsers && !userFilterText && (
              <div className="p-4 flex justify-center border-t">
                <Button
                  variant="outline"
                  onClick={loadMoreUsers}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setDeleteConfirmValue("");
            setDeleteError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete User
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete user &ldquo;
              {userToDelete?.identifier}&rdquo;? This action cannot be undone
              and will permanently delete all associated resources (disks,
              sessions, skills, spaces).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="delete-confirm-identifier">
                Please type{" "}
                <span className="font-semibold">{userToDelete?.identifier}</span>{" "}
                to confirm
              </Label>
              <Input
                id="delete-confirm-identifier"
                value={deleteConfirmValue}
                onChange={(e) => {
                  setDeleteConfirmValue(e.target.value);
                  setDeleteError(null);
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    deleteConfirmValue.trim() === userToDelete?.identifier.trim()
                  ) {
                    handleDeleteUser();
                  }
                }}
                placeholder={userToDelete?.identifier}
                disabled={isDeletingUser}
              />
            </div>
            {deleteError && (
              <p className="text-sm text-destructive">{deleteError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteConfirmValue("");
                setDeleteError(null);
              }}
              disabled={isDeletingUser}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={
                isDeletingUser ||
                deleteConfirmValue.trim() !== userToDelete?.identifier.trim()
              }
            >
              {isDeletingUser ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting
                </>
              ) : (
                "Delete User"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
