"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { Tree, NodeRendererProps, TreeApi, NodeApi } from "react-arborist";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  Loader2,
  AlertCircle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getListArtifacts, getArtifact } from "@/app/disk/actions";
import { ListArtifactsResp, Artifact as FileInfo } from "@/types";
import ReactCodeMirror from "@uiw/react-codemirror";
import { okaidia } from "@uiw/codemirror-theme-okaidia";
import { json } from "@codemirror/lang-json";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { markdown } from "@codemirror/lang-markdown";
import { xml } from "@codemirror/lang-xml";
import { sql } from "@codemirror/lang-sql";
import { EditorView } from "@codemirror/view";
import { StreamLanguage } from "@codemirror/language";
import { go } from "@codemirror/legacy-modes/mode/go";
import { yaml } from "@codemirror/legacy-modes/mode/yaml";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { rust } from "@codemirror/legacy-modes/mode/rust";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";

// --- Types ---

interface TreeNode {
  id: string;
  name: string;
  type: "folder" | "file";
  path: string;
  children?: TreeNode[];
  isLoaded?: boolean;
  fileInfo?: FileInfo;
}

interface ReadOnlyNodeProps extends NodeRendererProps<TreeNode> {
  loadingNodes: Set<string>;
  t: (key: string) => string;
}

export interface DiskTreeViewerProps {
  diskId: string;
  className?: string;
}

// --- Utilities ---

