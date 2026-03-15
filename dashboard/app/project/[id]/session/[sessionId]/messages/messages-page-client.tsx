"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { encodeId } from "@/lib/id-codec";
import { useTopNavStore } from "@/stores/top-nav";
import Image from "next/image";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  Plus,
  RefreshCw,
  ArrowLeft,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  File,
  Code,
  CheckCircle2,
  Upload,
  X,
  Brain,
  ShieldOff,
  HardDrive,
  StickyNote,
  Flag,
  Download,
} from "lucide-react";
import { Project, Message, SessionEvent, TimelineItem, Part } from "@/types";
import { getMessages, sendMessage, getSessionConfigs, downloadMessages } from "../../actions";
import { toast } from "sonner";
import {
  generateTempId,
  buildMessageParts,
  buildFilesObject,
  hasMessageContent,
  filterFilesByRole,
  getAllowedPartTypes,
} from "@/lib/message-utils";
import { CodeEditor } from "@/components/code-editor";
import type { MessageRole, PartType, UploadedFile, ToolCall, ToolResult } from "@/types";
import { formatBytes } from "@/lib/utils";

interface MessagesPageClientProps {
  project: Project;
  sessionId: string;
}

const PAGE_SIZE = 10;

// Component to render message content parts in table
const MessageContentPreview = ({
  parts,
  messagePublicUrls
}: {
  parts: Part[];
  messagePublicUrls: Record<string, { url: string; expire_at: string }>;
}) => {
  if (parts.length === 0) {
    return <span className="text-xs text-muted-foreground italic">No content</span>;
  }

  return (
    <div className="space-y-2.5 py-1 max-h-[300px] overflow-y-auto">
      {parts.map((part, idx) => {
        const assetKey = part.asset ? part.asset.sha256 : null;
        const publicUrl = assetKey ? messagePublicUrls[assetKey]?.url : null;
        const isImage = part.asset?.mime?.startsWith("image/");

        return (
          <div key={idx} className="flex items-start gap-2 text-xs">
            {/* Part type icon */}
            <div className="shrink-0 mt-0.5">
              {part.type === "text" && <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
              {part.type === "thinking" && <Brain className="h-3.5 w-3.5 text-amber-500" />}
              {part.type === "redacted_thinking" && <ShieldOff className="h-3.5 w-3.5 text-amber-400" />}
              {part.type === "tool-call" && <Code className="h-3.5 w-3.5 text-blue-500" />}
              {part.type === "tool-result" && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
              {part.type === "image" && <ImageIcon className="h-3.5 w-3.5 text-purple-500" />}
              {part.type === "video" && <Video className="h-3.5 w-3.5 text-red-500" />}
              {part.type === "audio" && <Music className="h-3.5 w-3.5 text-orange-500" />}
              {(part.type === "file" || part.type === "data") && <File className="h-3.5 w-3.5 text-gray-500" />}
            </div>

            {/* Part content */}
            <div className="flex-1 min-w-0 space-y-1">
              {part.type === "text" && part.text && (
                <div className="text-sm text-foreground whitespace-pre-wrap wrap-break-word bg-muted/30 rounded">
                  {part.text}
                </div>
              )}

              {part.type === "thinking" && part.text && (
                <div className="text-sm text-foreground whitespace-pre-wrap wrap-break-word bg-amber-50 dark:bg-amber-950/20 rounded px-2 py-1.5 border border-amber-200 dark:border-amber-900 italic">
                  {part.text}
                </div>
              )}

              {part.type === "redacted_thinking" && (
                <div className="text-sm text-muted-foreground italic bg-amber-50/50 dark:bg-amber-950/10 rounded px-2 py-1.5 border border-amber-200/50 dark:border-amber-900/50">
                  [Redacted thinking]
                </div>
              )}

              {part.type === "tool-call" && part.meta && (
                <div className="space-y-1.5 bg-blue-50 dark:bg-blue-950/20 rounded px-2 py-1.5 border border-blue-200 dark:border-blue-900">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Tool Call:</span>
                    <span className="text-xs font-mono text-blue-600 dark:text-blue-400 font-medium">
                      {part.meta.name as string || "unknown"}
                    </span>
                  </div>
                  {part.meta.id != null && (
                    <p className="text-xs text-muted-foreground font-mono">
                      <span className="text-blue-600 dark:text-blue-400">ID:</span> {String(part.meta.id)}
                    </p>
                  )}
                  {part.meta.arguments != null && (
                    <div className="mt-1">
                      <p className="text-xs text-muted-foreground mb-0.5 font-medium">Parameters:</p>
                      <pre className="text-xs text-muted-foreground font-mono bg-muted/50 rounded p-1 overflow-x-auto whitespace-pre-wrap wrap-break-word">
                        {typeof part.meta.arguments === 'string'
                          ? part.meta.arguments
                          : JSON.stringify(part.meta.arguments, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {part.type === "tool-result" && (
                <div className="space-y-1.5 bg-green-50 dark:bg-green-950/20 rounded px-2 py-1.5 border border-green-200 dark:border-green-900">
                  {part.meta?.tool_call_id != null && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-green-700 dark:text-green-300">Tool Result:</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {String(part.meta.tool_call_id)}
                      </span>
                    </div>
                  )}
                  {(part.text || (part.meta?.result != null)) && (
                    <div className="mt-1">
                      <pre className="text-xs text-muted-foreground font-mono bg-muted/50 rounded p-1 overflow-x-auto whitespace-pre-wrap wrap-break-word">
                        {part.text || (typeof part.meta?.result === "string"
                          ? String(part.meta.result)
                          : JSON.stringify(part.meta?.result || {}, null, 2))}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {(part.type === "image" || part.type === "video" || part.type === "audio" || part.type === "file" || part.type === "data") && (
                <div className="space-y-1 bg-muted/30 rounded px-2 py-1.5">
                  <div className="flex items-start gap-2">
                    {isImage && publicUrl && (
                      <div className="w-16 h-16 rounded border overflow-hidden shrink-0 bg-background relative">
                        <Image
                          src={publicUrl}
                          alt={part.filename || "image"}
                          fill
                          className="object-cover"
                          sizes="64px"
                          unoptimized
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {part.filename && (
                        <p className="text-xs font-medium wrap-break-word">{part.filename}</p>
                      )}
                      {part.asset && (
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground bg-background px-1.5 py-0.5 rounded">{part.asset.mime}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatBytes(part.asset.size_b)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export function MessagesPageClient({
  project,
  sessionId,
}: MessagesPageClientProps) {
  const router = useRouter();
  const { initialize, setHasSidebar } = useTopNavStore();

  useEffect(() => {
    initialize({ hasSidebar: true });
    return () => {
      setHasSidebar(false);
    };
  }, [initialize, setHasSidebar]);

  const [sessionInfo, setSessionInfo] = useState<string>("");
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [allEvents, setAllEvents] = useState<SessionEvent[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isRefreshingMessages, setIsRefreshingMessages] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newMessageRole, setNewMessageRole] = useState<MessageRole>("user");
  const [newMessageText, setNewMessageText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [toolResults, setToolResults] = useState<ToolResult[]>([]);

  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [messagePublicUrls, setMessagePublicUrls] = useState<
    Record<string, { url: string; expire_at: string }>
  >({});

  const timelineItems: TimelineItem[] = [
    ...allMessages.map((m): TimelineItem => ({ kind: 'message', data: m })),
    ...allEvents.map((e): TimelineItem => ({ kind: 'event', data: e })),
  ].sort((a, b) => new Date(a.data.created_at).getTime() - new Date(b.data.created_at).getTime());

  const totalPages = Math.ceil(timelineItems.length / PAGE_SIZE);
  const paginatedItems = timelineItems.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const paginatedMessages = paginatedItems
    .filter((item): item is { kind: 'message'; data: Message } => item.kind === 'message')
    .map(item => item.data);

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

  const loadAllMessages = async () => {
    try {
      setIsLoadingMessages(true);
      const allMsgs: Message[] = [];
      const allEvts: SessionEvent[] = [];
      const allPublicUrls: Record<string, { url: string; expire_at: string }> = {};
      let cursor: string | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        const res = await getMessages(project.id, sessionId, 50, cursor);
        allMsgs.push(...(res.items || []));
        if (res.events) {
          allEvts.push(...res.events);
        }
        if (res.public_urls) {
          Object.assign(allPublicUrls, res.public_urls);
        }
        cursor = res.next_cursor;
        hasMore = res.has_more || false;
      }

      setAllMessages(allMsgs);
      const seenIds = new Set<string>();
      const dedupedEvts = allEvts.filter((e) => {
        if (seenIds.has(e.id)) return false;
        seenIds.add(e.id);
        return true;
      });
      setAllEvents(dedupedEvts);
      setMessagePublicUrls(allPublicUrls);
      setCurrentPage(1);
    } catch (error) {
      console.error("Failed to load messages:", error);
      toast.error("Failed to load messages");
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleRefreshMessages = async () => {
    setIsRefreshingMessages(true);
    await loadAllMessages();
    setIsRefreshingMessages(false);
  };

  useEffect(() => {
    if (sessionId) {
      loadSessionInfo();
      loadAllMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const handleOpenCreateDialog = () => {
    setNewMessageRole("user");
    setNewMessageText("");
    setUploadedFiles([]);
    setToolCalls([]);
    setToolResults([]);
    setCreateDialogOpen(true);
  };

  const handleRoleChange = (role: MessageRole) => {
    setNewMessageRole(role);
    setUploadedFiles((prev) => filterFilesByRole(prev, role));
    if (role !== "assistant") {
      setToolCalls([]);
    }
    if (role !== "user") {
      setToolResults([]);
    }
  };

  const handleOpenDetailDialog = (message: Message) => {
    setSelectedMessage(message);
    setDetailDialogOpen(true);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newFiles: UploadedFile[] = Array.from(files).map((file) => ({
      id: generateTempId("file"),
      file,
      type: "file",
    }));

    setUploadedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleFileTypeChange = (fileId: string, newType: PartType) => {
    setUploadedFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, type: newType } : f))
    );
  };

  const handleRemoveFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleAddToolCall = () => {
    setToolCalls((prev) => [
      ...prev,
      {
        id: generateTempId("tool_call"),
        name: "",
        call_id: "",
        parameters: "{}",
      },
    ]);
  };

  const handleUpdateToolCall = (
    id: string,
    field: "name" | "call_id" | "parameters",
    value: string
  ) => {
    setToolCalls((prev) =>
      prev.map((tc) => (tc.id === id ? { ...tc, [field]: value } : tc))
    );
  };

  const handleRemoveToolCall = (id: string) => {
    setToolCalls((prev) => prev.filter((tc) => tc.id !== id));
  };

  const handleAddToolResult = () => {
    setToolResults((prev) => [
      ...prev,
      {
        id: generateTempId("tool_result"),
        tool_call_id: "",
        result: "",
      },
    ]);
  };

  const handleUpdateToolResult = (
    id: string,
    field: "tool_call_id" | "result",
    value: string
  ) => {
    setToolResults((prev) =>
      prev.map((tr) => (tr.id === id ? { ...tr, [field]: value } : tr))
    );
  };

  const handleRemoveToolResult = (id: string) => {
    setToolResults((prev) => prev.filter((tr) => tr.id !== id));
  };

  const handleSendMessage = async () => {
    if (!hasMessageContent(newMessageText, uploadedFiles, toolCalls, toolResults)) {
      return;
    }

    try {
      setIsSendingMessage(true);

      const parts = buildMessageParts(
        newMessageText,
        uploadedFiles,
        toolCalls,
        toolResults
      );

      const files = buildFilesObject(uploadedFiles);

      await sendMessage(
        project.id,
        sessionId,
        newMessageRole,
        parts,
        Object.keys(files).length > 0 ? files : undefined
      );

      await loadAllMessages();
      setCreateDialogOpen(false);
      toast.success("Message sent successfully");
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSendingMessage(false);
    }
  };

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async (format: "acontext" | "openai" | "anthropic" | "gemini") => {
    setIsDownloading(true);
    try {
      const data = await downloadMessages(project.id, sessionId, format);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `messages-${sessionId}-${format}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded messages in ${format} format`);
    } catch (error) {
      console.error("Failed to download messages:", error);
      toast.error("Failed to download messages");
    } finally {
      setIsDownloading(false);
    }
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

  return (
    <div className="bg-background p-6">
      <div className="space-y-4">
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
              <h1 className="text-2xl font-bold">Messages</h1>
              <p className="text-sm text-muted-foreground">
                Session: <span className="font-mono">{sessionInfo}</span>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleOpenCreateDialog}
              disabled={isLoadingMessages}
            >
              <Plus className="h-4 w-4" />
              Create Message
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  disabled={isLoadingMessages || isDownloading || allMessages.length === 0}
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Download
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleDownload("openai")}>
                  OpenAI
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload("anthropic")}>
                  Anthropic
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload("gemini")}>
                  Gemini
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload("acontext")}>
                  Acontext
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              onClick={handleRefreshMessages}
              disabled={isRefreshingMessages || isLoadingMessages}
            >
              {isRefreshingMessages ? (
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

        <div className="rounded-md border overflow-hidden flex flex-col">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : allMessages.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-sm text-muted-foreground">No data</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[400px]">Content</TableHead>
                      <TableHead className="w-[100px]">Role</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                      <TableHead className="w-[180px]">Created At</TableHead>
                      <TableHead className="w-[150px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.map((item) => {
                      if (item.kind === 'event') {
                        const event = item.data;
                        const EventIcon = event.type === 'disk_event' ? HardDrive
                          : event.type === 'text_event' ? StickyNote
                          : Flag;
                        return (
                          <TableRow key={`event-${event.id}`} className="border-dashed bg-muted/30">
                            <TableCell className="max-w-[400px]">
                              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                                <EventIcon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <span className="font-medium">{event.type}</span>
                                  {event.type === 'text_event' && typeof event.data.text === 'string' ? (
                                    <p className="mt-0.5 text-sm text-foreground whitespace-pre-wrap break-words">{event.data.text}</p>
                                  ) : event.type === 'disk_event' ? (
                                    <div className="mt-0.5 space-y-0.5">
                                      {typeof event.data.path === 'string' && (
                                        <p className="text-sm font-mono text-foreground truncate">{event.data.path}</p>
                                      )}
                                      {typeof event.data.note === 'string' && (
                                        <p className="text-xs text-muted-foreground italic">{event.data.note}</p>
                                      )}
                                    </div>
                                  ) : (
                                    <pre className="mt-0.5 text-xs font-mono bg-muted/50 rounded px-1.5 py-1 whitespace-pre-wrap break-all">
                                      {JSON.stringify(event.data, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                                event
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground">—</span>
                            </TableCell>
                            <TableCell className="text-xs">
                              {new Date(event.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              {event.type === 'disk_event' && typeof event.data.disk_id === 'string' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const encodedProjectId = encodeId(project.id);
                                    router.push(`/project/${encodedProjectId}/disk?diskId=${event.data.disk_id}`);
                                  }}
                                >
                                  <HardDrive className="h-3.5 w-3.5" />
                                  Disk
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      }
                      const message = item.data;
                      return (
                        <TableRow key={`msg-${message.id}`}>
                          <TableCell className="max-w-[400px]">
                            <MessageContentPreview
                              parts={message.parts}
                              messagePublicUrls={messagePublicUrls}
                            />
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                              {message.role}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium">
                              {message.session_task_process_status}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">
                            {new Date(message.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleOpenDetailDialog(message)}
                              >
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!message.task_id}
                                onClick={() => {
                                  if (message.task_id) {
                                    const encodedProjectId = encodeId(project.id);
                                    const encodedSessionId = encodeId(sessionId);
                                    const messagesReturnTo = `/project/${encodedProjectId}/session/${encodedSessionId}/messages`;
                                    router.push(
                                      `/project/${encodedProjectId}/session/${encodedSessionId}/task?taskId=${message.task_id}&returnTo=${encodeURIComponent(messagesReturnTo)}`
                                    );
                                  }
                                }}
                                title={
                                  message.task_id
                                    ? `View Task ${message.task_id.substring(0, 8)}...`
                                    : "No task associated"
                                }
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Task
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="border-t p-4">
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
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
                              <span className="px-2 text-sm text-muted-foreground">...</span>
                            )}
                            <Button
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                              className="min-w-10"
                            >
                              {page}
                            </Button>
                          </div>
                        );
                      })}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create Message Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Create Message</DialogTitle>
            <DialogDescription>Create a new message for this session.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <Select
                value={newMessageRole}
                onValueChange={(value) => handleRoleChange(value as MessageRole)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">user</SelectItem>
                  <SelectItem value="assistant">assistant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Content</label>
              <textarea
                className="w-full h-40 p-2 text-sm border rounded-md"
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                placeholder="Enter message content"
                disabled={isSendingMessage}
              />
            </div>
            {/* File attachments */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Attach Files</label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("file-upload")?.click()}
                  disabled={isSendingMessage}
                >
                  <Upload className="h-4 w-4" />
                  Select Files
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
              {uploadedFiles.length > 0 && (
                <div className="mt-2 space-y-3">
                  {uploadedFiles.map((fileItem) => {
                    const allowedTypes = getAllowedPartTypes(newMessageRole);
                    return (
                      <div
                        key={fileItem.id}
                        className="flex items-start gap-2 p-3 border rounded-md bg-secondary/20"
                      >
                        <div className="flex-1 min-w-0 space-y-2">
                          <span
                            className="text-sm font-medium truncate block"
                            title={fileItem.file.name}
                          >
                            {fileItem.file.name}
                          </span>
                          <Select
                            value={fileItem.type}
                            onValueChange={(value) =>
                              handleFileTypeChange(fileItem.id, value as PartType)
                            }
                            disabled={isSendingMessage}
                          >
                            <SelectTrigger className="w-full h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {allowedTypes.includes("text") && (
                                <SelectItem value="text">text</SelectItem>
                              )}
                              {allowedTypes.includes("image") && (
                                <SelectItem value="image">image</SelectItem>
                              )}
                              {allowedTypes.includes("audio") && (
                                <SelectItem value="audio">audio</SelectItem>
                              )}
                              {allowedTypes.includes("video") && (
                                <SelectItem value="video">video</SelectItem>
                              )}
                              {allowedTypes.includes("file") && (
                                <SelectItem value="file">file</SelectItem>
                              )}
                              {allowedTypes.includes("data") && (
                                <SelectItem value="data">data</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => handleRemoveFile(fileItem.id)}
                          disabled={isSendingMessage}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tool Calls - only for assistant role */}
            {newMessageRole === "assistant" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Tool Calls</label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddToolCall}
                    disabled={isSendingMessage}
                  >
                    <Plus className="h-4 w-4" />
                    Add Tool Call
                  </Button>
                </div>
                {toolCalls.length > 0 && (
                  <div className="space-y-3">
                    {toolCalls.map((tc) => (
                      <div
                        key={tc.id}
                        className="p-3 border rounded-md bg-secondary/20 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">
                            Tool Call
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleRemoveToolCall(tc.id)}
                            disabled={isSendingMessage}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <input
                          type="text"
                          placeholder="Tool Name"
                          value={tc.name}
                          onChange={(e) =>
                            handleUpdateToolCall(tc.id, "name", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border rounded"
                          disabled={isSendingMessage}
                        />
                        <input
                          type="text"
                          placeholder="Tool Call ID"
                          value={tc.call_id}
                          onChange={(e) =>
                            handleUpdateToolCall(tc.id, "call_id", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border rounded"
                          disabled={isSendingMessage}
                        />
                        <div className="border rounded overflow-hidden">
                          <CodeEditor
                            value={tc.parameters}
                            height="100px"
                            language="json"
                            onChange={(value) =>
                              handleUpdateToolCall(tc.id, "parameters", value)
                            }
                            readOnly={isSendingMessage}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tool Results - only for user role */}
            {newMessageRole === "user" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Tool Results</label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddToolResult}
                    disabled={isSendingMessage}
                  >
                    <Plus className="h-4 w-4" />
                    Add Tool Result
                  </Button>
                </div>
                {toolResults.length > 0 && (
                  <div className="space-y-3">
                    {toolResults.map((tr) => (
                      <div
                        key={tr.id}
                        className="p-3 border rounded-md bg-secondary/20 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">
                            Tool Result
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleRemoveToolResult(tr.id)}
                            disabled={isSendingMessage}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <input
                          type="text"
                          placeholder="Tool Call ID"
                          value={tr.tool_call_id}
                          onChange={(e) =>
                            handleUpdateToolResult(tr.id, "tool_call_id", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border rounded"
                          disabled={isSendingMessage}
                        />
                        <div className="border rounded overflow-hidden">
                          <CodeEditor
                            value={tr.result}
                            height="120px"
                            language="json"
                            onChange={(value) =>
                              handleUpdateToolResult(tr.id, "result", value)
                            }
                            readOnly={isSendingMessage}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={isSendingMessage}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={
                isSendingMessage ||
                !hasMessageContent(newMessageText, uploadedFiles, toolCalls, toolResults)
              }
            >
              {isSendingMessage ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending
                </>
              ) : (
                "Send"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Message Detail</DialogTitle>
          </DialogHeader>
          {selectedMessage && (
            <div className="rounded-md border bg-card p-6 overflow-y-auto flex-1">
              {/* Message header */}
              <div className="border-b pb-4">
                <h3 className="text-xl font-semibold mb-2">
                  {selectedMessage.id}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                    {selectedMessage.role}
                  </span>
                  <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium">
                    {selectedMessage.session_task_process_status}
                  </span>
                </div>
              </div>

              {/* Message details in grid */}
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Created At
                  </p>
                  <p className="text-sm bg-muted px-2 py-1 rounded">
                    {new Date(selectedMessage.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Updated At
                  </p>
                  <p className="text-sm bg-muted px-2 py-1 rounded">
                    {new Date(selectedMessage.updated_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Message content */}
              <div className="border-t pt-6 mt-6">
                <p className="text-sm font-medium text-muted-foreground mb-3">
                  Content
                </p>
                <div className="space-y-6">
                  {selectedMessage.parts.map((part, idx) => {
                    // Generate asset key for public_urls lookup
                    const assetKey = part.asset ? part.asset.sha256 : null;
                    const publicUrl = assetKey
                      ? messagePublicUrls[assetKey]?.url
                      : null;
                    const isImage = part.asset?.mime?.startsWith("image/");

                    return (
                      <div
                        key={idx}
                        className="border rounded-md p-4 bg-muted/50"
                      >
                        {part.type === "text" && (
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-muted-foreground uppercase">
                              Text
                            </div>
                            <p className="text-sm whitespace-pre-wrap">
                              {part.text}
                            </p>
                          </div>
                        )}
                        {part.type === "thinking" && (
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase">
                              Thinking
                            </div>
                            <p className="text-sm whitespace-pre-wrap italic text-muted-foreground bg-amber-50 dark:bg-amber-950/20 rounded px-2 py-1.5 border border-amber-200 dark:border-amber-900">
                              {part.text}
                            </p>
                          </div>
                        )}
                        {part.type === "tool-call" && part.meta && (
                          <div className="space-y-3">
                            <div className="text-xs font-medium text-muted-foreground uppercase">
                              Tool Call
                            </div>
                            <div className="space-y-2">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">
                                  Tool Name
                                </p>
                                <p className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                  {part.meta.name as string}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">
                                  Tool Call ID
                                </p>
                                <p className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                  {part.meta.id as string}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">
                                  Parameters
                                </p>
                                <pre className="text-sm font-mono bg-muted px-2 py-1 rounded overflow-x-auto">
                                  {typeof part.meta.arguments === 'string'
                                    ? part.meta.arguments
                                    : JSON.stringify(part.meta.arguments, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </div>
                        )}
                        {part.type === "tool-result" && part.meta && (
                          <div className="space-y-3">
                            <div className="text-xs font-medium text-muted-foreground uppercase">
                              Tool Result
                            </div>
                            <div className="space-y-2">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">
                                  Tool Call ID
                                </p>
                                <p className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                  {part.meta.tool_call_id as string}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">
                                  Result
                                </p>
                                <pre className="text-sm font-mono bg-muted px-2 py-1 rounded overflow-x-auto whitespace-pre-wrap">
                                  {part.text || (typeof part.meta.result === "string"
                                    ? part.meta.result
                                    : JSON.stringify(part.meta.result, null, 2))}
                                </pre>
                              </div>
                            </div>
                          </div>
                        )}
                        {part.type !== "text" && part.type !== "thinking" && part.type !== "tool-call" && part.type !== "tool-result" && (
                          <div className="space-y-3">
                            <div className="text-xs font-medium text-muted-foreground uppercase">
                              {part.type}
                            </div>
                            {part.filename && (
                              <p className="text-sm font-semibold">
                                {part.filename}
                              </p>
                            )}
                            {part.asset && (
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground mb-1">
                                    MIME Type
                                  </p>
                                  <p className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                    {part.asset.mime}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground mb-1">
                                    Size
                                  </p>
                                  <p className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                    {formatBytes(part.asset.size_b)}
                                  </p>
                                </div>
                              </div>
                            )}
                            {/* Only show preview for images based on mimeType */}
                            {isImage && publicUrl && (
                              <div className="border-t pt-3">
                                <p className="text-sm font-medium text-muted-foreground mb-2">
                                  Preview
                                </p>
                                <div className="rounded-md border bg-muted p-4">
                                  <div className="relative w-full min-h-[200px]">
                                    <Image
                                      src={publicUrl}
                                      alt={part.filename || "image"}
                                      width={800}
                                      height={600}
                                      className="max-w-full h-auto rounded-md shadow-sm"
                                      style={{ objectFit: "contain" }}
                                      unoptimized
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
