"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { encodeId } from "@/lib/id-codec";
import { useTopNavStore } from "@/stores/top-nav";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, RefreshCw, ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { Project, Task } from "@/types";
import { getTasks, getSessionConfigs } from "../../actions";
import { CodeEditor } from "@/components/code-editor";
import { toast } from "sonner";

interface TaskPageClientProps {
  project: Project;
  sessionId: string;
}

const PAGE_SIZE = 10;

export function TaskPageClient({
  project,
  sessionId,
}: TaskPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { initialize, setHasSidebar } = useTopNavStore();

  useEffect(() => {
    initialize({ hasSidebar: true });
    return () => {
      setHasSidebar(false);
    };
  }, [initialize, setHasSidebar]);

  const [sessionInfo, setSessionInfo] = useState<string>("");
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isRefreshingTasks, setIsRefreshingTasks] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDataExpanded, setIsDataExpanded] = useState(false);

  const totalPages = Math.ceil(allTasks.length / PAGE_SIZE);
  const paginatedTasks = allTasks.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const loadSessionInfo = async () => {
    try {
      const res = await getSessionConfigs(project.id, sessionId);
      if (res) {
        setSessionInfo(sessionId);
      } else {
        setSessionInfo(sessionId);
      }
    } catch (error) {
      console.error("Failed to load session info:", error);
      setSessionInfo(sessionId);
    }
  };

  const loadAllTasks = async () => {
    try {
      setIsLoadingTasks(true);
      const allTsks: Task[] = [];
      let cursor: string | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        const res = await getTasks(project.id, sessionId, 50, cursor);
        allTsks.push(...(res.items || []));
        cursor = res.next_cursor;
        hasMore = res.has_more || false;
      }

      setAllTasks(allTsks);
      setCurrentPage(1);
    } catch (error) {
      console.error("Failed to load tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const handleRefreshTasks = async () => {
    setIsRefreshingTasks(true);
    await loadAllTasks();
    setIsRefreshingTasks(false);
  };

  useEffect(() => {
    if (sessionId) {
      loadSessionInfo();
      loadAllTasks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    const taskId = searchParams.get("taskId");
    if (taskId && allTasks.length > 0 && !isLoadingTasks) {
      const task = allTasks.find((t) => t.id === taskId);
      if (task) {
        setSelectedTask(task);
        setDetailDialogOpen(true);
        // Clean up URL parameter after opening dialog
        const newSearchParams = new URLSearchParams(searchParams.toString());
        newSearchParams.delete("taskId");
        const newUrl = newSearchParams.toString()
          ? `${window.location.pathname}?${newSearchParams.toString()}`
          : window.location.pathname;
        router.replace(newUrl);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, allTasks, isLoadingTasks]);

  const handleOpenDetailDialog = (task: Task) => {
    setSelectedTask(task);
    setDetailDialogOpen(true);
  };

  const handleGoBack = () => {
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get("returnTo");
    if (returnTo) {
      router.push(returnTo);
    } else {
      const encodedProjectId = encodeId(project.id);
      router.push(`/project/${encodedProjectId}/session`);
    }
  };

  const getStatusColor = (status: Task["status"]) => {
    switch (status) {
      case "success":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "failed":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "running":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "pending":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      default:
        return "bg-secondary";
    }
  };

  return (
    <div className="h-full bg-background p-6 flex flex-col overflow-hidden space-y-2">
      <div className="shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-stretch gap-2">
            <Button
              variant="outline"
              onClick={handleGoBack}
              className="rounded-l-md rounded-r-none h-auto px-3"
              title="Back to Sessions"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Tasks</h1>
              <p className="text-sm text-muted-foreground">
                Session: <span className="font-mono">{sessionInfo}</span>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRefreshTasks}
              disabled={isRefreshingTasks || isLoadingTasks}
            >
              {isRefreshingTasks ? (
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
      </div>

      <div className="flex-1 rounded-md border overflow-hidden flex flex-col min-h-0">
        {isLoadingTasks ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : allTasks.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">No data</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Task ID</TableHead>
                    <TableHead className="w-[80px]">Order</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[180px]">Created At</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-mono text-xs">
                        {task.id}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center justify-center rounded-md bg-secondary border border-border px-2 py-1 text-xs font-medium">
                          {task.order}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${getStatusColor(
                            task.status
                          )}`}
                        >
                          {task.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(task.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenDetailDialog(task)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="border-t p-4 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Task Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onOpenChange={(open) => {
          setDetailDialogOpen(open);
          if (!open) {
            setIsDataExpanded(false);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Task Detail</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="border-b pb-4 space-y-3 mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center justify-center rounded-md bg-secondary border border-border px-2 py-1 text-xs font-medium">
                    Order: {selectedTask.order}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${getStatusColor(
                      selectedTask.status
                    )}`}
                  >
                    {selectedTask.status}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {selectedTask.data?.task_description != null && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Task Description
                    </p>
                    <p className="text-sm bg-muted px-2 py-1 rounded whitespace-pre-wrap">
                      {typeof selectedTask.data.task_description === "string"
                        ? selectedTask.data.task_description
                        : JSON.stringify(selectedTask.data.task_description, null, 2)}
                    </p>
                  </div>
                )}

                {selectedTask.data?.progresses != null &&
                  Array.isArray(selectedTask.data.progresses) &&
                  selectedTask.data.progresses.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Progresses
                      </p>
                      <div className="space-y-1.5">
                        {selectedTask.data.progresses.map(
                          (progress: unknown, index: number) => (
                            <div
                              key={index}
                              className="text-sm bg-muted px-3 py-1.5 rounded border-l-2 border-primary/30"
                            >
                              {typeof progress === "string" ? progress : String(progress)}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                {selectedTask.data?.user_preferences != null &&
                  Array.isArray(selectedTask.data.user_preferences) &&
                  selectedTask.data.user_preferences.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        User Preferences
                      </p>
                      <div className="space-y-1">
                        {selectedTask.data.user_preferences.map(
                          (pref: unknown, index: number) => (
                            <div
                              key={index}
                              className="text-sm bg-muted px-3 py-2 rounded border-l-2 border-primary/20"
                            >
                              {typeof pref === "string" ? pref : String(pref)}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Created At
                    </p>
                    <p className="text-sm bg-muted px-2 py-1 rounded">
                      {new Date(selectedTask.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Updated At
                    </p>
                    <p className="text-sm bg-muted px-2 py-1 rounded">
                      {new Date(selectedTask.updated_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <button
                    onClick={() => setIsDataExpanded(!isDataExpanded)}
                    className="flex items-center gap-2 w-full text-left mb-3 hover:opacity-80 transition-opacity"
                  >
                    <p className="text-sm font-medium text-muted-foreground">
                      Task Data
                    </p>
                    {isDataExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {isDataExpanded && (
                    <div className="border rounded-md overflow-hidden">
                      <CodeEditor
                        value={JSON.stringify(selectedTask.data, null, 2)}
                        onChange={() => {}}
                        language="json"
                        height="400px"
                        readOnly={true}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="shrink-0">
            <Button
              variant="outline"
              onClick={() => {
                setDetailDialogOpen(false);
                setIsDataExpanded(false);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
