"use client";

import { useState, useRef, useEffect } from "react";
import { Tree, NodeRendererProps, TreeApi } from "react-arborist";
import { useTranslations } from "next-intl";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  RefreshCw,
  Plus,
  Trash2,
  FilePlus,
  FolderPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getSpaces,
  getFolders,
  getPages,
  getBlocks,
  createFolder,
  createPage,
  deleteFolder,
  deletePage,
} from "@/api/models/space";
import { Space, Block } from "@/types";
import { BlockNoteEditor } from "@/components/blocknote-editor";

interface TreeNode {
  id: string;
  name: string;
  type: "folder" | "page" | "block";
  blockType?: string;
  children?: TreeNode[];
  isLoaded?: boolean;
  blockData?: Block;
}

interface NodeProps extends NodeRendererProps<TreeNode> {
  loadingNodes: Set<string>;
  onDeleteClick: (node: TreeNode, e: React.MouseEvent) => void;
  onCreateClick: (type: "folder" | "page", parentId: string) => void;
  t: (key: string) => string;
}

function Node({ node, style, dragHandle, loadingNodes, onDeleteClick, onCreateClick, t }: NodeProps) {
  const indent = node.level * 12;
  const isFolder = node.data.type === "folder";
  const isPage = node.data.type === "page";
  const isLoading = loadingNodes.has(node.id);
  const [showButtons, setShowButtons] = useState(false);

  const handleClick = () => {
    if (isFolder) {
      node.toggle();
    } else if (isPage) {
      node.select();
    }
  };

  return (
    <div
      ref={dragHandle}
      style={style}
      className={cn(
        "flex items-center cursor-pointer px-2 py-1.5 text-sm rounded-md transition-colors group",
        "hover:bg-accent hover:text-accent-foreground",
        node.isSelected && "bg-accent text-accent-foreground"
      )}
      onMouseEnter={() => setShowButtons(true)}
      onMouseLeave={() => setShowButtons(false)}
      onClick={handleClick}
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
              <FolderOpen className="h-4 w-4 shrink-0 text-blue-500" />
            ) : (
              <Folder className="h-4 w-4 shrink-0 text-blue-500" />
            )}
          </>
        ) : isPage ? (
          <>
            <span className="w-4" />
            <FileText className="h-4 w-4 shrink-0 text-green-500" />
          </>
        ) : (
          <>
            <span className="w-4" />
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          </>
        )}
        <span className="min-w-0 truncate" title={node.data.name}>
          {node.data.name}
        </span>
      </div>
      {showButtons && (
        <div className="flex gap-1 shrink-0 ml-2">
          {isFolder && (
            <>
              <button
                className="p-1 rounded-md bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateClick("folder", node.data.id);
                }}
                title={t("createFolderTooltip")}
              >
                <FolderPlus className="h-3 w-3 text-blue-500" />
              </button>
              <button
                className="p-1 rounded-md bg-green-500/10 hover:bg-green-500/20 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateClick("page", node.data.id);
                }}
                title={t("createPageTooltip")}
              >
                <FilePlus className="h-3 w-3 text-green-500" />
              </button>
            </>
          )}
          <button
            className="p-1 rounded-md hover:bg-destructive/20 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteClick(node.data, e);
            }}
            title={t("deleteTooltip")}
          >
            <Trash2 className="h-3 w-3 text-destructive" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function PagesPage() {
  const t = useTranslations("pages");

  const treeRef = useRef<TreeApi<TreeNode>>(null);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(false);

  // Space related states
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(true);
  const [isRefreshingSpaces, setIsRefreshingSpaces] = useState(false);
  const [spaceFilterText, setSpaceFilterText] = useState("");

  // Blocks for BlockNote editor
  const [contentBlocks, setContentBlocks] = useState<Block[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  // Delete confirmation dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<TreeNode | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<"folder" | "page">("folder");
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [createTitle, setCreateTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const filteredSpaces = spaces.filter((space) =>
    space.id.toLowerCase().includes(spaceFilterText.toLowerCase())
  );

  const loadSpaces = async () => {
    try {
      setIsLoadingSpaces(true);
      const res = await getSpaces();
      if (res.code !== 0) {
        console.error(res.message);
        return;
      }
      setSpaces(res.data || []);
    } catch (error) {
      console.error("Failed to load spaces:", error);
    } finally {
      setIsLoadingSpaces(false);
    }
  };

  useEffect(() => {
    loadSpaces();
  }, []);

  const handleSpaceSelect = async (space: Space) => {
    setSelectedSpace(space);
    setTreeData([]);
    setSelectedNode(null);
    setContentBlocks([]);

    try {
      setIsInitialLoading(true);

      // Load root-level folders
      const foldersRes = await getFolders(space.id);
      if (foldersRes.code !== 0) {
        console.error(foldersRes.message);
        return;
      }

      // Load root-level pages (pages without parent)
      const pagesRes = await getPages(space.id);
      if (pagesRes.code !== 0) {
        console.error(pagesRes.message);
        return;
      }

      const folders: TreeNode[] = (foldersRes.data || []).map((block) => ({
        id: block.id,
        name: block.title || "Untitled Folder",
        type: "folder" as const,
        blockType: block.type,
        isLoaded: false,
        blockData: block,
      }));

      const pages: TreeNode[] = (pagesRes.data || []).map((block) => ({
        id: block.id,
        name: block.title || "Untitled Page",
        type: "page" as const,
        blockType: block.type,
        isLoaded: false,
        blockData: block,
      }));

      // Folders first, then pages
      setTreeData([...folders, ...pages]);
    } catch (error) {
      console.error("Failed to load folders and pages:", error);
    } finally {
      setIsInitialLoading(false);
    }
  };

  const handleToggle = async (nodeId: string) => {
    const node = treeRef.current?.get(nodeId);
    if (!node || node.data.type !== "folder" || !selectedSpace) return;

    if (node.data.isLoaded) return;

    setLoadingNodes((prev) => new Set(prev).add(nodeId));

    try {
      // Load child folders
      const foldersRes = await getFolders(selectedSpace.id, node.data.id);
      if (foldersRes.code !== 0) {
        console.error(foldersRes.message);
        return;
      }

      // Load child pages
      const pagesRes = await getPages(selectedSpace.id, node.data.id);
      if (pagesRes.code !== 0) {
        console.error(pagesRes.message);
        return;
      }

      const childFolders: TreeNode[] = (foldersRes.data || []).map((block: Block) => ({
        id: block.id,
        name: block.title || "Untitled Folder",
        type: "folder" as const,
        blockType: block.type,
        isLoaded: false,
        blockData: block,
      }));

      const childPages: TreeNode[] = (pagesRes.data || []).map((block: Block) => ({
        id: block.id,
        name: block.title || "Untitled Page",
        type: "page" as const,
        blockType: block.type,
        isLoaded: false,
        blockData: block,
      }));

      // Folders first, then pages
      const children = [...childFolders, ...childPages];

      setTreeData((prevData) => {
        const updateNode = (nodes: TreeNode[]): TreeNode[] => {
          return nodes.map((n) => {
            if (n.id === nodeId) {
              return {
                ...n,
                children,
                isLoaded: true,
              };
            }
            if (n.children) {
              return {
                ...n,
                children: updateNode(n.children),
              };
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

  const handleSelect = async (nodes: { data: TreeNode }[]) => {
    const node = nodes[0];
    if (!node) return;

    setSelectedNode(node.data);

    // If it's a page, load its non-page blocks for display
    if (node.data.type === "page" && selectedSpace) {
      try {
        setIsLoadingContent(true);
        const blocksRes = await getBlocks(selectedSpace.id, node.data.id);
        if (blocksRes.code !== 0) {
          console.error(blocksRes.message);
          return;
        }

        // Filter to only non-page blocks
        const nonPageBlocks = (blocksRes.data || []).filter(
          (block) => block.type !== "page"
        );
        setContentBlocks(nonPageBlocks);
      } catch (error) {
        console.error("Failed to load blocks:", error);
      } finally {
        setIsLoadingContent(false);
      }
    }
  };

  const handleRefreshSpaces = async () => {
    setIsRefreshingSpaces(true);
    await loadSpaces();
    setIsRefreshingSpaces(false);
  };

  // Reload tree data
  const reloadTreeData = async () => {
    if (!selectedSpace) return;

    try {
      const foldersRes = await getFolders(selectedSpace.id);
      const pagesRes = await getPages(selectedSpace.id);

      if (foldersRes.code !== 0 || pagesRes.code !== 0) {
        console.error(foldersRes.message || pagesRes.message);
        return;
      }

      const folders: TreeNode[] = (foldersRes.data || []).map((block) => ({
        id: block.id,
        name: block.title || "Untitled Folder",
        type: "folder" as const,
        blockType: block.type,
        isLoaded: false,
        blockData: block,
      }));

      const pages: TreeNode[] = (pagesRes.data || []).map((block) => ({
        id: block.id,
        name: block.title || "Untitled Page",
        type: "page" as const,
        blockType: block.type,
        isLoaded: false,
        blockData: block,
      }));

      setTreeData([...folders, ...pages]);
    } catch (error) {
      console.error("Failed to reload tree:", error);
    }
  };

  // Handle delete click
  const handleDeleteClick = (node: TreeNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setItemToDelete(node);
    setDeleteDialogOpen(true);
  };

  // Handle delete
  const handleDelete = async () => {
    if (!itemToDelete || !selectedSpace) return;

    try {
      setIsDeleting(true);

      const deleteFunc = itemToDelete.type === "folder" ? deleteFolder : deletePage;
      const res = await deleteFunc(selectedSpace.id, itemToDelete.id);

      if (res.code !== 0) {
        console.error(res.message);
        return;
      }

      // Clear selected node if it's the deleted one
      if (selectedNode?.id === itemToDelete.id) {
        setSelectedNode(null);
        setContentBlocks([]);
      }

      // Reload tree data
      await reloadTreeData();
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  // Handle create click
  const handleCreateClick = (type: "folder" | "page", parentId?: string | null) => {
    setCreateType(type);
    setCreateParentId(parentId ?? null);
    setCreateTitle("");
    setCreateDialogOpen(true);
  };

  // Handle create
  const handleCreate = async () => {
    if (!selectedSpace || !createTitle.trim()) return;

    try {
      setIsCreating(true);

      const data = {
        parent_id: createParentId || undefined,
        title: createTitle.trim(),
        props: {},
      };

      const createFunc = createType === "folder" ? createFolder : createPage;
      const res = await createFunc(selectedSpace.id, data);

      if (res.code !== 0) {
        console.error(res.message);
        return;
      }

      // If creating under a parent, reload that parent's children
      if (createParentId) {
        const parentNode = treeRef.current?.get(createParentId);
        if (parentNode) {
          // Mark parent as not loaded to force reload
          setTreeData((prevData) => {
            const updateNode = (nodes: TreeNode[]): TreeNode[] => {
              return nodes.map((n) => {
                if (n.id === createParentId) {
                  return {
                    ...n,
                    isLoaded: false,
                  };
                }
                if (n.children) {
                  return {
                    ...n,
                    children: updateNode(n.children),
                  };
                }
                return n;
              });
            };
            return updateNode(prevData);
          });

          // Trigger reload by toggling
          if (parentNode.isOpen) {
            parentNode.close();
            setTimeout(() => parentNode.open(), 100);
          } else {
            parentNode.open();
          }
        }
      } else {
        // Reload root level
        await reloadTreeData();
      }
    } catch (error) {
      console.error("Failed to create:", error);
    } finally {
      setIsCreating(false);
      setCreateDialogOpen(false);
      setCreateTitle("");
      setCreateType("folder");
      setCreateParentId(null);
    }
  };

  return (
    <div className="h-full bg-background p-6">
      <ResizablePanelGroup direction="horizontal">
        {/* Left: Space List */}
        <ResizablePanel defaultSize={25} minSize={15} maxSize={35}>
          <div className="h-full flex flex-col space-y-4 pr-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("spaces")}</h2>
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefreshSpaces}
                disabled={isRefreshingSpaces || isLoadingSpaces}
                title={t("refresh")}
              >
                {isRefreshingSpaces ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>

            <Input
              type="text"
              placeholder={t("filterById")}
              value={spaceFilterText}
              onChange={(e) => setSpaceFilterText(e.target.value)}
            />

            <div className="flex-1 overflow-auto">
              {isLoadingSpaces ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredSpaces.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">
                    {spaces.length === 0 ? t("noData") : t("noMatching")}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredSpaces.map((space) => {
                    const isSelected = selectedSpace?.id === space.id;
                    return (
                      <div
                        key={space.id}
                        className={cn(
                          "group relative rounded-md border p-3 cursor-pointer transition-colors hover:bg-accent",
                          isSelected && "bg-accent border-primary"
                        )}
                        onClick={() => handleSpaceSelect(space)}
                      >
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-medium truncate font-mono"
                            title={space.id}
                          >
                            {space.id}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(space.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />

        {/* Center: Page Tree */}
        <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
          <div className="h-full flex flex-col px-4">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">{t("pagesTitle")}</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Folders & Pages
              </p>
            </div>

            <div className="flex-1 overflow-auto">
              {!selectedSpace ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">
                    {t("selectSpacePrompt")}
                  </p>
                </div>
              ) : isInitialLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {t("loadingPages")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col p-2">
                  {/* Root directory with create buttons */}
                  <div className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent transition-colors group mb-2">
                    <div className="flex items-center gap-1.5">
                      <FolderOpen className="h-4 w-4 shrink-0 text-blue-500" />
                      <span className="text-sm font-medium">{t("rootFolder")}</span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="shrink-0 p-1 rounded-md bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                        onClick={() => handleCreateClick("folder", null)}
                        title={t("createFolderTooltip")}
                      >
                        <FolderPlus className="h-3 w-3 text-blue-500" />
                      </button>
                      <button
                        className="shrink-0 p-1 rounded-md bg-green-500/10 hover:bg-green-500/20 transition-colors"
                        onClick={() => handleCreateClick("page", null)}
                        title={t("createPageTooltip")}
                      >
                        <FilePlus className="h-3 w-3 text-green-500" />
                      </button>
                    </div>
                  </div>

                  {/* File tree */}
                  {treeData.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">
                        {t("noPages")}
                      </p>
                    </div>
                  ) : (
                    <div className="flex-1">
                      <Tree
                        ref={treeRef}
                        data={treeData}
                        openByDefault={false}
                        width="100%"
                        height={700}
                        indent={12}
                        rowHeight={32}
                        onToggle={handleToggle}
                        onSelect={handleSelect}
                      >
                        {(props) => (
                          <Node
                            {...props}
                            loadingNodes={loadingNodes}
                            onDeleteClick={handleDeleteClick}
                            onCreateClick={handleCreateClick}
                            t={t}
                          />
                        )}
                      </Tree>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />

        {/* Right: BlockNote Editor */}
        <ResizablePanel>
          <div className="h-full overflow-auto pl-4">
            <h2 className="mb-4 text-lg font-semibold">{t("contentTitle")}</h2>
            <div className="rounded-md border bg-card p-6">
              {!selectedNode ? (
                <p className="text-sm text-muted-foreground">
                  {t("selectPagePrompt")}
                </p>
              ) : isLoadingContent ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : contentBlocks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("noBlocks")}
                </p>
              ) : (
                <BlockNoteEditor blocks={contentBlocks} editable={false} />
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {itemToDelete?.type === "folder"
                ? t("deleteFolderTitle")
                : t("deletePageTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete?.type === "folder"
                ? t("deleteFolderDescription")
                : t("deletePageDescription")}{" "}
              <span className="font-semibold">{itemToDelete?.name}</span>?{" "}
              {t("deleteWarning")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
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

      {/* Create dialog */}
      <AlertDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {createType === "folder"
                ? t("createFolderTitle")
                : t("createPageTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {createType === "folder"
                ? t("createFolderDescription")
                : t("createPageDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              type="text"
              placeholder={t("titlePlaceholder")}
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && createTitle.trim()) {
                  handleCreate();
                }
              }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCreating}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCreate}
              disabled={isCreating || !createTitle.trim()}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("creating")}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  {t("create")}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

