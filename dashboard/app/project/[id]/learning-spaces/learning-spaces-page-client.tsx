"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { encodeId } from "@/lib/id-codec";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CodeEditor } from "@/components/code-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Loader2, Plus, RefreshCw, ChevronsUpDown } from "lucide-react";
import { PaginationBar } from "@/components/pagination-bar";
import { useTopNavStore } from "@/stores/top-nav";
import { Organization, Project, User, LearningSpace } from "@/types";
import {
  getLearningSpaces,
  createLearningSpace,
  deleteLearningSpace,
  updateLearningSpace,
} from "./actions";
import { getAllUsers } from "../actions";
import { toast } from "sonner";

const PAGE_SIZE = 20;

interface LearningSpacesPageClientProps {
  project: Project;
  currentOrganization: Organization;
  allOrganizations: Organization[];
  projects: Project[];
}

export function LearningSpacesPageClient({
  project,
  currentOrganization,
  allOrganizations,
  projects,
}: LearningSpacesPageClientProps) {
  const searchParams = useSearchParams();
  const { initialize, setHasSidebar } = useTopNavStore();

  const [spaces, setSpaces] = useState<LearningSpace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [filterText, setFilterText] = useState("");
  const [userFilter, setUserFilter] = useState<string>(() => {
    const userFromUrl = searchParams.get("user");
    return userFromUrl || "all";
  });
  const [users, setUsers] = useState<User[]>([]);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createUser, setCreateUser] = useState("");
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createMetaValue, setCreateMetaValue] = useState("{}");
  const [createMetaError, setCreateMetaError] = useState<string>("");
  const [isCreateMetaValid, setIsCreateMetaValid] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [spaceToDelete, setSpaceToDelete] = useState<LearningSpace | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [editMetaOpen, setEditMetaOpen] = useState(false);
  const [editMetaTarget, setEditMetaTarget] = useState<LearningSpace | null>(null);
  const [editMetaValue, setEditMetaValue] = useState("");
  const [editMetaError, setEditMetaError] = useState<string>("");
  const [isEditMetaValid, setIsEditMetaValid] = useState(true);
  const [isSavingMeta, setIsSavingMeta] = useState(false);

  const projectId = project.id;
  const encodedProjectId = encodeId(projectId);

  const getUserIdentifier = (userId: string | null) => {
    if (!userId) return null;
    const user = users.find((u) => u.id === userId);
    return user?.identifier || userId;
  };

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
  }, [
    project,
    currentOrganization,
    allOrganizations,
    projects,
    initialize,
    setHasSidebar,
  ]);

  const loadSpaces = useCallback(async () => {
    try {
      setIsLoading(true);
      const userParam = userFilter === "all" ? undefined : userFilter;

      const first = await getLearningSpaces(projectId, 50, undefined, true, userParam);
      setSpaces(first.items || []);
      setCurrentPage(1);
      setIsLoading(false);

      if (first.has_more) {
        setIsLoadingMore(true);
        let cursor = first.next_cursor;
        while (cursor) {
          const res = await getLearningSpaces(projectId, 50, cursor, true, userParam);
          setSpaces(prev => [...prev, ...(res.items || [])]);
          cursor = res.has_more ? res.next_cursor : undefined;
        }
        setIsLoadingMore(false);
      }
    } catch (error) {
      console.error("Failed to load learning spaces:", error);
      toast.error("Failed to load learning spaces");
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [projectId, userFilter]);

  const loadUsers = useCallback(async () => {
    try {
      const allUsers = await getAllUsers(projectId);
      setUsers(allUsers);
    } catch (error) {
      console.error("Failed to load users:", error);
    }
  }, [projectId]);

  useEffect(() => {
    loadSpaces();
  }, [loadSpaces]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredSpaces = useMemo(() => {
    if (!filterText) return spaces;
    const lower = filterText.toLowerCase();
    return spaces.filter(
      (s) =>
        s.id.toLowerCase().includes(lower) ||
        (s.user_id && s.user_id.toLowerCase().includes(lower)) ||
        (s.meta && JSON.stringify(s.meta).toLowerCase().includes(lower))
    );
  }, [spaces, filterText]);

  const totalPages = Math.ceil(filteredSpaces.length / PAGE_SIZE);
  const paginatedSpaces = filteredSpaces.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadSpaces();
    setIsRefreshing(false);
  };

  const validateJSON = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  };

  const handleCreateMetaChange = (value: string) => {
    setCreateMetaValue(value);
    const isValid = validateJSON(value);
    setIsCreateMetaValid(isValid);
    if (!isValid && value.trim()) {
      try {
        JSON.parse(value.trim());
      } catch (error) {
        if (error instanceof SyntaxError) {
          setCreateMetaError("Invalid JSON: " + error.message);
        }
      }
    } else {
      setCreateMetaError("");
    }
  };

  const handleOpenCreate = () => {
    setCreateUser("");
    setCreateMetaValue("{}");
    setCreateMetaError("");
    setIsCreateMetaValid(true);
    setCreateUserOpen(false);
    setCreateDialogOpen(true);
  };

  const handleCreate = async () => {
    const trimmedValue = createMetaValue.trim();
    if (!trimmedValue) {
      setCreateMetaError("Invalid JSON: Empty metadata");
      return;
    }

    setIsCreating(true);
    try {
      const parsedMeta = JSON.parse(trimmedValue);
      setCreateMetaError("");
      const userParam = createUser.trim() || undefined;
      const metaParam = Object.keys(parsedMeta).length > 0 ? parsedMeta : undefined;
      await createLearningSpace(projectId, userParam, metaParam);
      toast.success("Learning space created successfully");
      setCreateDialogOpen(false);
      await loadSpaces();
      await loadUsers();
    } catch (error) {
      console.error("Failed to create learning space:", error);
      if (error instanceof SyntaxError) {
        setCreateMetaError("Invalid JSON: " + error.message);
      } else {
        toast.error("Failed to create learning space");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteClick = (space: LearningSpace) => {
    setSpaceToDelete(space);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!spaceToDelete) return;
    setIsDeleting(true);
    try {
      await deleteLearningSpace(projectId, spaceToDelete.id);
      toast.success("Learning space deleted successfully");
      setDeleteDialogOpen(false);
      setSpaceToDelete(null);
      await loadSpaces();
    } catch (error) {
      console.error("Failed to delete learning space:", error);
      toast.error("Failed to delete learning space");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditMetaClick = (e: React.MouseEvent, space: LearningSpace) => {
    e.stopPropagation();
    setEditMetaTarget(space);
    setEditMetaValue(
      space.meta ? JSON.stringify(space.meta, null, 2) : "{}"
    );
    setEditMetaError("");
    setIsEditMetaValid(true);
    setEditMetaOpen(true);
  };

  const handleEditMetaChange = (value: string) => {
    setEditMetaValue(value);
    const isValid = validateJSON(value);
    setIsEditMetaValid(isValid);
    if (!isValid && value.trim()) {
      try {
        JSON.parse(value.trim());
      } catch (error) {
        if (error instanceof SyntaxError) {
          setEditMetaError("Invalid JSON: " + error.message);
        }
      }
    } else {
      setEditMetaError("");
    }
  };

  const handleSaveMeta = async () => {
    if (!editMetaTarget) return;
    const trimmedValue = editMetaValue.trim();
    if (!trimmedValue) {
      setEditMetaError("Invalid JSON: Empty metadata");
      return;
    }

    setIsSavingMeta(true);
    try {
      const parsed = JSON.parse(trimmedValue);
      setEditMetaError("");
      await updateLearningSpace(projectId, editMetaTarget.id, parsed);
      toast.success("Metadata updated");
      setEditMetaOpen(false);
      setEditMetaTarget(null);
      await loadSpaces();
    } catch (err) {
      console.error("Failed to update metadata:", err);
      if (err instanceof SyntaxError) {
        setEditMetaError("Invalid JSON: " + err.message);
      } else {
        toast.error(
          err instanceof Error ? err.message : "Failed to update metadata"
        );
      }
    } finally {
      setIsSavingMeta(false);
    }
  };

  const filtersActive = filterText !== "" || userFilter !== "all";

  return (
    <div className="h-full bg-background p-6 flex flex-col overflow-hidden space-y-2">
      <div className="shrink-0 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Learning Spaces</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage learning spaces for AI agent skill acquisition from sessions.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleOpenCreate}>
              <Plus className="h-4 w-4" />
              Create
            </Button>
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
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
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by User" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.identifier}>
                  {user.identifier}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="text"
            placeholder="Search by ID, user, or metadata..."
            value={filterText}
            onChange={(e) => {
              setFilterText(e.target.value);
              setCurrentPage(1);
            }}
            className="max-w-sm"
          />
        </div>
      </div>

      <div className="flex-1 rounded-md border overflow-hidden flex flex-col min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredSpaces.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">
              {filtersActive
                ? "No learning spaces found matching filters"
                : "No learning spaces yet"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="overflow-auto flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Meta</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSpaces.map((space) => (
                    <TableRow
                      key={space.id}
                    >
                      <TableCell className="font-mono text-sm">
                        {space.id}
                      </TableCell>
                      <TableCell>
                        {space.user_id === null
                          ? "—"
                          : getUserIdentifier(space.user_id) ??
                            `${space.user_id.slice(0, 8)}…`}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {(() => {
                          if (space.meta === null) return "—";
                          const metaStr = JSON.stringify(space.meta);
                          return metaStr.length > 50
                            ? metaStr.slice(0, 50) + "…"
                            : metaStr;
                        })()}
                      </TableCell>
                      <TableCell>
                        {new Date(space.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="secondary" size="sm" asChild>
                            <Link href={`/project/${encodedProjectId}/learning-spaces/${encodeId(space.id)}`}>
                              Details
                            </Link>
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => handleEditMetaClick(e, space)}
                          >
                            Edit Meta
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(space);
                            }}
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

            <PaginationBar
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredSpaces.length}
              onPageChange={setCurrentPage}
              itemLabel="spaces"
              isLoading={isLoadingMore}
            />
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Learning Space</DialogTitle>
            <DialogDescription>
              Create a new learning space. Optionally associate it with a user
              and add metadata.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                User Identifier (Optional)
              </label>
              <InputGroup>
                <InputGroupInput
                  value={createUser}
                  onChange={(e) => setCreateUser(e.target.value)}
                  placeholder="Select an existing user or type a new identifier"
                />
                <InputGroupAddon align="inline-end">
                  <Popover
                    open={createUserOpen}
                    onOpenChange={setCreateUserOpen}
                  >
                    <PopoverTrigger asChild>
                      <InputGroupButton variant="outline" size="icon-xs">
                        <ChevronsUpDown className="h-4 w-4" />
                      </InputGroupButton>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[--radix-popover-trigger-width] p-0"
                      align="end"
                    >
                      <Command>
                        <CommandList>
                          <CommandGroup>
                            {users.map((user) => (
                              <CommandItem
                                key={user.id}
                                value={user.identifier}
                                onSelect={(value) => {
                                  setCreateUser(value);
                                  setCreateUserOpen(false);
                                }}
                              >
                                {user.identifier}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </InputGroupAddon>
              </InputGroup>
            </div>
            <div className="space-y-2">
              <Label>Metadata (JSON)</Label>
              <CodeEditor
                value={createMetaValue}
                onChange={handleCreateMetaChange}
                language="json"
                height="400px"
              />
              {createMetaError && (
                <p className="text-sm text-destructive">{createMetaError}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isCreating || !isCreateMetaValid}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Learning Space</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete learning space{" "}
              <span className="font-semibold font-mono">
                {spaceToDelete?.id.slice(0, 8)}…
              </span>
              ? This will also remove all associated skills and learning
              sessions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Metadata Dialog */}
      <Dialog open={editMetaOpen} onOpenChange={setEditMetaOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Metadata</DialogTitle>
            <DialogDescription>
              Update metadata for learning space{" "}
              <span className="font-mono">
                {editMetaTarget?.id.slice(0, 8)}…
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label>Metadata (JSON)</Label>
            <CodeEditor
              value={editMetaValue}
              onChange={handleEditMetaChange}
              language="json"
              height="400px"
            />
            {editMetaError && (
              <p className="text-sm text-destructive">{editMetaError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditMetaOpen(false)}
              disabled={isSavingMeta}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveMeta}
              disabled={isSavingMeta || !isEditMetaValid}
            >
              {isSavingMeta ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
