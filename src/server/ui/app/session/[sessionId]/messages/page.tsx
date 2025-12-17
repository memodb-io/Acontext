"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, RefreshCw, Upload, X, ArrowLeft, FileText, Image as ImageIcon, Video, Music, File, Code, CheckCircle2, ExternalLink } from "lucide-react";
import Image from "next/image";
import { getMessages, storeMessage, getSessionConfigs } from "@/api/models/space";
import {
  Message,
  MessageRole,
  PartType,
  UploadedFile,
  ToolCall,
  ToolResult,
} from "@/types";
import ReactCodeMirror from "@uiw/react-codemirror";
import { okaidia } from "@uiw/codemirror-theme-okaidia";
import { json } from "@codemirror/lang-json";
import { EditorView } from "@codemirror/view";
import {
  getAllowedPartTypes,
  generateTempId,
  buildMessageParts,
  buildFilesObject,
  hasMessageContent,
  filterFilesByRole,
} from "@/lib/message-utils";
import { Part } from "@/types";

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
            <div className="flex-shrink-0 mt-0.5">
              {part.type === "text" && <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
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
                <div className="text-sm text-foreground whitespace-pre-wrap break-words bg-muted/30 rounded">
                  {part.text}
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
                      <pre className="text-xs text-muted-foreground font-mono bg-muted/50 rounded p-1 overflow-x-auto whitespace-pre-wrap break-words">
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
                      <pre className="text-xs text-muted-foreground font-mono bg-muted/50 rounded p-1 overflow-x-auto whitespace-pre-wrap break-words">
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
                      <div className="w-16 h-16 rounded border overflow-hidden flex-shrink-0 bg-background relative">
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
                        <p className="text-xs font-medium break-words">{part.filename}</p>
                      )}
                      {part.asset && (
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground bg-background px-1.5 py-0.5 rounded">{part.asset.mime}</span>
                          <span className="text-xs text-muted-foreground">
                            {(part.asset.size_b / 1024).toFixed(1)} KB
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

export default function MessagesPage() {
  const t = useTranslations("space");
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const { resolvedTheme } = useTheme();

  const [sessionInfo, setSessionInfo] = useState<string>("");
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isRefreshingMessages, setIsRefreshingMessages] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newMessageRole, setNewMessageRole] = useState<MessageRole>("user");
  const [newMessageText, setNewMessageText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isStoringMessage, setIsStoringMessage] = useState(false);

  // Tool call/result specific states
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [toolResults, setToolResults] = useState<ToolResult[]>([]);

  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [messagePublicUrls, setMessagePublicUrls] = useState<
    Record<string, { url: string; expire_at: string }>
  >({});

  const totalPages = Math.ceil(allMessages.length / PAGE_SIZE);
  const paginatedMessages = allMessages.slice(
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

  const loadAllMessages = async () => {
    try {
      setIsLoadingMessages(true);
      const allMsgs: Message[] = [];
      const allPublicUrls: Record<string, { url: string; expire_at: string }> =
        {};
      let cursor: string | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        const res = await getMessages(sessionId, 50, cursor);
        if (res.code !== 0) {
          console.error(res.message);
          break;
        }
        allMsgs.push(...(res.data?.items || []));
        // Merge public_urls from each response
        if (res.data?.public_urls) {
          Object.assign(allPublicUrls, res.data.public_urls);
        }
        cursor = res.data?.next_cursor;
        hasMore = res.data?.has_more || false;
      }

      setAllMessages(allMsgs);
      setMessagePublicUrls(allPublicUrls);
      setCurrentPage(1);
    } catch (error) {
      console.error("Failed to load messages:", error);
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
    // Clear files that are not allowed for this role
    setUploadedFiles((prev) => filterFilesByRole(prev, role));
    // Clear tool calls when switching away from assistant
    if (role !== "assistant") {
      setToolCalls([]);
    }
    // Clear tool results when switching away from user
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

  const handleStoreMessage = async () => {
    if (!hasMessageContent(newMessageText, uploadedFiles, toolCalls, toolResults)) {
      return;
    }

    try {
      setIsStoringMessage(true);

      // Build parts array
      const parts = buildMessageParts(
        newMessageText,
        uploadedFiles,
        toolCalls,
        toolResults
      );

      // Build files object
      const files = buildFilesObject(uploadedFiles);

      // Store message
      const res = await storeMessage(
        sessionId,
        newMessageRole,
        parts,
        Object.keys(files).length > 0 ? files : undefined
      );

      if (res.code !== 0) {
        console.error(res.message);
        return;
      }

      await loadAllMessages();
      setCreateDialogOpen(false);
    } catch (error) {
      console.error("Failed to store message:", error);
    } finally {
      setIsStoringMessage(false);
    }
  };

  const handleGoBack = () => {
    router.push("/session");
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
            <h1 className="text-2xl font-bold">{t("messages")}</h1>
            <p className="text-sm text-muted-foreground">
              Session: <span className="font-mono">{sessionInfo}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleOpenCreateDialog}
              disabled={isLoadingMessages}
            >
              <Plus className="h-4 w-4" />
              {t("createMessage")}
            </Button>
            <Button
              variant="outline"
              onClick={handleRefreshMessages}
              disabled={isRefreshingMessages || isLoadingMessages}
            >
              {isRefreshingMessages ? (
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

        <div className="rounded-md border overflow-hidden flex flex-col">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : allMessages.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-sm text-muted-foreground">
                {t("noData")}
              </p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[400px]">
                        {t("content")}
                      </TableHead>
                      <TableHead className="w-[100px]">
                        {t("role")}
                      </TableHead>
                      <TableHead className="w-[120px]">
                        {t("status")}
                      </TableHead>
                      <TableHead className="w-[180px]">
                        {t("createdAt")}
                      </TableHead>
                      <TableHead className="w-[150px]">
                        {t("actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedMessages.map((message) => (
                      <TableRow key={message.id}>
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
                              onClick={() =>
                                handleOpenDetailDialog(message)
                              }
                            >
                              {t("view")}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!message.task_id}
                              onClick={() => {
                                if (message.task_id) {
                                  router.push(
                                    `/session/${sessionId}/task?taskId=${message.task_id}`
                                  );
                                }
                              }}
                              title={
                                message.task_id
                                  ? `${t("viewTask")} ${message.task_id.substring(0, 8)}...`
                                  : t("noTaskAssociated")
                              }
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              {t("task")}
                            </Button>
                          </div>
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
                            setCurrentPage((p) =>
                              Math.min(totalPages, p + 1)
                            )
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

      {/* Create Message Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t("createMessageTitle")}</DialogTitle>
            <DialogDescription>
              {t("createMessageDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("role")}</label>
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
              <label className="text-sm font-medium">{t("content")}</label>
              <textarea
                className="w-full h-40 p-2 text-sm border rounded-md"
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                placeholder={t("messageContentPlaceholder")}
              />
            </div>
            {/* File attachments */}
            <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t("attachFiles")}
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      document.getElementById("file-upload")?.click()
                    }
                    disabled={isStoringMessage}
                  >
                    <Upload className="h-4 w-4" />
                    {t("selectFiles")}
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
                              disabled={isStoringMessage}
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
                            disabled={isStoringMessage}
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
                    disabled={isStoringMessage}
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
                            disabled={isStoringMessage}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <input
                          type="text"
                          placeholder="Tool Name"
                          value={tc.name}
                          onChange={(e) =>
                            handleUpdateToolCall(
                              tc.id,
                              "name",
                              e.target.value
                            )
                          }
                          className="w-full px-2 py-1 text-sm border rounded"
                          disabled={isStoringMessage}
                        />
                        <input
                          type="text"
                          placeholder="Tool Call ID"
                          value={tc.call_id}
                          onChange={(e) =>
                            handleUpdateToolCall(
                              tc.id,
                              "call_id",
                              e.target.value
                            )
                          }
                          className="w-full px-2 py-1 text-sm border rounded"
                          disabled={isStoringMessage}
                        />
                        <div className="border rounded overflow-hidden">
                          <ReactCodeMirror
                            value={tc.parameters}
                            height="100px"
                            theme={resolvedTheme === "dark" ? okaidia : "light"}
                            extensions={[json(), EditorView.lineWrapping]}
                            onChange={(value) =>
                              handleUpdateToolCall(tc.id, "parameters", value)
                            }
                            editable={!isStoringMessage}
                            basicSetup={{
                              lineNumbers: true,
                              foldGutter: false,
                            }}
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
                    disabled={isStoringMessage}
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
                            disabled={isStoringMessage}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <input
                          type="text"
                          placeholder="Tool Call ID"
                          value={tr.tool_call_id}
                          onChange={(e) =>
                            handleUpdateToolResult(
                              tr.id,
                              "tool_call_id",
                              e.target.value
                            )
                          }
                          className="w-full px-2 py-1 text-sm border rounded"
                          disabled={isStoringMessage}
                        />
                        <div className="border rounded overflow-hidden">
                          <ReactCodeMirror
                            value={tr.result}
                            height="120px"
                            theme={resolvedTheme === "dark" ? okaidia : "light"}
                            extensions={[json(), EditorView.lineWrapping]}
                            onChange={(value) =>
                              handleUpdateToolResult(tr.id, "result", value)
                            }
                            editable={!isStoringMessage}
                            basicSetup={{
                              lineNumbers: true,
                              foldGutter: false,
                            }}
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
              disabled={isStoringMessage}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleStoreMessage}
              disabled={
                isStoringMessage ||
                !hasMessageContent(
                  newMessageText,
                  uploadedFiles,
                  toolCalls,
                  toolResults
                )
              }
            >
              {isStoringMessage ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("storing")}
                </>
              ) : (
                t("store")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t("messageDetail")}</DialogTitle>
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
                    {t("createdAt")}
                  </p>
                  <p className="text-sm bg-muted px-2 py-1 rounded">
                    {new Date(selectedMessage.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    {t("updatedAt")}
                  </p>
                  <p className="text-sm bg-muted px-2 py-1 rounded">
                    {new Date(selectedMessage.updated_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Message content */}
              <div className="border-t pt-6 mt-6">
                <p className="text-sm font-medium text-muted-foreground mb-3">
                  {t("content")}
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
                        {part.type !== "text" && part.type !== "tool-call" && part.type !== "tool-result" && (
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
                                    {t("mimeType")}
                                  </p>
                                  <p className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                    {part.asset.mime}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground mb-1">
                                    {t("size")}
                                  </p>
                                  <p className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                    {part.asset.size_b}
                                  </p>
                                </div>
                              </div>
                            )}
                            {/* Only show preview for images based on mimeType */}
                            {isImage && publicUrl && (
                              <div className="border-t pt-3">
                                <p className="text-sm font-medium text-muted-foreground mb-2">
                                  {t("preview")}
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