function truncateMiddle(str: string, maxLength: number = 30): string {
  if (str.length <= maxLength) return str;
  const ellipsis = "...";
  const charsToShow = maxLength - ellipsis.length;
  const frontChars = Math.ceil(charsToShow / 2);
  const backChars = Math.floor(charsToShow / 2);
  return (
    str.substring(0, frontChars) +
    ellipsis +
    str.substring(str.length - backChars)
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getLanguageExtension(contentType: string | null, filename?: string) {
  if (contentType) {
    const type = contentType.toLowerCase();
    if (type.includes("json")) return json();
    if (type.includes("javascript") || type.includes("js")) return javascript();
    if (type.includes("typescript") || type.includes("ts"))
      return javascript({ typescript: true });
    if (type.includes("python") || type.includes("py")) return python();
    if (type.includes("html")) return html();
    if (type.includes("css")) return css();
    if (type.includes("markdown") || type.includes("md")) return markdown();
    if (type.includes("xml")) return xml();
    if (type.includes("sql")) return sql();
    if (type.includes("yaml") || type.includes("yml"))
      return StreamLanguage.define(yaml);
    if (type.includes("shell") || type.includes("bash") || type.includes("sh"))
      return StreamLanguage.define(shell);
    if (type.includes("go")) return StreamLanguage.define(go);
    if (type.includes("rust") || type.includes("rs"))
      return StreamLanguage.define(rust);
    if (type.includes("ruby") || type.includes("rb"))
      return StreamLanguage.define(ruby);
  }

  if (filename) {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "json":
        return json();
      case "js":
      case "jsx":
      case "mjs":
        return javascript({ jsx: true });
      case "ts":
      case "tsx":
        return javascript({ typescript: true, jsx: ext === "tsx" });
      case "py":
        return python();
      case "html":
      case "htm":
        return html();
      case "css":
        return css();
      case "md":
      case "markdown":
        return markdown();
      case "xml":
        return xml();
      case "sql":
        return sql();
      case "yaml":
      case "yml":
        return StreamLanguage.define(yaml);
      case "sh":
      case "bash":
      case "zsh":
        return StreamLanguage.define(shell);
      case "go":
        return StreamLanguage.define(go);
      case "rs":
        return StreamLanguage.define(rust);
      case "rb":
        return StreamLanguage.define(ruby);
    }
  }

  return [];
}

// --- Tree Node Component (read-only, with metadata tooltip) ---

function Node({ node, style, dragHandle, loadingNodes, t }: ReadOnlyNodeProps) {
  const indent = node.level * 12;
  const isFolder = node.data.type === "folder";
  const isLoading = loadingNodes.has(node.id);
  const textRef = useRef<HTMLSpanElement>(null);
  const [displayName, setDisplayName] = useState(node.data.name);

  useEffect(() => {
    const updateDisplayName = () => {
      if (!textRef.current) return;
      const container = textRef.current.parentElement;
      if (!container) return;

      const containerWidth = container.clientWidth;
      const iconWidth = isFolder ? 56 : 40;
      const availableWidth = containerWidth - iconWidth;

      const tempSpan = document.createElement("span");
      tempSpan.style.visibility = "hidden";
      tempSpan.style.position = "absolute";
      tempSpan.style.fontSize = "14px";
      tempSpan.style.fontFamily = getComputedStyle(textRef.current).fontFamily;
      tempSpan.textContent = node.data.name;
      document.body.appendChild(tempSpan);

      const fullWidth = tempSpan.offsetWidth;
      document.body.removeChild(tempSpan);

      if (fullWidth <= availableWidth) {
        setDisplayName(node.data.name);
        return;
      }

      const charWidth = fullWidth / node.data.name.length;
      const maxChars = Math.floor(availableWidth / charWidth);
      setDisplayName(truncateMiddle(node.data.name, Math.max(10, maxChars)));
    };

    updateDisplayName();

    const resizeObserver = new ResizeObserver(updateDisplayName);
    if (textRef.current?.parentElement) {
      resizeObserver.observe(textRef.current.parentElement);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [node.data.name, indent, isFolder]);

  const fileInfo = node.data.fileInfo;

  return (
    <div
      ref={dragHandle}
      style={style}
      className={cn(
        "flex items-center cursor-pointer px-2 py-1.5 text-sm rounded-md transition-colors group",
        "hover:bg-accent hover:text-accent-foreground",
        node.isSelected && "bg-accent text-accent-foreground",
        node.state.isDragging && "opacity-50"
      )}
      onClick={() => {
        if (isFolder) {
          node.toggle();
        } else {
          node.select();
        }
      }}
    >
      <div
        style={{ marginLeft: `${indent}px` }}
        className="flex items-center gap-1.5 flex-1 min-w-0"
      >
        {isFolder ? (
          <>
            {isLoading ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <ChevronRight
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform duration-200",
                  node.isOpen && "rotate-90"
                )}
              />
            )}
            {node.isOpen ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </>
        ) : (
          <>
            <span className="w-4" />
            <File className="h-4 w-4 shrink-0 text-muted-foreground" />
          </>
        )}
        <span ref={textRef} className="min-w-0" title={node.data.name}>
          {displayName}
        </span>
      </div>

      {/* Metadata info button for files */}
      {!isFolder && fileInfo && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="shrink-0 ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10"
              onClick={(e) => e.stopPropagation()}
            >
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="bg-popover text-popover-foreground border shadow-md rounded-lg px-3 py-2.5 max-w-[280px]"
          >
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t("mimeType")}</span>
                <span className="font-mono truncate">
                  {fileInfo.meta.__artifact_info__.mime}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t("size")}</span>
                <span className="font-mono">
                  {formatBytes(fileInfo.meta.__artifact_info__.size)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t("path")}</span>
                <span className="font-mono truncate">
                  {fileInfo.path}{fileInfo.filename}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t("createdAt")}</span>
                <span>{new Date(fileInfo.created_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t("updatedAt")}</span>
                <span>{new Date(fileInfo.updated_at).toLocaleString()}</span>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

// --- Main Component ---

export default function DiskTreeViewer({
  diskId,
  className,
}: DiskTreeViewerProps) {
  const t = useTranslations("skillDetail");
  const { resolvedTheme } = useTheme();

  const treeRef = useRef<TreeApi<TreeNode>>(null);
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const [treeHeight, setTreeHeight] = useState(400);

  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<TreeNode | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileContentType, setFileContentType] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const formatArtifacts = (path: string, res: ListArtifactsResp) => {
    const artifacts: TreeNode[] = res.artifacts.map((artifact) => ({
      id: `${artifact.path}${artifact.filename}`,
      name: artifact.filename,
      type: "file",
      path: artifact.path,
      isLoaded: false,
      fileInfo: artifact,
    }));
    const directories: TreeNode[] = res.directories.map((directory) => ({
      id: `${path}${directory}/`,
      name: directory,
      type: "folder",
      path: `${path}${directory}/`,
      isLoaded: false,
    }));
    return [...directories, ...artifacts];
  };

  const loadRoot = useCallback(async () => {
    setIsInitialLoading(true);
    setLoadError(null);
    setTreeData([]);
    setSelectedFile(null);

    try {
      const res = await getListArtifacts(diskId, "/");
      if (res.code !== 0 || !res.data) {
        setLoadError(res.message || t("loadError"));
        return;
      }
      setTreeData(formatArtifacts("/", res.data));
    } catch (error) {
      console.error("Failed to load artifacts:", error);
      setLoadError(t("loadError"));
    } finally {
      setIsInitialLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diskId]);

  useEffect(() => {
    loadRoot();
  }, [loadRoot]);

  // Measure tree container height
  useEffect(() => {
    const updateHeight = () => {
      if (treeContainerRef.current) {
        setTreeHeight(treeContainerRef.current.clientHeight);
      }
    };
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    if (treeContainerRef.current) {
      observer.observe(treeContainerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  const handleToggle = async (nodeId: string) => {
    const node = treeRef.current?.get(nodeId);
    if (!node || node.data.type !== "folder") return;
    if (node.data.isLoaded) return;

    setLoadingNodes((prev) => new Set(prev).add(nodeId));

    try {
      const children = await getListArtifacts(diskId, node.data.path);
      if (children.code !== 0 || !children.data) {
        console.error(children.message);
        return;
      }
      const files = formatArtifacts(node.data.path, children.data);

      setTreeData((prevData) => {
        const updateNode = (nodes: TreeNode[]): TreeNode[] => {
          return nodes.map((n) => {
            if (n.id === nodeId) {
              return { ...n, children: files, isLoaded: true };
            }
            if (n.children) {
              return { ...n, children: updateNode(n.children) };
            }
            return n;
          });
        };
        return updateNode(prevData);
      });
    } catch (error) {
      console.error("Failed to load children:", error);
    } finally {
      setLoadingNodes((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    }
  };

  const handleSelect = (nodes: NodeApi<TreeNode>[]) => {
    const node = nodes[0];
    if (node && node.data.type === "file") {
      setSelectedFile(node.data);
    }
  };

  // Auto-load preview when file selection changes
  useEffect(() => {
    setImageUrl(null);
    setFileContent(null);
    setFileContentType(null);

    if (!selectedFile?.fileInfo) return;

    let cancelled = false;

    const loadPreview = async () => {
      setIsLoadingPreview(true);
      try {
        const res = await getArtifact(
          diskId,
          `${selectedFile.path}${selectedFile.fileInfo!.filename}`,
          true
        );
        if (cancelled) return;
        if (res.code !== 0 || !res.data) {
          console.error(res.message);
          return;
        }
        setImageUrl(res.data.public_url || null);
        if (res.data.content) {
          setFileContent(res.data.content.raw);
          setFileContentType(res.data.content.type);
        }
      } catch (error) {
        if (!cancelled) console.error("Failed to load preview:", error);
      } finally {
        if (!cancelled) setIsLoadingPreview(false);
      }
    };

    loadPreview();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile, diskId]);

  return (
    <div className={cn("flex-1 min-h-0", className)}>
      <ResizablePanelGroup direction="horizontal" className="h-full rounded-md border">
        {/* File Tree Panel */}
        <ResizablePanel defaultSize={35} minSize={20} maxSize={50}>
          <div className="h-full flex flex-col p-4">
            <h3 className="text-sm font-semibold mb-3">{t("filesTitle")}</h3>

            {isInitialLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {t("loadingFiles")}
                  </p>
                </div>
              </div>
            ) : loadError ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-center">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                  <p className="text-sm text-muted-foreground">{loadError}</p>
                  <Button variant="outline" size="sm" onClick={loadRoot}>
                    {t("retry")}
                  </Button>
                </div>
              </div>
            ) : treeData.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">{t("noFiles")}</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Root directory indicator */}
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md">
                  <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm">/</span>
                </div>

                {/* Tree */}
                <div ref={treeContainerRef} className="flex-1 min-h-0">
                  <Tree
                    ref={treeRef}
                    data={treeData}
                    openByDefault={false}
                    width="100%"
                    height={treeHeight}
                    indent={12}
                    rowHeight={32}
                    onToggle={handleToggle}
                    onSelect={handleSelect}
                  >
                    {(props) => (
                      <Node {...props} loadingNodes={loadingNodes} t={t} />
                    )}
                  </Tree>
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Content Panel — renders file content only */}
        <ResizablePanel defaultSize={65}>
          <div className="h-full flex flex-col overflow-hidden">
            {selectedFile && selectedFile.fileInfo ? (
              isLoadingPreview ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {t("loadingPreview")}
                    </p>
                  </div>
                </div>
              ) : imageUrl &&
                selectedFile.fileInfo.meta.__artifact_info__.mime.startsWith(
                  "image/"
                ) ? (
                <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
                  <Image
                    src={imageUrl}
                    alt={selectedFile.fileInfo.filename}
                    width={800}
                    height={600}
                    className="max-w-full h-auto rounded-md shadow-sm"
                    style={{ objectFit: "contain" }}
                    unoptimized
                  />
                </div>
              ) : fileContent !== null ? (
                <ReactCodeMirror
                  value={fileContent}
                  height="100%"
                  theme={resolvedTheme === "dark" ? okaidia : "light"}
                  extensions={[
                    getLanguageExtension(
                      fileContentType,
                      selectedFile.fileInfo?.filename
                    ),
                    EditorView.lineWrapping,
                  ].flat()}
                  editable={false}
                  readOnly
                  className="h-full overflow-hidden [&_.cm-editor]:h-full! [&_.cm-scroller]:overflow-auto!"
                />
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    {t("noPreviewAvailable")}
                  </p>
                </div>
              )
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  {t("selectFilePrompt")}
                </p>
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
