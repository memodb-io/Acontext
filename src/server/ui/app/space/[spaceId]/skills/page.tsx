"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Tree, NodeRendererProps, TreeApi } from "react-arborist";
import { useTranslations } from "next-intl";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import { BlockEditor, useBlockEditor, DEFAULT_BLOCK_CONFIGS } from "@/components/block-editor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  ArrowLeft,
  FileEdit,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listBlocks,
  createBlock,
  deleteBlock,
  moveBlock,
  getSpaceConfigs,
  updateBlockProperties,
} from "@/api/models/space";
import { Block } from "@/types";

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

// Sortable Block Item Component
interface SortableBlockItemProps {
  block: Block;
  index: number;
  onEdit: (block: Block) => void;
  onDelete: (blockId: string) => void;
  t: (key: string) => string;
}

function SortableBlockItem({ block, index, onEdit, onDelete, t }: SortableBlockItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded-lg bg-card group relative"
    >
      {/* Header with block info and actions */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
            title={t("dragToReorder")}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
          <span className="text-sm font-medium text-muted-foreground">
            #{index + 1}
          </span>
          <span
            className={cn(
              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
              block.type === "sop" &&
                "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
              block.type === "text" &&
                "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
            )}
          >
            {block.type === "sop"
              ? "SOP"
              : block.type === "text"
              ? "TEXT"
              : block.type.toUpperCase()}
          </span>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="p-1.5 rounded-md hover:bg-primary/10 transition-colors"
            onClick={() => onEdit(block)}
            title={t("edit")}
          >
            <FileEdit className="h-4 w-4 text-primary" />
          </button>
          <button
            className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
            onClick={() => onDelete(block.id)}
            title={t("deleteTooltip")}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Use When / Title */}
        {block.title && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-1">
              {t("useWhen")}
            </h3>
            <p className="text-base font-medium">{block.title}</p>
          </div>
        )}

        {/* Block-specific content */}
        {block.type === "sop" && (
          <>
            {/* Preferences */}
            {block.props?.preferences &&
              typeof block.props.preferences === "string" && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-1">
                    {t("preferences")}
                  </h3>
                  <p className="text-sm whitespace-pre-wrap">
                    {String(block.props.preferences)}
                  </p>
                </div>
              )}

            {/* Steps */}
            {block.props?.tool_sops &&
              Array.isArray(block.props.tool_sops) &&
              block.props.tool_sops.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                    {t("steps")}
                  </h3>
                  <div className="space-y-2">
                    {(block.props.tool_sops as Array<{
                      tool_name: string;
                      action: string;
                    }>).map((step, index) => (
                      <div
                        key={index}
                        className="flex gap-3 p-3 bg-muted/30 rounded-md border"
                      >
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                          {index + 1}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-muted-foreground uppercase">
                              Tool:
                            </span>
                            <code className="text-sm font-mono bg-background px-2 py-0.5 rounded border">
                              {step.tool_name}
                            </code>
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-muted-foreground uppercase">
                              Action:
                            </span>
                            <p className="text-sm mt-1">{step.action}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </>
        )}

        {block.type === "text" && (
          <>
            {/* Notes */}
            {block.props?.notes && typeof block.props.notes === "string" && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">
                  {t("notes")}
                </h3>
                <p className="text-sm whitespace-pre-wrap">
                  {String(block.props.notes)}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Node({
  node,
  style,
  dragHandle,
  loadingNodes,
  onDeleteClick,
  onCreateClick,
  t,
}: NodeProps) {
  const indent = node.level * 12;
  const isFolder = node.data.type === "folder";
  const isPage = node.data.type === "page";
  const isLoading = loadingNodes.has(node.id);
  const [showButtons, setShowButtons] = useState(false);

  const handleClick = async () => {
    if (isPage) {
      node.select();
    } else if (isFolder) {
      // For folders, trigger toggle which will load and expand
      node.toggle();
    }
  };

  return (
    <div
      ref={dragHandle}
      style={style}
      className={cn(
        "flex items-center px-2 py-1.5 text-sm rounded-md transition-colors group",
        "hover:bg-accent hover:text-accent-foreground",
        node.isSelected && "bg-accent text-accent-foreground",
        node.state.isDragging && "opacity-50"
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
  const params = useParams();
  const router = useRouter();
  const spaceId = params.spaceId as string;

  const treeRef = useRef<TreeApi<TreeNode>>(null);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [spaceInfo, setSpaceInfo] = useState<string>("");

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

  // Use block editor hook
  const blockEditor = useBlockEditor();
  const [isBlockSaving, setIsBlockSaving] = useState(false);

  // Drag and drop sensors for sortable content blocks
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadSpaceInfo = async () => {
    try {
      const res = await getSpaceConfigs(spaceId);
      if (res.code === 0 && res.data) {
        setSpaceInfo(spaceId);
      } else {
        setSpaceInfo(spaceId);
      }
    } catch (error) {
      console.error("Failed to load space info:", error);
      setSpaceInfo(spaceId);
    }
  };

  const loadTreeData = async () => {
    try {
      setIsInitialLoading(true);

      // Load root-level blocks (pages and folders)
      const blocksRes = await listBlocks(spaceId);
      if (blocksRes.code !== 0) {
        console.error(blocksRes.message);
        return;
      }

      const blocks: TreeNode[] = (blocksRes.data || []).map((block) => {
        const isFolder = block.type === "folder";
        return {
          id: block.id,
          name: block.title || (isFolder ? "Untitled Folder" : "Untitled Page"),
          type: isFolder ? ("folder" as const) : ("page" as const),
          blockType: block.type,
          isLoaded: false,
          blockData: block,
        };
      });

      setTreeData(blocks);
    } catch (error) {
      console.error("Failed to load blocks:", error);
    } finally {
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    if (spaceId) {
      loadSpaceInfo();
      loadTreeData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId]);

  const loadFolderChildren = async (nodeId: string) => {
    const node = treeRef.current?.get(nodeId);
    if (!node || node.data.type !== "folder") return;

    setLoadingNodes((prev) => new Set(prev).add(nodeId));

    try {
      // Load child blocks (both folders and pages under this folder)
      const blocksRes = await listBlocks(spaceId, { parentId: node.data.id });
      if (blocksRes.code !== 0) {
        console.error(blocksRes.message);
        return;
      }

      const children: TreeNode[] = (blocksRes.data || []).map(
        (block: Block) => {
          const isFolder = block.type === "folder";
          return {
            id: block.id,
            name: block.title || (isFolder ? "Untitled Folder" : "Untitled Page"),
            type: isFolder ? ("folder" as const) : ("page" as const),
            blockType: block.type,
            isLoaded: false,
            blockData: block,
          };
        }
      );

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

      // Auto-open the folder after loading
      if (!node.isOpen) {
        node.open();
      }
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

  const handleToggle = async (nodeId: string) => {
    const node = treeRef.current?.get(nodeId);
    if (!node || node.data.type !== "folder") return;

    // If already loaded, Tree component will handle the toggle automatically
    if (node.data.isLoaded) {
      return;
    }

    // If opening (not loaded yet), load children
    if (!node.isOpen) {
      await loadFolderChildren(nodeId);
    }
  };

  const handleMove = async (args: {
    dragIds: string[];
    parentId: string | null;
    index: number;
  }) => {
    if (!args || args.dragIds.length === 0) return;

    const dragId = args.dragIds[0]; // Handle single item move

    try {
      // Call move API
      const res = await moveBlock(spaceId, dragId, {
        parent_id: args.parentId,
        sort: args.index,
      });

      if (res.code !== 0) {
        console.error("Move failed:", res.message);
        // Reload tree on error to restore original state
        await reloadTreeData();
        return;
      }

      // Update tree data to reflect the move
      setTreeData((prevData) => {
        // Helper function to find and remove a node
        const removeNode = (nodes: TreeNode[], targetId: string): { remaining: TreeNode[], removed: TreeNode | null } => {
          let removed: TreeNode | null = null;
          const remaining = nodes.filter(node => {
            if (node.id === targetId) {
              removed = node;
              return false;
            }
            return true;
          }).map(node => {
            if (node.children) {
              const result = removeNode(node.children, targetId);
              if (result.removed) {
                removed = result.removed;
              }
              return { ...node, children: result.remaining };
            }
            return node;
          });
          return { remaining, removed };
        };

        // Helper function to insert a node at a specific position
        const insertNode = (nodes: TreeNode[], nodeToInsert: TreeNode, targetParentId: string | null, position: number): TreeNode[] => {
          if (targetParentId === null) {
            // Insert at root level
            const newNodes = [...nodes];
            newNodes.splice(position, 0, nodeToInsert);
            return newNodes;
          } else {
            // Insert under a parent
            return nodes.map(node => {
              if (node.id === targetParentId) {
                const newChildren = [...(node.children || [])];
                newChildren.splice(position, 0, nodeToInsert);
                return { ...node, children: newChildren };
              }
              if (node.children) {
                return { ...node, children: insertNode(node.children, nodeToInsert, targetParentId, position) };
              }
              return node;
            });
          }
        };

        // Remove the node from its current position
        const { remaining, removed } = removeNode(prevData, dragId);

        if (!removed) {
          console.error("Could not find node to move");
          return prevData;
        }

        // Update the node's blockData with new parent info
        const updatedNode: TreeNode = {
          ...removed,
          blockData: removed.blockData ? {
            ...removed.blockData,
            parent_id: args.parentId || null,
            sort: args.index,
          } : undefined,
        };

        // Insert at the new position
        return insertNode(remaining, updatedNode, args.parentId, args.index);
      });
    } catch (error) {
      console.error("Failed to move block:", error);
      // Reload tree on error to restore original state
      await reloadTreeData();
    }
  };

  const loadPageContent = async (pageId: string) => {
    try {
      setIsLoadingContent(true);
      const blocksRes = await listBlocks(spaceId, { parentId: pageId });
      if (blocksRes.code !== 0) {
        console.error(blocksRes.message);
        return;
      }

      setContentBlocks(blocksRes.data || []);
    } catch (error) {
      console.error("Failed to load blocks:", error);
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleSelect = async (nodes: { data: TreeNode }[]) => {
    const node = nodes[0];
    if (!node) return;

    setSelectedNode(node.data);

    // If it's a page, load its non-page blocks for display
    if (node.data.type === "page") {
      await loadPageContent(node.data.id);
    }
  };

  const handleRefreshContent = async () => {
    if (!selectedNode || selectedNode.type !== "page") return;
    await loadPageContent(selectedNode.id);
  };

  // Reload tree data
  const reloadTreeData = async () => {
    try {
      const blocksRes = await listBlocks(spaceId);

      if (blocksRes.code !== 0) {
        console.error(blocksRes.message);
        return;
      }

      const blocks: TreeNode[] = (blocksRes.data || []).map((block) => {
        const isFolder = block.type === "folder";
        return {
          id: block.id,
          name: block.title || (isFolder ? "Untitled Folder" : "Untitled Page"),
          type: isFolder ? ("folder" as const) : ("page" as const),
          blockType: block.type,
          isLoaded: false,
          blockData: block,
        };
      });

      setTreeData(blocks);
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
    if (!itemToDelete) return;

    try {
      setIsDeleting(true);

      const res = await deleteBlock(spaceId, itemToDelete.id);

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
  const handleCreateClick = (
    type: "folder" | "page",
    parentId?: string | null
  ) => {
    setCreateType(type);
    setCreateParentId(parentId ?? null);
    setCreateTitle("");
    setCreateDialogOpen(true);
  };

  // Handle create
  const handleCreate = async () => {
    if (!createTitle.trim()) return;

    try {
      setIsCreating(true);

      const data = {
        type: createType,
        parent_id: createParentId || undefined,
        title: createTitle.trim(),
        props: {},
      };

      const res = await createBlock(spaceId, data);

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

  const handleGoBack = () => {
    router.push("/space");
  };

  // Handle block save (create or edit)
  const handleBlockSave = async (values: Record<string, string>) => {
    if (!selectedNode) return;

    try {
      setIsBlockSaving(true);

      if (blockEditor.mode === "create") {
        // Create new block
        const { title, ...propsFields } = values;
        const res = await createBlock(spaceId, {
          type: blockEditor.blockType,
          parent_id: selectedNode.id,
          title,
          props: propsFields,
        });

        if (res.code !== 0) {
          console.error(res.message);
          return;
        }
      } else {
        // Edit existing block - we need to get block ID from initialValues
        const blockId = (blockEditor.initialValues as Record<string, string>)._blockId;
        if (!blockId) return;

        const { title, ...propsFields } = values;
        const res = await updateBlockProperties(spaceId, blockId, {
          title,
          props: propsFields,
        });

        if (res.code !== 0) {
          console.error(res.message);
          return;
        }
      }

      // Reload content
      await loadPageContent(selectedNode.id);
      blockEditor.close();
    } catch (error) {
      console.error("Failed to save block:", error);
    } finally {
      setIsBlockSaving(false);
    }
  };

  // Handle create content block click
  const handleCreateContentClick = (type: string) => {
    blockEditor.openCreate(type);
  };

  // Handle edit block click
  const handleEditBlockClick = (block: Block) => {
    // Prepare initial values for the editor
    const initialValues: Record<string, string> = {
      title: block.title,
      _blockId: block.id, // Hidden field to store block ID
    };

    // Add block-specific props
    if (block.type === "sop" && typeof block.props?.preferences === "string") {
      initialValues.preferences = block.props.preferences;
    } else if (block.type === "text" && typeof block.props?.notes === "string") {
      initialValues.notes = block.props.notes;
    }

    blockEditor.openEdit(block.type, initialValues);
  };

  // Handle drag end for reordering blocks
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !selectedNode) {
      return;
    }

    const oldIndex = contentBlocks.findIndex((block) => block.id === active.id);
    const newIndex = contentBlocks.findIndex((block) => block.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistically update UI
    const newBlocks = arrayMove(contentBlocks, oldIndex, newIndex);
    setContentBlocks(newBlocks);

    try {
      // Call moveBlock API to update the order with new sort value
      const res = await moveBlock(spaceId, active.id as string, {
        parent_id: selectedNode.id,
        sort: newIndex,
      });

      if (res.code !== 0) {
        console.error("Failed to reorder block:", res.message);
        // Reload to get correct order
        await loadPageContent(selectedNode.id);
      }
    } catch (error) {
      console.error("Failed to reorder block:", error);
      // Reload to get correct order
      await loadPageContent(selectedNode.id);
    }
  };

  // Handle delete content block
  const handleDeleteContentBlock = async (blockId: string) => {
    if (!selectedNode) return;

    try {
      const res = await deleteBlock(spaceId, blockId);
      if (res.code !== 0) {
        console.error(res.message);
        return;
      }

      // Reload content
      await loadPageContent(selectedNode.id);
    } catch (error) {
      console.error("Failed to delete content block:", error);
    }
  };

  return (
    <div className="h-full bg-background p-6 flex flex-col overflow-hidden">
      <div className="mb-4 flex items-stretch gap-2 flex-shrink-0">
        <Button
          variant="outline"
          onClick={handleGoBack}
          className="rounded-l-md rounded-r-none h-auto px-3"
          title={t("backToSpaces") || "Back to Spaces"}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{t("pagesTitle") || "Pages"}</h1>
          <p className="text-sm text-muted-foreground">
            Space: <span className="font-mono">{spaceInfo}</span>
          </p>
        </div>
      </div>

      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        {/* Left: Page Tree */}
        <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
          <div className="h-full flex flex-col pr-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {t("pagesTitle") || "Pages"}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={reloadTreeData}
                disabled={isInitialLoading}
                title={t("refresh")}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-auto">
              {isInitialLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {t("loadingPages")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  {/* Root directory with create buttons */}
                  <div className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent transition-colors group mb-2">
                    <div className="flex items-center gap-1.5">
                      <FolderOpen className="h-4 w-4 shrink-0 text-blue-500" />
                      <span className="text-sm font-medium">
                        /
                      </span>
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
                        onMove={handleMove}
                        disableDrag={false}
                        disableDrop={false}
                        idAccessor="id"
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

        {/* Right: Content Display */}
        <ResizablePanel>
          <div className="h-full overflow-auto pl-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("contentTitle")}</h2>
              <div className="flex gap-2">
                {/* TODO: Hidden for now */}
                {selectedNode && selectedNode.type === "page" && false && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isLoadingContent}
                      >
                        <Plus className="h-4 w-4" />
                        {t("addBlock")}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {DEFAULT_BLOCK_CONFIGS.map((config) => (
                        <DropdownMenuItem
                          key={config.type}
                          onClick={() => handleCreateContentClick(config.type)}
                        >
                          <Plus className="h-4 w-4" />
                          <div>
                            <div className="font-medium">{config.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {config.description}
                            </div>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefreshContent}
                  disabled={!selectedNode || selectedNode.type !== "page" || isLoadingContent}
                  title={t("refresh")}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {!selectedNode ? (
              <div className="rounded-md border bg-card p-6">
                <p className="text-sm text-muted-foreground">
                  {t("selectPagePrompt")}
                </p>
              </div>
            ) : isLoadingContent ? (
              <div className="rounded-md border bg-card flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <div className="space-y-4">
                  {contentBlocks.length === 0 ? (
                    <div className="rounded-md border bg-card p-6">
                      <p className="text-sm text-muted-foreground text-center">
                        {t("noBlocks")}
                      </p>
                    </div>
                  ) : (
                    <SortableContext
                      items={contentBlocks.map((block) => block.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {contentBlocks.map((block, index) => (
                        <SortableBlockItem
                          key={block.id}
                          block={block}
                          index={index}
                          onEdit={handleEditBlockClick}
                          onDelete={handleDeleteContentBlock}
                          t={t}
                        />
                      ))}
                    </SortableContext>
                  )}
                </div>
              </DndContext>
            )}
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

      {/* Block Editor */}
      <BlockEditor
        mode={blockEditor.mode}
        blockType={blockEditor.blockType}
        initialValues={blockEditor.initialValues}
        onSave={handleBlockSave}
        onCancel={blockEditor.close}
        open={blockEditor.isOpen}
        isLoading={isBlockSaving}
        translations={{
          cancel: t("cancel"),
          save: t("save"),
          saving: t("saving"),
          create: t("create"),
          creating: t("creating"),
        }}
      />

    </div>
  );
}

