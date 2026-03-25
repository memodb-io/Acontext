"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { encodeId } from "@/lib/id-codec";
import { useTopNavStore } from "@/stores/top-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { CodeEditor } from "@/components/code-editor";
import { PaginationBar } from "@/components/pagination-bar";
import { Session, Organization, Project, User } from "@/types";
import {
  getSessions,
  createSession,
  deleteSession,
  getSessionConfigs,
  updateSessionConfigs,
} from "./actions";
import { getAllUsers } from "../actions";
import { toast } from "sonner";

const PAGE_SIZE = 20;

interface SessionPageClientProps {
  project: Project;
  currentOrganization: Organization;
  allOrganizations: Organization[];
  projects: Project[];
}

export function SessionPageClient({
  project,
  currentOrganization,
  allOrganizations,
  projects,
}: SessionPageClientProps) {
  const searchParams = useSearchParams();
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

  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isRefreshingSessions, setIsRefreshingSessions] = useState(false);
  const [sessionFilterText, setSessionFilterText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createConfigValue, setCreateConfigValue] = useState("{}");
  const [createConfigError, setCreateConfigError] = useState<string>("");
  const [isCreateConfigValid, setIsCreateConfigValid] = useState(true);
  const [createUserValue, setCreateUserValue] = useState("");
  const [createUserOpen, setCreateUserOpen] = useState(false);

  const [configDialogOpen, setConfigDialogOpen] = useState(false);

  // User filter and list
  const [userFilter, setUserFilter] = useState<string>(() => {
    const userFromUrl = searchParams.get("user");
    return userFromUrl || "all";
  });
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Helper to get user identifier from user_id
  const getUserIdentifier = (userId: string | undefined) => {
    if (!userId) return null;
    const user = users.find((u) => u.id === userId);
    return user?.identifier || userId;
  };
  const [configEditValue, setConfigEditValue] = useState("");
  const [configEditError, setConfigEditError] = useState<string>("");
  const [isConfigEditValid, setIsConfigEditValid] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configEditTarget, setConfigEditTarget] = useState<Session | null>(null);

  // Connect to Space feature removed

  // Memoize filtered sessions to avoid recomputation on every render
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const matchesId = session.id
        .toLowerCase()
        .includes(sessionFilterText.toLowerCase());
      return matchesId;
    });
  }, [sessions, sessionFilterText]);

  const totalPages = Math.ceil(filteredSessions.length / PAGE_SIZE);
  const paginatedSessions = filteredSessions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const loadSessions = useCallback(async () => {
    try {
      setIsLoadingSessions(true);
      const userParam = userFilter === "all" ? undefined : userFilter;

      const first = await getSessions(project.id, 50, undefined, true, userParam);
      setSessions(first.items || []);
      setCurrentPage(1);
      setIsLoadingSessions(false);

      if (first.has_more) {
        setIsLoadingMore(true);
        let cursor = first.next_cursor;
        while (cursor) {
          const res = await getSessions(project.id, 50, cursor, true, userParam);
          setSessions(prev => [...prev, ...(res.items || [])]);
          cursor = res.has_more ? res.next_cursor : undefined;
        }
        setIsLoadingMore(false);
      }
    } catch (error) {
      console.error("Failed to load sessions:", error);
      toast.error("Failed to load sessions");
      setIsLoadingSessions(false);
      setIsLoadingMore(false);
    }
  }, [project.id, userFilter]);

  const loadUsers = useCallback(async () => {
    try {
      setIsLoadingUsers(true);
      const allUsers = await getAllUsers(project.id);
      setUsers(allUsers);
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [project.id]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

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

  const handleCreateConfigChange = (value: string) => {
    setCreateConfigValue(value);
    const isValid = validateJSON(value);
    setIsCreateConfigValid(isValid);
    if (!isValid && value.trim()) {
      try {
        JSON.parse(value.trim());
      } catch (error) {
        if (error instanceof SyntaxError) {
          setCreateConfigError("Invalid JSON: " + error.message);
        }
      }
    } else {
      setCreateConfigError("");
    }
  };

  const handleConfigEditChange = (value: string) => {
    setConfigEditValue(value);
    const isValid = validateJSON(value);
    setIsConfigEditValid(isValid);
    if (!isValid && value.trim()) {
      try {
        JSON.parse(value.trim());
      } catch (error) {
        if (error instanceof SyntaxError) {
          setConfigEditError("Invalid JSON: " + error.message);
        }
      }
    } else {
      setConfigEditError("");
    }
  };

  const handleOpenCreateDialog = () => {
    setCreateConfigValue("{}");
    setCreateConfigError("");
    setIsCreateConfigValid(true);
    setCreateUserValue("");
    setCreateUserOpen(false);
    setCreateDialogOpen(true);
  };

  const handleCreateSession = async () => {
    const trimmedValue = createConfigValue.trim();
    if (!trimmedValue) {
      setCreateConfigError("Invalid JSON: Empty configuration");
      return;
    }

    try {
      const configs = JSON.parse(trimmedValue);
      setCreateConfigError("");
      setIsCreatingSession(true);
      const userParam = createUserValue.trim() || undefined;
      await createSession(project.id, configs, userParam);
      await loadSessions();
      await loadUsers(); // Refresh users in case a new user was created
      setCreateDialogOpen(false);
      toast.success("Session created successfully");
    } catch (error) {
      console.error("Failed to create session:", error);
      if (error instanceof SyntaxError) {
        setCreateConfigError("Invalid JSON: " + error.message);
      } else {
        setCreateConfigError(String(error));
      }
      toast.error("Failed to create session");
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;
    try {
      setIsDeletingSession(true);
      await deleteSession(project.id, sessionToDelete.id);
      await loadSessions();
      toast.success("Session deleted successfully");
    } catch (error) {
      console.error("Failed to delete session:", error);
      toast.error("Failed to delete session");
    } finally {
      setIsDeletingSession(false);
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
    }
  };

  const handleRefreshSessions = async () => {
    setIsRefreshingSessions(true);
    await loadSessions();
    setIsRefreshingSessions(false);
  };

  const handleViewConfig = async (session: Session) => {
    try {
      setConfigEditTarget(session);
      setConfigEditError("");
      setIsConfigEditValid(true);
      let configs = session.configs;

      const res = await getSessionConfigs(project.id, session.id);
      if (res) {
        configs = res.configs;
      }

      setConfigEditValue(JSON.stringify(configs, null, 2));
      setConfigDialogOpen(true);
    } catch (error) {
      console.error("Failed to load config:", error);
      toast.error("Failed to load session config");
    }
  };

  const handleSaveConfig = async () => {
    if (!configEditTarget) return;

    const trimmedValue = configEditValue.trim();
    if (!trimmedValue) {
      setConfigEditError("Invalid JSON: Empty configuration");
      return;
    }

    try {
      const configs = JSON.parse(trimmedValue);
      setConfigEditError("");
      setIsSavingConfig(true);

      await updateSessionConfigs(project.id, configEditTarget.id, configs);
      await loadSessions();
      setConfigDialogOpen(false);
      toast.success("Session config updated successfully");
    } catch (error) {
      console.error("Failed to save config:", error);
      if (error instanceof SyntaxError) {
        setConfigEditError("Invalid JSON: " + error.message);
      } else {
        setConfigEditError(String(error));
      }
      toast.error("Failed to update session config");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const encodedProjectId = encodeId(project.id);

  return (
    <div className="h-full bg-background p-6 flex flex-col overflow-hidden space-y-2">
      <div className="shrink-0 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Session List</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage all Sessions
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleOpenCreateDialog}
            >
              <Plus className="h-4 w-4" />
              Create Session
            </Button>
            <Button
              variant="outline"
              onClick={handleRefreshSessions}
              disabled={isRefreshingSessions}
            >
              {isRefreshingSessions ? (
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
            placeholder="Filter by ID"
            value={sessionFilterText}
            onChange={(e) => {
              setSessionFilterText(e.target.value);
              setCurrentPage(1);
            }}
            className="max-w-sm"
          />
        </div>
      </div>

      <div className="flex-1 rounded-md border overflow-hidden flex flex-col min-h-0">
        {isLoadingSessions ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">
              {sessions.length === 0 ? "No data" : "No matching sessions"}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-auto flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session ID</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-mono">
                        {session.id}
                      </TableCell>
                      <TableCell className="font-mono">
                        {isLoadingUsers ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : session.user_id ? (
                          <div className="max-w-[200px] truncate" title={getUserIdentifier(session.user_id) || ""}>
                            {getUserIdentifier(session.user_id)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(session.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="secondary" size="sm" asChild>
                            <Link href={`/project/${encodedProjectId}/session/${encodeId(session.id)}/messages`}>
                              Messages
                            </Link>
                          </Button>
                          <Button variant="secondary" size="sm" asChild>
                            <Link href={`/project/${encodedProjectId}/session/${encodeId(session.id)}/task`}>
                              Tasks
                            </Link>
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewConfig(session);
                            }}
                          >
                            Config
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSessionToDelete(session);
                              setDeleteDialogOpen(true);
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
              totalItems={filteredSessions.length}
              onPageChange={setCurrentPage}
              itemLabel="sessions"
              isLoading={isLoadingMore}
            />
          </>
        )}
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this session? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingSession}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSession}
              disabled={isDeletingSession}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingSession ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Config Dialog */}
      <AlertDialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Configs</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="py-4">
            <CodeEditor
              value={configEditValue}
              onChange={handleConfigEditChange}
              language="json"
              height="400px"
            />
            {configEditError && (
              <p className="mt-2 text-sm text-destructive">{configEditError}</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSavingConfig}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSaveConfig}
              disabled={isSavingConfig || !isConfigEditValid}
            >
              {isSavingConfig ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : (
                "Save"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Session Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Session</DialogTitle>
            <DialogDescription>Create a new session with configuration.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>User Identifier (Optional)</Label>
              <InputGroup>
                <InputGroupInput
                  value={createUserValue}
                  onChange={(e) => setCreateUserValue(e.target.value)}
                  placeholder="Select an existing user or type a new identifier"
                />
                <InputGroupAddon align="inline-end">
                  <Popover open={createUserOpen} onOpenChange={setCreateUserOpen}>
                    <PopoverTrigger asChild>
                      <InputGroupButton variant="outline" size="icon-xs">
                        <ChevronsUpDown className="h-4 w-4" />
                      </InputGroupButton>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="end">
                      <Command>
                        <CommandList>
                          <CommandGroup>
                            {users.map((user) => (
                              <CommandItem
                                key={user.id}
                                value={user.identifier}
                                onSelect={(value) => {
                                  setCreateUserValue(value);
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
              <Label>Configs</Label>
              <CodeEditor
                value={createConfigValue}
                onChange={handleCreateConfigChange}
                language="json"
                height="400px"
              />
              {createConfigError && (
                <p className="text-sm text-destructive">{createConfigError}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={isCreatingSession}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateSession}
              disabled={isCreatingSession || !isCreateConfigValid}
            >
              {isCreatingSession ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating
                </>
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
