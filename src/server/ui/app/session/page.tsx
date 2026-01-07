"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Loader2, Plus, RefreshCw } from "lucide-react";
import {
  getSessions,
  createSession,
  deleteSession,
  getSessionConfigs,
  updateSessionConfigs,
  connectSessionToSpace,
} from "@/app/session/actions";
import {
  getSpaces,
} from "@/app/space/actions";
import { Session, Space } from "@/types";
import ReactCodeMirror from "@uiw/react-codemirror";
import { okaidia } from "@uiw/codemirror-theme-okaidia";
import { json } from "@codemirror/lang-json";
import { EditorView } from "@codemirror/view";

export default function SessionsPage() {
  const t = useTranslations("space");
  const router = useRouter();
  const { resolvedTheme } = useTheme();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isRefreshingSessions, setIsRefreshingSessions] = useState(false);
  const [sessionFilterText, setSessionFilterText] = useState("");
  const [sessionSpaceFilter, setSessionSpaceFilter] = useState<string>("all");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createConfigValue, setCreateConfigValue] = useState("{}");
  const [createConfigError, setCreateConfigError] = useState<string>("");
  const [isCreateConfigValid, setIsCreateConfigValid] = useState(true);
  const [createSpaceId, setCreateSpaceId] = useState<string>("none");

  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configEditValue, setConfigEditValue] = useState("");
  const [configEditError, setConfigEditError] = useState<string>("");
  const [isConfigEditValid, setIsConfigEditValid] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configEditTarget, setConfigEditTarget] = useState<Session | null>(
    null
  );

  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [connectTargetSession, setConnectTargetSession] = useState<Session | null>(null);
  const [connectSpaceId, setConnectSpaceId] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);

  const filteredSessions = sessions.filter((session) => {
    const matchesId = session.id
      .toLowerCase()
      .includes(sessionFilterText.toLowerCase());
    return matchesId;
  });

  const loadSessions = async () => {
    try {
      setIsLoadingSessions(true);
      // Pass filter parameters to backend
      let spaceId: string | undefined;
      let notConnected: boolean | undefined;

      if (sessionSpaceFilter === "not-connected") {
        notConnected = true;
      } else if (sessionSpaceFilter !== "all") {
        spaceId = sessionSpaceFilter;
      }

      const allSsns: Session[] = [];
      let cursor: string | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        const res = await getSessions(spaceId, notConnected, 50, cursor, true);
        if (res.code !== 0) {
          console.error(res.message);
          break;
        }
        allSsns.push(...(res.data?.items || []));
        cursor = res.data?.next_cursor;
        hasMore = res.data?.has_more || false;
      }

      setSessions(allSsns);
    } catch (error) {
      console.error("Failed to load sessions:", error);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const loadSpaces = async () => {
    try {
      const allSpcs: Space[] = [];
      let cursor: string | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        const res = await getSpaces(50, cursor, true);
        if (res.code !== 0) {
          console.error(res.message);
          break;
        }
        allSpcs.push(...(res.data?.items || []));
        cursor = res.data?.next_cursor;
        hasMore = res.data?.has_more || false;
      }

      setSpaces(allSpcs);
    } catch (error) {
      console.error("Failed to load spaces:", error);
    }
  };

  useEffect(() => {
    loadSessions();
    loadSpaces();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionSpaceFilter]);

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
          setCreateConfigError(t("invalidJson") + ": " + error.message);
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
          setConfigEditError(t("invalidJson") + ": " + error.message);
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
    setCreateSpaceId("none");
    setCreateDialogOpen(true);
  };

  const handleCreateSession = async () => {
    // Validate input
    const trimmedValue = createConfigValue.trim();
    if (!trimmedValue) {
      setCreateConfigError(t("invalidJson") + ": Empty configuration");
      return;
    }

    try {
      const configs = JSON.parse(trimmedValue);
      setCreateConfigError("");
      setIsCreatingSession(true);
      const spaceId = createSpaceId === "none" ? undefined : createSpaceId;
      const res = await createSession(spaceId, configs);
      if (res.code !== 0) {
        console.error(res.message);
        setCreateConfigError(res.message);
        setIsCreatingSession(false);
        return;
      }
      await loadSessions();
      setCreateDialogOpen(false);
    } catch (error) {
      console.error("Failed to create session:", error);
      if (error instanceof SyntaxError) {
        setCreateConfigError(t("invalidJson") + ": " + error.message);
      } else {
        setCreateConfigError(String(error));
      }
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;
    try {
      setIsDeletingSession(true);
      const res = await deleteSession(sessionToDelete.id);
      if (res.code !== 0) {
        console.error(res.message);
        return;
      }
      if (selectedSession?.id === sessionToDelete.id) {
        setSelectedSession(null);
      }
      await loadSessions();
    } catch (error) {
      console.error("Failed to delete session:", error);
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

      const res = await getSessionConfigs(session.id);
      if (res.code === 0 && res.data) {
        configs = res.data.configs;
      }

      setConfigEditValue(JSON.stringify(configs, null, 2));
      setConfigDialogOpen(true);
    } catch (error) {
      console.error("Failed to load config:", error);
    }
  };

  const handleSaveConfig = async () => {
    if (!configEditTarget) return;

    // Validate input
    const trimmedValue = configEditValue.trim();
    if (!trimmedValue) {
      setConfigEditError(t("invalidJson") + ": Empty configuration");
      return;
    }

    try {
      const configs = JSON.parse(trimmedValue);
      setConfigEditError("");
      setIsSavingConfig(true);

      const res = await updateSessionConfigs(configEditTarget.id, configs);
      if (res.code !== 0) {
        console.error(res.message);
        setConfigEditError(res.message);
        setIsSavingConfig(false);
        return;
      }
      await loadSessions();
      setConfigDialogOpen(false);
    } catch (error) {
      console.error("Failed to save config:", error);
      if (error instanceof SyntaxError) {
        setConfigEditError(t("invalidJson") + ": " + error.message);
      } else {
        setConfigEditError(String(error));
      }
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleOpenConnectDialog = (session: Session) => {
    setConnectTargetSession(session);
    setConnectSpaceId(spaces.length > 0 ? spaces[0].id : "");
    setConnectDialogOpen(true);
  };

  const handleConnectToSpace = async () => {
    if (!connectTargetSession || !connectSpaceId) return;

    try {
      setIsConnecting(true);
      const res = await connectSessionToSpace(connectTargetSession.id, connectSpaceId);
      if (res.code !== 0) {
        console.error(res.message);
        return;
      }
      await loadSessions();
      setConnectDialogOpen(false);
    } catch (error) {
      console.error("Failed to connect to space:", error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleGoToMessages = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/session/${sessionId}/messages`);
  };

  const handleGoToTasks = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/session/${sessionId}/task`);
  };

  return (
    <div className="h-full bg-background p-6 flex flex-col overflow-hidden space-y-2">
      <div className="flex-shrink-0 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("sessionList")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("sessionListDescription") || "管理所有 Session"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleOpenCreateDialog}
            >
              <Plus className="h-4 w-4" />
              {t("createSession")}
            </Button>
            <Button
              variant="outline"
              onClick={handleRefreshSessions}
              disabled={isRefreshingSessions}
            >
              {isRefreshingSessions ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("loading")}
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  {t("refresh")}
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Select
            value={sessionSpaceFilter}
            onValueChange={setSessionSpaceFilter}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allSpaces")}</SelectItem>
              <SelectItem value="not-connected">{t("notConnected")}</SelectItem>
              {spaces.map((space) => (
                <SelectItem key={space.id} value={space.id}>
                  {space.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="text"
            placeholder={t("filterById")}
            value={sessionFilterText}
            onChange={(e) => setSessionFilterText(e.target.value)}
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
              {sessions.length === 0 ? t("noData") : t("noMatching")}
            </p>
          </div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("sessionId")}</TableHead>
                  <TableHead>{t("spaceId")}</TableHead>
                  <TableHead>{t("createdAt")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSessions.map((session) => (
                  <TableRow
                    key={session.id}
                    className="cursor-pointer"
                    data-state={selectedSession?.id === session.id ? "selected" : undefined}
                    onClick={() => setSelectedSession(session)}
                  >
                    <TableCell className="font-mono">
                      {session.id}
                    </TableCell>
                    <TableCell className="font-mono">
                      {session.space_id || (
                        <span className="text-muted-foreground">
                          {t("notConnected")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(session.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => handleGoToMessages(session.id, e)}
                        >
                          {t("messages") || "Messages"}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => handleGoToTasks(session.id, e)}
                        >
                          {t("tasks") || "Tasks"}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenConnectDialog(session);
                          }}
                        >
                          {t("connectToSpace")}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewConfig(session);
                          }}
                        >
                          {t("config")}
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
                          {t("delete")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteSessionConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingSession}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSession}
              disabled={isDeletingSession}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingSession ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("deleting")}
                </>
              ) : (
                t("delete")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Config Dialog */}
      <AlertDialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("editConfigsTitle")}</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="py-4">
            <ReactCodeMirror
              value={configEditValue}
              height="400px"
              theme={resolvedTheme === "dark" ? okaidia : "light"}
              extensions={[json(), EditorView.lineWrapping]}
              onChange={handleConfigEditChange}
              placeholder={t("configsPlaceholder")}
              className="border rounded-md overflow-hidden"
            />
            {configEditError && (
              <p className="mt-2 text-sm text-destructive">{configEditError}</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSavingConfig}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSaveConfig}
              disabled={isSavingConfig || !isConfigEditValid}
            >
              {isSavingConfig ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                t("save")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Connect to Space Dialog */}
      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("connectToSpaceTitle")}</DialogTitle>
            <DialogDescription>{t("connectToSpaceDescription")}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select
              value={connectSpaceId}
              onValueChange={setConnectSpaceId}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {spaces.map((space) => (
                  <SelectItem key={space.id} value={space.id}>
                    {space.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConnectDialogOpen(false)}
              disabled={isConnecting}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleConnectToSpace}
              disabled={isConnecting || !connectSpaceId}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("connecting")}
                </>
              ) : (
                t("connect")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Session Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("createSessionTitle")}</DialogTitle>
            <DialogDescription>{t("createSessionDescription")}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("selectSpace")}
              </label>
              <Select
                value={createSpaceId}
                onValueChange={setCreateSpaceId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("notConnected")}</SelectItem>
                  {spaces.map((space) => (
                    <SelectItem key={space.id} value={space.id}>
                      {space.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("configs")}
              </label>
              <ReactCodeMirror
                value={createConfigValue}
                height="400px"
                theme={resolvedTheme === "dark" ? okaidia : "light"}
                extensions={[json(), EditorView.lineWrapping]}
                onChange={handleCreateConfigChange}
                placeholder={t("configsPlaceholder")}
                className="border rounded-md overflow-hidden"
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
              {t("cancel")}
            </Button>
            <Button
              onClick={handleCreateSession}
              disabled={isCreatingSession || !isCreateConfigValid}
            >
              {isCreatingSession ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("creating")}
                </>
              ) : (
                t("create")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

