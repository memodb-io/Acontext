"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
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
import { SessionActions } from "@/components/session-actions";
import { Session, Organization, Project, User } from "@/types";
import {
  getSessions,
  createSession,
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

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createConfigValue, setCreateConfigValue] = useState("{}");
  const [createConfigError, setCreateConfigError] = useState<string>("");
  const [isCreateConfigValid, setIsCreateConfigValid] = useState(true);
  const [createUserValue, setCreateUserValue] = useState("");
  const [createUserOpen, setCreateUserOpen] = useState(false);

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

  const handleRefreshSessions = async () => {
    setIsRefreshingSessions(true);
    await loadSessions();
    setIsRefreshingSessions(false);
  };

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
                        <SessionActions
                          projectId={project.id}
                          sessionId={session.id}
                          onDelete={loadSessions}
                        />
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
