"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { PaginationBar } from "@/components/pagination-bar";
import { SessionActions } from "@/components/session-actions";
import {
  getSessions,
  createSession,
} from "@/app/session/actions";
import { Session } from "@/types";
import ReactCodeMirror from "@uiw/react-codemirror";
import { okaidia } from "@uiw/codemirror-theme-okaidia";
import { json } from "@codemirror/lang-json";
import { EditorView } from "@codemirror/view";
import { Checkbox } from "@/components/ui/checkbox";

const PAGE_SIZE = 20;

export default function SessionsPage() {
  const t = useTranslations("session");
  const tp = useTranslations("pagination");
  const { resolvedTheme } = useTheme();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isRefreshingSessions, setIsRefreshingSessions] = useState(false);
  const [sessionFilterText, setSessionFilterText] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createConfigValue, setCreateConfigValue] = useState("{}");
  const [createConfigError, setCreateConfigError] = useState<string>("");
  const [isCreateConfigValid, setIsCreateConfigValid] = useState(true);
  const [createUser, setCreateUser] = useState<string>("");
  const [createDisableTaskTracking, setCreateDisableTaskTracking] = useState(false);

  const filteredSessions = sessions.filter((session) => {
    const matchesId = session.id
      .toLowerCase()
      .includes(sessionFilterText.toLowerCase());
    return matchesId;
  });

  const totalPages = Math.ceil(filteredSessions.length / PAGE_SIZE);
  const paginatedSessions = filteredSessions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const loadSessions = async () => {
    try {
      setIsLoadingSessions(true);

      const first = await getSessions(
        userFilter || undefined,
        undefined,
        50,
        undefined,
        true
      );
      if (first.code !== 0) {
        console.error(first.message);
        setIsLoadingSessions(false);
        return;
      }
      setSessions(first.data?.items || []);
      setCurrentPage(1);
      setIsLoadingSessions(false);

      if (first.data?.has_more) {
        setIsLoadingMore(true);
        let cursor = first.data?.next_cursor;
        while (cursor) {
          const res = await getSessions(
            userFilter || undefined,
            undefined,
            50,
            cursor,
            true
          );
          if (res.code !== 0) {
            console.error(res.message);
            break;
          }
          setSessions(prev => [...prev, ...(res.data?.items || [])]);
          cursor = res.data?.has_more ? res.data?.next_cursor : undefined;
        }
        setIsLoadingMore(false);
      }
    } catch (error) {
      console.error("Failed to load sessions:", error);
      setIsLoadingSessions(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userFilter]);

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

  const handleOpenCreateDialog = () => {
    setCreateConfigValue("{}");
    setCreateConfigError("");
    setIsCreateConfigValid(true);
    setCreateUser("");
    setCreateDisableTaskTracking(false);
    setCreateDialogOpen(true);
  };

  const handleCreateSession = async () => {
    const trimmedValue = createConfigValue.trim();
    if (!trimmedValue) {
      setCreateConfigError(t("invalidJson") + ": Empty configuration");
      return;
    }

    try {
      const configs = JSON.parse(trimmedValue);
      setCreateConfigError("");
      setIsCreatingSession(true);
      const res = await createSession(
        createUser || undefined,
        configs,
        createDisableTaskTracking || undefined
      );
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
            <h1 className="text-2xl font-bold">{t("sessionList")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("sessionListDescription")}
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
          <Input
            type="text"
            placeholder={t("filterByUser")}
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="max-w-[200px]"
          />
          <Input
            type="text"
            placeholder={t("filterById")}
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
              {sessions.length === 0 ? t("noData") : t("noMatching")}
            </p>
          </div>
        ) : (
          <>
          <div className="overflow-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("sessionId")}</TableHead>
                  <TableHead>{t("userId")}</TableHead>
                  <TableHead>{t("createdAt")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSessions.map((session) => (
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
                      {session.user_id || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(session.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <SessionActions
                        sessionId={session.id}
                        onDelete={() => {
                          if (selectedSession?.id === session.id) {
                            setSelectedSession(null);
                          }
                          loadSessions();
                        }}
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
            itemLabel={tp("sessions")}
            isLoading={isLoadingMore}
          />
          </>
        )}
      </div>

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
                {t("user")}
              </label>
              <Input
                type="text"
                placeholder={t("userPlaceholder")}
                value={createUser}
                onChange={(e) => setCreateUser(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="disableTaskTracking"
                checked={createDisableTaskTracking}
                onCheckedChange={(checked) =>
                  setCreateDisableTaskTracking(checked === true)
                }
              />
              <label
                htmlFor="disableTaskTracking"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {t("disableTaskTracking")}
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("configs")}
              </label>
              <ReactCodeMirror
                value={createConfigValue}
                height="300px"
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
