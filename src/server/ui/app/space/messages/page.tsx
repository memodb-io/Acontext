"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Loader2, Plus, RefreshCw, Upload, X } from "lucide-react";
import Image from "next/image";
import {
  getSessions,
  getMessages,
  sendMessage,
  MessagePartIn,
} from "@/api/models/space";
import { Session, Message } from "@/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

export default function MessagesPage() {
  const t = useTranslations("space");

  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isRefreshingSessions, setIsRefreshingSessions] = useState(false);
  const [sessionFilterText, setSessionFilterText] = useState("");

  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isRefreshingMessages, setIsRefreshingMessages] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newMessageRole, setNewMessageRole] = useState<
    "user" | "assistant" | "system" | "tool" | "function"
  >("user");
  const [newMessageText, setNewMessageText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{
      id: string;
      file: File;
      type:
        | "text"
        | "image"
        | "audio"
        | "video"
        | "file"
        | "tool-call"
        | "tool-result"
        | "data";
    }>
  >([]);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [messagePublicUrls, setMessagePublicUrls] = useState<
    Record<string, { url: string; expire_at: string }>
  >({});

  const filteredSessions = sessions.filter((session) =>
    session.id.toLowerCase().includes(sessionFilterText.toLowerCase())
  );

  const totalPages = Math.ceil(allMessages.length / PAGE_SIZE);
  const paginatedMessages = allMessages.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const loadSessions = async () => {
    try {
      setIsLoadingSessions(true);
      const res = await getSessions();
      if (res.code !== 0) {
        console.error(res.message);
        return;
      }
      setSessions(res.data || []);
    } catch (error) {
      console.error("Failed to load sessions:", error);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const loadAllMessages = async (sessionId: string) => {
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

  const handleRefreshSessions = async () => {
    setIsRefreshingSessions(true);
    await loadSessions();
    setIsRefreshingSessions(false);
  };

  const handleRefreshMessages = async () => {
    if (!selectedSession) return;
    setIsRefreshingMessages(true);
    await loadAllMessages(selectedSession.id);
    setIsRefreshingMessages(false);
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleSessionSelect = (session: Session) => {
    setSelectedSession(session);
    loadAllMessages(session.id);
  };

  const handleOpenCreateDialog = () => {
    setNewMessageRole("user");
    setNewMessageText("");
    setUploadedFiles([]);
    setCreateDialogOpen(true);
  };

  const handleOpenDetailDialog = (message: Message) => {
    setSelectedMessage(message);
    setDetailDialogOpen(true);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newFiles = Array.from(files).map((file) => {
      // Default to "file" type, let user choose
      return {
        id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        file,
        type: "file" as
          | "text"
          | "image"
          | "audio"
          | "video"
          | "file"
          | "tool-call"
          | "tool-result"
          | "data",
      };
    });

    setUploadedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleFileTypeChange = (
    fileId: string,
    newType:
      | "text"
      | "image"
      | "audio"
      | "video"
      | "file"
      | "tool-call"
      | "tool-result"
      | "data"
  ) => {
    setUploadedFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, type: newType } : f))
    );
  };

  const handleRemoveFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSendMessage = async () => {
    if (
      !selectedSession ||
      (!newMessageText.trim() && uploadedFiles.length === 0)
    )
      return;

    try {
      setIsSendingMessage(true);

      // Build parts array
      const parts: MessagePartIn[] = [];

      // Add text part if present
      if (newMessageText.trim()) {
        parts.push({ type: "text", text: newMessageText });
      }

      // Build file mapping and file parts
      const files: Record<string, File> = {};
      uploadedFiles.forEach((fileItem) => {
        const fieldName = fileItem.id;
        files[fieldName] = fileItem.file;
        parts.push({
          type: fileItem.type,
          file_field: fieldName,
        });
      });

      // Send message
      const res = await sendMessage(
        selectedSession.id,
        newMessageRole,
        parts,
        Object.keys(files).length > 0 ? files : undefined
      );

      if (res.code !== 0) {
        console.error(res.message);
        return;
      }

      await loadAllMessages(selectedSession.id);
      setCreateDialogOpen(false);
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSendingMessage(false);
    }
  };

  return (
    <div className="h-full bg-background p-6">
      <div className="flex gap-4 h-full">
        {/* Left: Session List */}
        <div className="w-80 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("sessions")}</h2>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefreshSessions}
              disabled={isRefreshingSessions || isLoadingSessions}
              title={t("refresh")}
            >
              {isRefreshingSessions ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>

          <Input
            type="text"
            placeholder={t("filterById")}
            value={sessionFilterText}
            onChange={(e) => setSessionFilterText(e.target.value)}
          />

          <div className="flex-1 overflow-auto">
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
              <div className="space-y-2">
                {filteredSessions.map((session) => {
                  const isSelected = selectedSession?.id === session.id;
                  return (
                    <div
                      key={session.id}
                      className={cn(
                        "group relative rounded-md border p-3 cursor-pointer transition-colors hover:bg-accent",
                        isSelected && "bg-accent border-primary"
                      )}
                      onClick={() => handleSessionSelect(session)}
                    >
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-medium truncate font-mono"
                          title={session.id}
                        >
                          {session.id}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(session.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Messages */}
        <div className="flex-1 flex flex-col space-y-4">
          {selectedSession ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-lg font-semibold">{t("messages")}</h2>
                  <span className="text-sm text-muted-foreground">/</span>
                  <p className="text-sm text-muted-foreground font-mono truncate">
                    {selectedSession.id}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleOpenCreateDialog}
                    disabled={isLoadingMessages}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t("createMessage")}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleRefreshMessages}
                    disabled={isRefreshingMessages || isLoadingMessages}
                    title={t("refresh")}
                  >
                    {isRefreshingMessages ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex-1 rounded-md border overflow-hidden flex flex-col">
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : allMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
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
                            <TableHead className="w-[200px]">
                              {t("messageId")}
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
                            <TableHead className="w-[100px]">
                              {t("actions")}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedMessages.map((message) => (
                            <TableRow key={message.id}>
                              <TableCell className="font-mono text-xs">
                                {message.id}
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
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() =>
                                    handleOpenDetailDialog(message)
                                  }
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
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center rounded-md border">
              <p className="text-sm text-muted-foreground">
                {t("selectSession")}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Message Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("createMessageTitle")}</DialogTitle>
            <DialogDescription>
              {t("createMessageDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("role")}</label>
              <Select
                value={newMessageRole}
                onValueChange={(value) =>
                  setNewMessageRole(
                    value as
                      | "user"
                      | "assistant"
                      | "system"
                      | "tool"
                      | "function"
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">user</SelectItem>
                  <SelectItem value="assistant">assistant</SelectItem>
                  <SelectItem value="system">system</SelectItem>
                  <SelectItem value="tool">tool</SelectItem>
                  <SelectItem value="function">function</SelectItem>
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
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("attachFiles")}</label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    document.getElementById("file-upload")?.click()
                  }
                  disabled={isSendingMessage}
                >
                  <Upload className="h-4 w-4 mr-2" />
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
                  {uploadedFiles.map((fileItem) => (
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
                            handleFileTypeChange(
                              fileItem.id,
                              value as
                                | "text"
                                | "image"
                                | "audio"
                                | "video"
                                | "file"
                                | "tool-call"
                                | "tool-result"
                                | "data"
                            )
                          }
                          disabled={isSendingMessage}
                        >
                          <SelectTrigger className="w-full h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">text</SelectItem>
                            <SelectItem value="image">image</SelectItem>
                            <SelectItem value="audio">audio</SelectItem>
                            <SelectItem value="video">video</SelectItem>
                            <SelectItem value="file">file</SelectItem>
                            <SelectItem value="tool-call">tool-call</SelectItem>
                            <SelectItem value="tool-result">
                              tool-result
                            </SelectItem>
                            <SelectItem value="data">data</SelectItem>
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
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={isSendingMessage}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={
                isSendingMessage ||
                (!newMessageText.trim() && uploadedFiles.length === 0)
              }
            >
              {isSendingMessage ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t("sending")}
                </>
              ) : (
                t("send")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("messageDetail")}</DialogTitle>
          </DialogHeader>
          {selectedMessage && (
            <div className="rounded-md border bg-card p-6">
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
                        {part.type !== "text" && (
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
