"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, RefreshCw, CheckCircle2, XCircle, File, Copy } from "lucide-react";
import { PaginationBar } from "@/components/pagination-bar";
import { cn } from "@/lib/utils";
import { useTopNavStore } from "@/stores/top-nav";
import {
  Organization,
  Project,
  SandboxLog,
} from "@/types";
import { getSandboxLogs } from "./actions";
import { toast } from "sonner";
import { HistoryCommand, GeneratedFile } from "@/types";

const PAGE_SIZE = 20;

interface SandboxPageClientProps {
  project: Project;
  currentOrganization: Organization;
  allOrganizations: Organization[];
  projects: Project[];
}

export function SandboxPageClient({
  project,
  currentOrganization,
  allOrganizations,
  projects,
}: SandboxPageClientProps) {
  const { initialize, setHasSidebar } = useTopNavStore();

  // Sandbox related states
  const [sandboxes, setSandboxes] = useState<SandboxLog[]>([]);
  const [selectedSandbox, setSelectedSandbox] = useState<SandboxLog | null>(null);
  const [isLoadingSandboxes, setIsLoadingSandboxes] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Refresh states
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter state
  const [filterText, setFilterText] = useState("");

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

  // Filtered sandboxes based on search text
  const filteredSandboxes = sandboxes.filter((sandbox) =>
    sandbox.id.toLowerCase().includes(filterText.toLowerCase())
  );

  const totalPages = Math.ceil(filteredSandboxes.length / PAGE_SIZE);
  const paginatedSandboxes = filteredSandboxes.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Load all sandboxes
  const loadSandboxes = useCallback(async () => {
    try {
      setIsLoadingSandboxes(true);

      const first = await getSandboxLogs(project.id, 50, undefined, true);
      setSandboxes(first.items || []);
      setCurrentPage(1);
      setIsLoadingSandboxes(false);

      if (first.has_more) {
        setIsLoadingMore(true);
        let cursor = first.next_cursor;
        while (cursor) {
          const res = await getSandboxLogs(project.id, 50, cursor, true);
          setSandboxes(prev => [...prev, ...(res.items || [])]);
          cursor = res.has_more ? res.next_cursor : undefined;
        }
        setIsLoadingMore(false);
      }
    } catch (error) {
      console.error("Failed to load sandboxes:", error);
      toast.error("Failed to load sandboxes");
      setIsLoadingSandboxes(false);
      setIsLoadingMore(false);
    }
  }, [project.id]);

  // Refresh sandboxes
  const handleRefreshSandboxes = useCallback(async () => {
    try {
      setIsRefreshing(true);
      await loadSandboxes();
      toast.success("Sandboxes refreshed");
    } catch (error) {
      console.error("Failed to refresh sandboxes:", error);
      toast.error("Failed to refresh sandboxes");
    } finally {
      setIsRefreshing(false);
    }
  }, [loadSandboxes]);

  // Handle sandbox selection
  const handleSandboxSelect = (sandbox: SandboxLog) => {
    setSelectedSandbox(sandbox);
  };

  // Copy to clipboard helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  // Load sandbox list when component mounts
  useEffect(() => {
    loadSandboxes();
  }, [loadSandboxes]);

  return (
    <>
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Sandbox List Panel */}
        <ResizablePanel defaultSize={25} minSize={15} maxSize={35}>
          <div className="h-full bg-background p-4 flex flex-col">
            <div className="mb-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Sandboxes</h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleRefreshSandboxes}
                    disabled={isRefreshing || isLoadingSandboxes}
                    title="Refresh"
                  >
                    {isRefreshing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Input
                type="text"
                placeholder="Filter by ID..."
                value={filterText}
                onChange={(e) => {
                  setFilterText(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full"
              />
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              {isLoadingSandboxes ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Loading sandboxes...
                    </p>
                  </div>
                </div>
              ) : filteredSandboxes.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">
                    {sandboxes.length === 0 ? "No sandboxes" : "No matching sandboxes"}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2 overflow-auto flex-1">
                    {paginatedSandboxes.map((sandbox) => {
                      const isSelected = selectedSandbox?.id === sandbox.id;
                      return (
                        <div
                          key={sandbox.id}
                          className={cn(
                            "relative rounded-md border p-3 cursor-pointer transition-colors hover:bg-accent",
                            isSelected && "bg-accent border-primary"
                          )}
                          onClick={() => handleSandboxSelect(sandbox)}
                        >
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-sm font-medium truncate"
                              title={sandbox.id}
                            >
                              {sandbox.id}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                              <p className="text-xs text-muted-foreground">
                                {new Date(sandbox.created_at).toLocaleString()}
                              </p>
                              {sandbox.will_total_alive_seconds !== undefined && (
                                <p className="text-xs text-muted-foreground truncate ml-2">
                                  {sandbox.will_total_alive_seconds}s
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <PaginationBar
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={filteredSandboxes.length}
                    onPageChange={setCurrentPage}
                    itemLabel="sandboxes"
                    isLoading={isLoadingMore}
                  />
                </>
              )}
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />

        {/* Content Panel */}
        <ResizablePanel>
          <div className="h-full bg-background p-4 overflow-auto">
            <h2 className="mb-4 text-lg font-semibold">Content</h2>
            <div className="rounded-md border bg-card p-6">
              {selectedSandbox ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    {selectedSandbox.will_total_alive_seconds !== undefined && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">
                          Total Alive Seconds
                        </p>
                        <p className="text-sm font-mono bg-muted px-2 py-1 rounded">
                          {selectedSandbox.will_total_alive_seconds}
                        </p>
                      </div>
                    )}

                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Created At
                      </p>
                      <p className="text-sm bg-muted px-2 py-1 rounded">
                        {new Date(selectedSandbox.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {((selectedSandbox.history_commands && selectedSandbox.history_commands.length > 0) ||
                    (selectedSandbox.generated_files && selectedSandbox.generated_files.length > 0)) && (
                    <div className="border-t pt-4">
                      <Tabs defaultValue="commands" className="w-full">
                        <TabsList>
                          <TabsTrigger value="commands">
                            History Commands
                          </TabsTrigger>
                          <TabsTrigger value="files">
                            Generated Files
                          </TabsTrigger>
                        </TabsList>
                        <TabsContent value="commands" className="mt-4">
                          {selectedSandbox.history_commands && selectedSandbox.history_commands.length > 0 ? (
                            <div className="space-y-2">
                              {selectedSandbox.history_commands.map((cmd: HistoryCommand, index: number) => {
                                const isSuccess = cmd.exit_code === 0;
                                return (
                                  <div
                                    key={index}
                                    className={cn(
                                      "rounded-md border p-3 bg-card",
                                      isSuccess ? "border-green-500/20" : "border-red-500/20"
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                          {isSuccess ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                                          ) : (
                                            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                                          )}
                                          <span className="text-xs font-medium text-muted-foreground">
                                            Command #{index + 1}
                                          </span>
                                          <span
                                            className={cn(
                                              "text-xs px-2 py-0.5 rounded",
                                              isSuccess
                                                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                                : "bg-red-500/10 text-red-600 dark:text-red-400"
                                            )}
                                          >
                                            Exit Code: {cmd.exit_code}
                                          </span>
                                        </div>
                                        <div className="bg-muted rounded-md p-2 font-mono text-sm">
                                          <code className="whitespace-pre-wrap wrap-break-word">{cmd.command}</code>
                                        </div>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 shrink-0"
                                        onClick={() => copyToClipboard(cmd.command, "Command")}
                                        title="Copy command"
                                      >
                                        <Copy className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No history commands available.
                            </p>
                          )}
                        </TabsContent>
                        <TabsContent value="files" className="mt-4">
                          {selectedSandbox.generated_files && selectedSandbox.generated_files.length > 0 ? (
                            <div className="space-y-2">
                              {selectedSandbox.generated_files.map((file: GeneratedFile, index: number) => (
                                <div
                                  key={index}
                                  className="rounded-md border p-3 bg-card hover:bg-accent/50 transition-colors"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <File className="h-4 w-4 text-muted-foreground shrink-0" />
                                      <span className="text-sm font-mono text-foreground truncate" title={file.sandbox_path}>
                                        {file.sandbox_path}
                                      </span>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 shrink-0"
                                      onClick={() => copyToClipboard(file.sandbox_path, "File path")}
                                      title="Copy file path"
                                    >
                                      <Copy className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No generated files available.
                            </p>
                          )}
                        </TabsContent>
                      </Tabs>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a sandbox to view details
                </p>
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </>
  );
}
