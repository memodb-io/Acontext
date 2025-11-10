"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Loader2, RefreshCw, ArrowLeft } from "lucide-react";
import { getTasks, getSessionConfigs } from "@/api/models/space";
import { Task } from "@/types";
import ReactCodeMirror from "@uiw/react-codemirror";
import { okaidia } from "@uiw/codemirror-theme-okaidia";
import { json } from "@codemirror/lang-json";
import { EditorView } from "@codemirror/view";

const PAGE_SIZE = 10;

export default function TasksPage() {
  const t = useTranslations("space");
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId as string;
  const { resolvedTheme } = useTheme();

  const [sessionInfo, setSessionInfo] = useState<string>("");
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isRefreshingTasks, setIsRefreshingTasks] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const totalPages = Math.ceil(allTasks.length / PAGE_SIZE);
  const paginatedTasks = allTasks.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const loadSessionInfo = async () => {
    try {
      const res = await getSessionConfigs(sessionId);
      if (res.code === 0 && res.data) {
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
        const res = await getTasks(sessionId, 50, cursor);
        if (res.code !== 0) {
          console.error(res.message);
          break;
        }
        allTsks.push(...(res.data?.items || []));
        cursor = res.data?.next_cursor;
        hasMore = res.data?.has_more || false;
      }

      setAllTasks(allTsks);
      setCurrentPage(1);
    } catch (error) {
      console.error("Failed to load tasks:", error);
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

  // Handle opening task dialog from URL parameter
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
    router.push("/session");
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
    <div className="h-full bg-background p-6">
      <div className="space-y-4">
        <div className="flex items-stretch gap-2">
          <Button
            variant="outline"
            onClick={handleGoBack}
            className="rounded-l-md rounded-r-none h-auto px-3"
            title={t("backToSessions") || "Back to Sessions"}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{t("tasks") || "Tasks"}</h1>
            <p className="text-sm text-muted-foreground">
              Session: <span className="font-mono">{sessionInfo}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRefreshTasks}
              disabled={isRefreshingTasks || isLoadingTasks}
            >
              {isRefreshingTasks ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t("loading")}
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t("refresh")}
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="rounded-md border overflow-hidden flex flex-col">
          {isLoadingTasks ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : allTasks.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-sm text-muted-foreground">{t("noData")}</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">
                        {t("taskId") || "Task ID"}
                      </TableHead>
                      <TableHead className="w-[80px]">
                        {t("order") || "Order"}
                      </TableHead>
                      <TableHead className="w-[100px]">
                        {t("status")}
                      </TableHead>
                      <TableHead className="w-[100px]">
                        {t("isPlanning") || "Planning"}
                      </TableHead>
                      <TableHead className="w-[180px]">
                        {t("createdAt")}
                      </TableHead>
                      <TableHead className="w-[100px]">
                        {t("actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-mono text-xs">
                          {task.id}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center justify-center rounded-md bg-secondary px-2 py-1 text-xs font-medium">
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
                        <TableCell>
                          {task.is_planning ? (
                            <span className="inline-flex items-center rounded-md bg-purple-500/10 text-purple-500 border border-purple-500/20 px-2 py-1 text-xs font-medium">
                              Yes
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              No
                            </span>
                          )}
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
                            {t("view")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="border-t p-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() =>
                            setCurrentPage((p) => Math.max(1, p - 1))
                          }
                          className={
                            currentPage === 1
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(
                          (page) =>
                            page === 1 ||
                            page === totalPages ||
                            Math.abs(page - currentPage) <= 1
                        )
                        .map((page, idx, arr) => {
                          const showEllipsisBefore =
                            idx > 0 && page - arr[idx - 1] > 1;
                          return (
                            <div key={page} className="flex items-center">
                              {showEllipsisBefore && (
                                <span className="px-2">...</span>
                              )}
                              <PaginationItem>
                                <PaginationLink
                                  onClick={() => setCurrentPage(page)}
                                  isActive={currentPage === page}
                                  className="cursor-pointer"
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            </div>
                          );
                        })}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() =>
                            setCurrentPage((p) => Math.min(totalPages, p + 1))
                          }
                          className={
                            currentPage === totalPages
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Task Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t("taskDetail") || "Task Detail"}</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="rounded-md border bg-card p-6 overflow-y-auto flex-1">
              {/* Task header */}
              <div className="border-b pb-4">
                <h3 className="text-xl font-semibold mb-2 font-mono">
                  {selectedTask.id}
                </h3>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${getStatusColor(
                      selectedTask.status
                    )}`}
                  >
                    {selectedTask.status}
                  </span>
                  {selectedTask.is_planning && (
                    <span className="inline-flex items-center rounded-md bg-purple-500/10 text-purple-500 border border-purple-500/20 px-2 py-1 text-xs font-medium">
                      Planning
                    </span>
                  )}
                  {selectedTask.space_digested && (
                    <span className="inline-flex items-center rounded-md bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-1 text-xs font-medium">
                      Space Digested
                    </span>
                  )}
                </div>
              </div>

              {/* Task details in grid */}
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    {t("sessionId") || "Session ID"}
                  </p>
                  <p className="text-sm bg-muted px-2 py-1 rounded font-mono">
                    {selectedTask.session_id}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    {t("projectId") || "Project ID"}
                  </p>
                  <p className="text-sm bg-muted px-2 py-1 rounded font-mono">
                    {selectedTask.project_id}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    {t("order") || "Order"}
                  </p>
                  <p className="text-sm bg-muted px-2 py-1 rounded">
                    {selectedTask.order}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    {t("createdAt")}
                  </p>
                  <p className="text-sm bg-muted px-2 py-1 rounded">
                    {new Date(selectedTask.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    {t("updatedAt")}
                  </p>
                  <p className="text-sm bg-muted px-2 py-1 rounded">
                    {new Date(selectedTask.updated_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Task data */}
              <div className="border-t pt-6 mt-6">
                <p className="text-sm font-medium text-muted-foreground mb-3">
                  {t("taskData") || "Task Data"}
                </p>
                <div className="border rounded-md overflow-hidden">
                  <ReactCodeMirror
                    value={JSON.stringify(selectedTask.data, null, 2)}
                    height="400px"
                    theme={resolvedTheme === "dark" ? okaidia : "light"}
                    extensions={[json(), EditorView.lineWrapping]}
                    editable={false}
                    basicSetup={{
                      lineNumbers: true,
                      foldGutter: true,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDetailDialogOpen(false)}
            >
              {t("close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

