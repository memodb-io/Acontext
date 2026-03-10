"use client";

import Image from "next/image";
import {
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  FileText,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
} from "@/components/ui/sidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { CodeEditor } from "@/components/code-editor";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { Button } from "@/components/ui/button";

// --- TreeNode type ---

export interface TreeNode {
  id: string;
  name: string;
  type: string;
  children?: TreeNode[];
  isLoaded?: boolean;
  isOpen?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// --- FileTree (low-level tree renderer) ---

export interface FileTreeProps<T extends TreeNode = TreeNode> {
  nodes: T[];
  selectedNode: T | null;
  loadingNodes: Set<string>;
  onToggle: (nodeId: string) => void;
  onSelect: (node: T) => void;
  renderActions?: (node: T) => React.ReactNode;
  variant?: "sidebar" | "simple";
  getNodeIcon?: (node: T, isOpen: boolean) => React.ReactNode;
  getNodeTypeIcon?: (node: T) => React.ReactNode;
  className?: string;
  sortNodes?: boolean;
}

function sortTreeNodes(nodes: TreeNode[]): TreeNode[] {
  return [...nodes].sort((a, b) => {
    const aIsFolder = a.type === "folder";
    const bIsFolder = b.type === "folder";
    if (aIsFolder && !bIsFolder) return -1;
    if (!aIsFolder && bIsFolder) return 1;

    const aBlockData = (a as TreeNode & { blockData?: { sort?: number } }).blockData;
    const bBlockData = (b as TreeNode & { blockData?: { sort?: number } }).blockData;
    const aSort = aBlockData?.sort ?? (a as TreeNode & { sort?: number }).sort ?? Infinity;
    const bSort = bBlockData?.sort ?? (b as TreeNode & { sort?: number }).sort ?? Infinity;
    if (aSort !== bSort && aSort !== Infinity && bSort !== Infinity) {
      return aSort - bSort;
    }

    return a.name.localeCompare(b.name);
  });
}

const getDefaultIcon = (node: TreeNode, isOpen: boolean) => {
  if (node.type === "folder") {
    return isOpen ? (
      <FolderOpen className="h-4 w-4 shrink-0 text-blue-500" />
    ) : (
      <Folder className="h-4 w-4 shrink-0 text-blue-500" />
    );
  }
  if (node.type === "file") {
    return <File className="h-4 w-4 shrink-0 text-green-500" />;
  }
  if (node.type === "page") {
    return <FileText className="h-4 w-4 shrink-0 text-green-500" />;
  }
  return null;
};

function SidebarTreeItem<T extends TreeNode>({
  node,
  selectedNode,
  loadingNodes,
  onToggle,
  onSelect,
  renderActions,
  getNodeIcon,
  getNodeTypeIcon,
}: Omit<FileTreeProps<T>, "nodes" | "variant" | "className"> & { node: T }) {
  const isFolder = node.type === "folder";
  const isLoading = loadingNodes.has(node.id);
  const isSelected = selectedNode?.id === node.id;
  const isOpen = node.isOpen || false;
  const hasChildren = node.children && node.children.length > 0;

  if (!isFolder) {
    const icon = getNodeTypeIcon
      ? getNodeTypeIcon(node)
      : getDefaultIcon(node, false);

    const hasActions = !!renderActions;

    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild={hasActions}
          isActive={isSelected}
          className="data-[active=true]:bg-transparent group/item has-data-[state=open]:bg-accent"
          onClick={hasActions ? undefined : () => onSelect(node)}
        >
          {hasActions ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelect(node)}
            >
              {icon}
              <span className="flex-1 min-w-0 truncate" title={node.name}>
                {node.name}
              </span>
              <div className="shrink-0 ml-2 opacity-0 group-hover/item:opacity-100 has-data-[state=open]:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                {renderActions(node)}
              </div>
            </div>
          ) : (
            <>
              {icon}
              <span className="flex-1 min-w-0 truncate" title={node.name}>
                {node.name}
              </span>
            </>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  const hasActions = !!renderActions;

  return (
    <SidebarMenuItem>
      <Collapsible
        className={cn(
          "group/collapsible",
          !hasActions && "[&[data-state=open]>button>svg:first-child]:rotate-90",
          hasActions && "[&[data-state=open]>div>svg:first-child]:rotate-90"
        )}
        open={isOpen}
        onOpenChange={() => onToggle(node.id)}
      >
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            asChild={hasActions}
            className="w-full group/item has-data-[state=open]:bg-accent"
          >
            {hasActions ? (
              <div
                role="button"
                tabIndex={0}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <ChevronRight className="transition-transform" />
                )}
                {getNodeIcon
                  ? getNodeIcon(node, isOpen)
                  : getDefaultIcon(node, isOpen)}
                <span className="flex-1 min-w-0 truncate" title={node.name}>
                  {node.name}
                </span>
                <div className="shrink-0 ml-2 opacity-0 group-hover/item:opacity-100 has-data-[state=open]:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  {renderActions(node)}
                </div>
              </div>
            ) : (
              <>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <ChevronRight className="transition-transform" />
                )}
                {getNodeIcon
                  ? getNodeIcon(node, isOpen)
                  : getDefaultIcon(node, isOpen)}
                <span className="flex-1 min-w-0 truncate" title={node.name}>
                  {node.name}
                </span>
              </>
            )}
          </SidebarMenuButton>
        </CollapsibleTrigger>
        {hasChildren && (
          <CollapsibleContent>
            <SidebarMenuSub>
              {(sortTreeNodes(node.children || []) as T[]).map((child) => (
                <SidebarTreeItem
                  key={child.id}
                  node={child}
                  selectedNode={selectedNode}
                  loadingNodes={loadingNodes}
                  onToggle={onToggle}
                  onSelect={onSelect}
                  renderActions={renderActions}
                  getNodeIcon={getNodeIcon}
                  getNodeTypeIcon={getNodeTypeIcon}
                />
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        )}
      </Collapsible>
    </SidebarMenuItem>
  );
}

function SimpleTreeItem<T extends TreeNode>({
  node,
  selectedNode,
  loadingNodes,
  onToggle,
  onSelect,
  renderActions,
  getNodeIcon,
  getNodeTypeIcon,
  level = 0,
}: Omit<FileTreeProps<T>, "nodes" | "variant" | "className"> & {
  node: T;
  level?: number;
}) {
  const isFolder = node.type === "folder";
  const isLoading = loadingNodes.has(node.id);
  const isSelected = selectedNode?.id === node.id;
  const isOpen = node.isOpen || false;

  const icon = getNodeIcon
    ? getNodeIcon(node, isOpen)
    : getDefaultIcon(node, isOpen);

  const typeIcon = getNodeTypeIcon
    ? getNodeTypeIcon(node)
    : getDefaultIcon(node, isOpen);

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent transition-colors group",
          isSelected && "bg-accent"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => {
          if (isFolder) {
            onToggle(node.id);
          } else {
            onSelect(node);
          }
        }}
      >
        {isFolder ? (
          <>
            {isLoading ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <ChevronRight
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform",
                  isOpen && "rotate-90"
                )}
              />
            )}
            {icon}
          </>
        ) : (
          <>
            <span className="w-4" />
            {typeIcon}
          </>
        )}
        <span className="flex-1 min-w-0 truncate text-sm" title={node.name}>
          {node.name}
        </span>
        {renderActions && (
          <div
            className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            {renderActions(node)}
          </div>
        )}
      </div>
      {isFolder && isOpen && node.children && (
        <div>
          {(sortTreeNodes(node.children) as T[]).map((child) => (
            <SimpleTreeItem
              key={child.id}
              node={child}
              selectedNode={selectedNode}
              loadingNodes={loadingNodes}
              onToggle={onToggle}
              onSelect={onSelect}
              renderActions={renderActions}
              getNodeIcon={getNodeIcon}
              getNodeTypeIcon={getNodeTypeIcon}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree<T extends TreeNode = TreeNode>({
  nodes,
  selectedNode,
  loadingNodes,
  onToggle,
  onSelect,
  renderActions,
  variant = "sidebar",
  getNodeIcon,
  getNodeTypeIcon,
  className,
  sortNodes = true,
}: FileTreeProps<T>) {
  const sortedNodes = sortNodes ? (sortTreeNodes(nodes as TreeNode[]) as T[]) : nodes;

  if (variant === "sidebar") {
    return (
      <div className={className}>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {sortedNodes.map((node) => (
                <SidebarTreeItem
                  key={node.id}
                  node={node}
                  selectedNode={selectedNode}
                  loadingNodes={loadingNodes}
                  onToggle={onToggle}
                  onSelect={onSelect}
                  renderActions={renderActions}
                  getNodeIcon={getNodeIcon}
                  getNodeTypeIcon={getNodeTypeIcon}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </div>
    );
  }

  return (
    <div className={className}>
      {sortedNodes.map((node) => (
        <SimpleTreeItem
          key={node.id}
          node={node}
          selectedNode={selectedNode}
          loadingNodes={loadingNodes}
          onToggle={onToggle}
          onSelect={onSelect}
          renderActions={renderActions}
          getNodeIcon={getNodeIcon}
          getNodeTypeIcon={getNodeTypeIcon}
        />
      ))}
    </div>
  );
}

// --- FileTreeViewer (high-level: tree panel + content panel) ---

export interface FileTreeViewerProps<T extends TreeNode = TreeNode> {
  nodes: T[];
  selectedNode: T | null;
  loadingNodes: Set<string>;
  onToggle: (nodeId: string) => void;
  onSelect: (node: T) => void;
  renderActions?: (node: T) => React.ReactNode;

  isTreeLoading?: boolean;
  treeError?: string | null;
  onRetryTree?: () => void;
  emptyMessage?: string;
  treeTitle?: string;
  treeHeader?: React.ReactNode;

  fileContent?: string | null;
  fileContentType?: string | null;
  imageUrl?: string | null;
  isImageFile?: boolean;
  imageName?: string;
  isLoadingContent?: boolean;
  selectedFileName?: string;
  isMarkdownFile?: boolean;

  className?: string;
  treePanelDefaultSize?: number;
}

export function FileTreeViewer<T extends TreeNode = TreeNode>({
  nodes,
  selectedNode,
  loadingNodes,
  onToggle,
  onSelect,
  renderActions,
  isTreeLoading = false,
  treeError = null,
  onRetryTree,
  emptyMessage = "No files",
  treeTitle = "Files",
  treeHeader,
  fileContent = null,
  fileContentType = null,
  imageUrl = null,
  isImageFile = false,
  imageName,
  isLoadingContent = false,
  selectedFileName,
  isMarkdownFile = false,
  className,
  treePanelDefaultSize = 35,
}: FileTreeViewerProps<T>) {
  const hasFile = !!selectedNode;

  return (
    <div className={className}>
      <ResizablePanelGroup
        direction="horizontal"
        className="h-full rounded-md border"
      >
        {/* Tree Panel */}
        <ResizablePanel
          defaultSize={treePanelDefaultSize}
          minSize={20}
          maxSize={50}
        >
          <div className="h-full flex flex-col pt-4 px-2">
            <h3 className="text-sm font-semibold px-2">{treeTitle}</h3>

            {isTreeLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Loading files...
                  </p>
                </div>
              </div>
            ) : treeError ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-center">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                  <p className="text-sm text-muted-foreground">{treeError}</p>
                  {onRetryTree && (
                    <Button variant="outline" size="sm" onClick={onRetryTree}>
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            ) : nodes.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">{emptyMessage}</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                {treeHeader}

                <div className="flex-1 overflow-auto">
                  <FileTree
                    nodes={nodes}
                    selectedNode={selectedNode}
                    loadingNodes={loadingNodes}
                    onToggle={onToggle}
                    onSelect={onSelect}
                    renderActions={renderActions}
                    variant="sidebar"
                  />
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Content Panel */}
        <ResizablePanel defaultSize={100 - treePanelDefaultSize}>
          <div className="h-full flex flex-col overflow-hidden">
            {hasFile ? (
              isLoadingContent ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Loading preview...
                    </p>
                  </div>
                </div>
              ) : isImageFile && imageUrl ? (
                <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
                  <Image
                    src={imageUrl}
                    alt={imageName || selectedFileName || "preview"}
                    width={800}
                    height={600}
                    className="max-w-full h-auto rounded-md shadow-sm"
                    style={{ objectFit: "contain" }}
                    unoptimized
                  />
                </div>
              ) : fileContent !== null ? (
                <div className="h-full flex flex-col">
                  <div className="flex-1 min-h-0">
                    {isMarkdownFile ? (
                      <div className="h-full overflow-auto">
                        <MarkdownViewer value={fileContent} height="100%" className="rounded-none" />
                      </div>
                    ) : (
                      <CodeEditor
                        value={fileContent}
                        height="100%"
                        language="auto"
                        contentType={fileContentType}
                        filename={selectedFileName}
                        readOnly
                        className="h-full border-0 rounded-none overflow-hidden [&_.cm-editor]:h-full! [&_.cm-scroller]:overflow-auto!"
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    Binary file - use download to get the file
                  </p>
                </div>
              )
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  Select a file to view its content
                </p>
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
