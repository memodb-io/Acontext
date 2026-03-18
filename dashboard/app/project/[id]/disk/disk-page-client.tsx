"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CodeEditor } from "@/components/code-editor";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { FileTreeViewer } from "@/components/file-tree";
import type { TreeNode } from "@/components/file-tree";
import {
  FolderOpen,
  Loader2,
  Download,
  Plus,
  Trash2,
  RefreshCw,
  Upload,
  Edit,
  ChevronsUpDown,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatBytes } from "@/lib/utils";
import { useTopNavStore } from "@/stores/top-nav";
import {
  Organization,
  Project,
  Disk,
  Artifact,
  ListArtifactsResp,
  User,
} from "@/types";
import {
  getDisks,
  getListArtifacts,
  getArtifact,
  createDisk,
  deleteDisk,
  uploadArtifact,
  deleteArtifact,
  updateArtifactMeta,
} from "./actions";
import { getAllUsers } from "../actions";
import { toast } from "sonner";

interface DiskTreeNode extends TreeNode {
  path: string;
  fileInfo?: Artifact;
}


interface DiskPageClientProps {
  project: Project;
  currentOrganization: Organization;
  allOrganizations: Organization[];
  projects: Project[];
}

export function DiskPageClient({
  project,
  currentOrganization,
  allOrganizations,
  projects,
}: DiskPageClientProps) {
  const { initialize, setHasSidebar } = useTopNavStore();
  const searchParams = useSearchParams();

  const [selectedFile, setSelectedFile] = useState<DiskTreeNode | null>(null);
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());
  const [treeData, setTreeData] = useState<DiskTreeNode[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(false);

  // Disk related states
  const [disks, setDisks] = useState<Disk[]>([]);
  const [selectedDisk, setSelectedDisk] = useState<Disk | null>(null);
  const [isLoadingDisks, setIsLoadingDisks] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [hasMoreDisks, setHasMoreDisks] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // File preview states
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileContentType, setFileContentType] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());

  // Delete confirmation dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [diskToDelete, setDiskToDelete] = useState<Disk | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Delete artifact confirmation dialog states
  const [deleteArtifactDialogOpen, setDeleteArtifactDialogOpen] = useState(false);
  const [artifactToDelete, setArtifactToDelete] = useState<DiskTreeNode | null>(null);
  const [isDeletingArtifact, setIsDeletingArtifact] = useState(false);

  // Upload artifact states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Upload dialog states
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadPath, setUploadPath] = useState<string>("/");
  const [initialUploadPath, setInitialUploadPath] = useState<string>("/");
  const [uploadMetaValue, setUploadMetaValue] = useState<string>("{}");
  const [uploadMetaError, setUploadMetaError] = useState<string>("");
  const [isUploadMetaValid, setIsUploadMetaValid] = useState(true);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);

  // Edit meta dialog states
  const [editMetaDialogOpen, setEditMetaDialogOpen] = useState(false);
  const [editMetaValue, setEditMetaValue] = useState<string>("{}");
  const [editMetaError, setEditMetaError] = useState<string>("");
  const [isEditMetaValid, setIsEditMetaValid] = useState(true);
  const [isUpdatingMeta, setIsUpdatingMeta] = useState(false);
  const [editMetaNode, setEditMetaNode] = useState<DiskTreeNode | null>(null);

  // Create disk states
  const [isCreating, setIsCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createUserValue, setCreateUserValue] = useState("");
  const [createUserOpen, setCreateUserOpen] = useState(false);

  // Refresh states
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter state
  const [filterText, setFilterText] = useState("");
  const [userFilter, setUserFilter] = useState<string>(() => {
    const userFromUrl = searchParams.get("user");
    return userFromUrl || "all";
  });

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const getUserIdentifier = (userId: string | undefined) => {
    if (!userId) return null;
    const user = users.find((u) => u.id === userId);
    return user?.identifier || userId;
  };

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

  const filteredDisks = disks.filter((disk) =>
    disk.id.toLowerCase().includes(filterText.toLowerCase())
  );

  const loadDisks = useCallback(async () => {
    try {
      setIsLoadingDisks(true);
      const userParam = userFilter === "all" ? undefined : userFilter;
      const res = await getDisks(project.id, 50, undefined, true, userParam);
      setDisks(res.items || []);
      setNextCursor(res.next_cursor);
      setHasMoreDisks(res.has_more || false);
    } catch (error) {
      console.error("Failed to load disks:", error);
      toast.error("Failed to load disks");
    } finally {
      setIsLoadingDisks(false);
    }
  }, [project.id, userFilter]);

  const loadMoreDisks = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    try {
      setIsLoadingMore(true);
      const userParam = userFilter === "all" ? undefined : userFilter;
      const res = await getDisks(project.id, 50, nextCursor, true, userParam);
      setDisks((prev) => [...prev, ...(res.items || [])]);
      setNextCursor(res.next_cursor);
      setHasMoreDisks(res.has_more || false);
    } catch (error) {
      console.error("Failed to load more disks:", error);
      toast.error("Failed to load more disks");
    } finally {
      setIsLoadingMore(false);
    }
  }, [project.id, nextCursor, userFilter, isLoadingMore]);

  const loadUsers = useCallback(async () => {
    try {
      setIsLoadingUsers(true);
      const allUsers = await getAllUsers(project.id);
      setUsers(allUsers);
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [project.id]);

  useEffect(() => { loadDisks(); }, [loadDisks]);
  useEffect(() => { loadUsers(); }, [loadUsers]);

  // Auto-select disk from URL query param (e.g. ?diskId=xxx)
  useEffect(() => {
    const diskId = searchParams.get("diskId");
    if (diskId && disks.length > 0 && !selectedDisk) {
      const target = disks.find((d) => d.id === diskId);
      if (target) {
        handleDiskSelect(target);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disks, searchParams]);

  const formatArtifacts = (
    path: string,
    res: ListArtifactsResp
  ): DiskTreeNode[] => {
    const artifacts: DiskTreeNode[] = res.artifacts.map((artifact) => ({
      id: `${artifact.path}${artifact.filename}`,
      name: artifact.filename,
      type: "file",
      path: artifact.path,
      isLoaded: false,
      fileInfo: artifact,
    }));
    const directories: DiskTreeNode[] = res.directories.map((directory) => ({
      id: `${path}${directory}/`,
      name: directory,
      type: "folder",
      path: `${path}${directory}/`,
      isLoaded: false,
      isOpen: false,
    }));
    return [...directories, ...artifacts];
  };

  const handleDiskSelect = async (disk: Disk) => {
    setSelectedDisk(disk);
    setTreeData([]);
    setSelectedFile(null);

    try {
      setIsInitialLoading(true);
      const res = await getListArtifacts(project.id, disk.id, "/");
      setTreeData(formatArtifacts("/", res));
    } catch (error) {
      console.error("Failed to load artifacts:", error);
      toast.error("Failed to load artifacts");
    } finally {
      setIsInitialLoading(false);
    }
  };

  const handleToggle = async (nodeId: string) => {
    if (!selectedDisk) return;

    const findNode = (nodes: DiskTreeNode[], id: string): DiskTreeNode | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          const found = findNode(node.children as DiskTreeNode[], id);
          if (found) return found;
        }
      }
      return null;
    };

    const node = findNode(treeData, nodeId);
    if (!node || node.type !== "folder") return;

    const isCurrentlyOpen = node.isOpen || false;
    const newOpenState = !isCurrentlyOpen;

    setTreeData((prevData) => {
      const updateNode = (nodes: DiskTreeNode[]): DiskTreeNode[] =>
        nodes.map((n) => {
          if (n.id === nodeId) return { ...n, isOpen: newOpenState };
          if (n.children) return { ...n, children: updateNode(n.children as DiskTreeNode[]) };
          return n;
        });
      return updateNode(prevData);
    });

    if (newOpenState && !node.isLoaded) {
      setLoadingNodes((prev) => new Set(prev).add(nodeId));

      try {
        const res = await getListArtifacts(project.id, selectedDisk.id, node.path);
        const files = formatArtifacts(node.path, res);

        setTreeData((prevData) => {
          const updateNode = (nodes: DiskTreeNode[]): DiskTreeNode[] =>
            nodes.map((n) => {
              if (n.id === nodeId) return { ...n, children: files, isLoaded: true, isOpen: newOpenState };
              if (n.children) return { ...n, children: updateNode(n.children as DiskTreeNode[]) };
              return n;
            });
          return updateNode(prevData);
        });
      } catch (error) {
        console.error("Failed to load children:", error);
        toast.error("Failed to load directory");
        setTreeData((prevData) => {
          const updateNode = (nodes: DiskTreeNode[]): DiskTreeNode[] =>
            nodes.map((n) => {
              if (n.id === nodeId) return { ...n, isOpen: false };
              if (n.children) return { ...n, children: updateNode(n.children as DiskTreeNode[]) };
              return n;
            });
          return updateNode(prevData);
        });
      } finally {
        setLoadingNodes((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
      }
    }
  };

  const handleSelect = (node: DiskTreeNode) => {
    if (node.type === "file") {
      setSelectedFile(node);
    }
  };

  // Auto-load preview when file selection changes
  useEffect(() => {
    setImageUrl(null);
    setFileContent(null);
    setFileContentType(null);

    if (!selectedFile?.fileInfo || !selectedDisk) return;

    let cancelled = false;

    const loadPreview = async () => {
      setIsLoadingPreview(true);
      try {
        const res = await getArtifact(
          project.id,
          selectedDisk.id,
          `${selectedFile.path}${selectedFile.fileInfo!.filename}`,
          true
        );
        if (cancelled) return;
        setImageUrl(res.public_url || null);
        if (res.content) {
          setFileContent(res.content.raw);
          setFileContentType(res.content.type);
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
  }, [selectedFile, selectedDisk?.id, project.id]);

  // Inline download handler
  const handleDownloadNode = async (node: DiskTreeNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedDisk || !node.fileInfo) return;

    const fileId = node.id;
    setDownloadingFiles((prev) => new Set(prev).add(fileId));

    try {
      const res = await getArtifact(
        project.id,
        selectedDisk.id,
        `${node.path}${node.fileInfo.filename}`,
        false
      );
      const downloadUrl = res.public_url;
      if (downloadUrl) {
        window.open(downloadUrl, "_blank");
      }
    } catch (error) {
      console.error("Failed to download file:", error);
      toast.error("Failed to download file");
    } finally {
      setDownloadingFiles((prev) => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
    }
  };

  // Inline delete handler
  const handleDeleteArtifactNode = (node: DiskTreeNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setArtifactToDelete(node);
    setDeleteArtifactDialogOpen(true);
  };

  const handleDeleteArtifact = async () => {
    if (!artifactToDelete || !selectedDisk || !artifactToDelete.fileInfo) return;

    try {
      setIsDeletingArtifact(true);
      const fullPath = `${artifactToDelete.path}${artifactToDelete.fileInfo.filename}`;
      await deleteArtifact(project.id, selectedDisk.id, fullPath);

      if (selectedFile?.id === artifactToDelete.id) {
        setSelectedFile(null);
      }

      const getParentPath = (path: string): string | null => {
        if (path === "/") return null;
        const normalizedPath = path.endsWith("/") ? path.slice(0, -1) : path;
        const lastSlashIndex = normalizedPath.lastIndexOf("/");
        if (lastSlashIndex <= 0) return "/";
        return normalizedPath.substring(0, lastSlashIndex + 1);
      };

      const reloadDirectoryRecursively = async (currentPath: string): Promise<void> => {
        if (!selectedDisk) return;

        const filesRes = await getListArtifacts(project.id, selectedDisk.id, currentPath);
        const files = formatArtifacts(currentPath, filesRes);
        const isEmpty = files.length === 0;

        if (currentPath === "/") {
          setTreeData(files);
          return;
        }

        setTreeData((prevData) => {
          const updateNode = (nodes: DiskTreeNode[]): DiskTreeNode[] =>
            nodes.map((n) => {
              if (n.path === currentPath) return { ...n, children: files, isLoaded: true };
              if (n.children) return { ...n, children: updateNode(n.children as DiskTreeNode[]) };
              return n;
            });
          return updateNode(prevData);
        });

        if (isEmpty) {
          const parentPath = getParentPath(currentPath);
          if (parentPath !== null) {
            await reloadDirectoryRecursively(parentPath);
          }
        }
      };

      await reloadDirectoryRecursively(artifactToDelete.path);
      toast.success("File deleted successfully");
    } catch (error) {
      console.error("Failed to delete file:", error);
      toast.error("Failed to delete file");
    } finally {
      setIsDeletingArtifact(false);
      setDeleteArtifactDialogOpen(false);
      setArtifactToDelete(null);
    }
  };

  // Inline edit meta handler
  const handleEditMetaNode = (node: DiskTreeNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!node.fileInfo) return;

    setEditMetaNode(node);
    const meta = node.fileInfo.meta || {};
    const userMeta = Object.fromEntries(
      Object.entries(meta).filter(([key]) => key !== "__artifact_info__")
    );
    setEditMetaValue(JSON.stringify(userMeta, null, 2));
    setEditMetaError("");
    setIsEditMetaValid(true);
    setEditMetaDialogOpen(true);
  };

  // --- Disk-level handlers ---

  const handleOpenCreateDialog = () => {
    setCreateUserValue("");
    setCreateUserOpen(false);
    setCreateDialogOpen(true);
  };

  const handleCreateDisk = async () => {
    try {
      setIsCreating(true);
      const userParam = createUserValue.trim() || undefined;
      const newDisk = await createDisk(project.id, userParam);
      await loadDisks();
      await loadUsers();
      setSelectedDisk(newDisk);
      handleDiskSelect(newDisk);
      setCreateDialogOpen(false);
      toast.success("Disk created successfully");
    } catch (error) {
      console.error("Failed to create disk:", error);
      toast.error("Failed to create disk");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteClick = (disk: Disk, e: React.MouseEvent) => {
    e.stopPropagation();
    setDiskToDelete(disk);
    setDeleteDialogOpen(true);
  };

  const handleDeleteDisk = async () => {
    if (!diskToDelete) return;
    try {
      setIsDeleting(true);
      await deleteDisk(project.id, diskToDelete.id);
      if (selectedDisk?.id === diskToDelete.id) {
        setSelectedDisk(null);
        setTreeData([]);
        setSelectedFile(null);
      }
      await loadDisks();
      toast.success("Disk deleted successfully");
    } catch (error) {
      console.error("Failed to delete disk:", error);
      toast.error("Failed to delete disk");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDiskToDelete(null);
    }
  };

  const handleRefreshDisks = async () => {
    try {
      setIsRefreshing(true);
      setSelectedFile(null);
      setImageUrl(null);
      await loadDisks();
      if (selectedDisk) {
        setTreeData([]);
        const res = await getListArtifacts(project.id, selectedDisk.id, "/");
        setTreeData(formatArtifacts("/", res));
      }
    } catch (error) {
      console.error("Failed to refresh:", error);
      toast.error("Failed to refresh");
    } finally {
      setIsRefreshing(false);
    }
  };

  const validateJSON = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    try { JSON.parse(trimmed); return true; } catch { return false; }
  };

  const handleUploadMetaChange = (value: string) => {
    setUploadMetaValue(value);
    const isValid = validateJSON(value);
    setIsUploadMetaValid(isValid);
    if (!isValid && value.trim()) {
      try { JSON.parse(value.trim()); } catch (error) {
        if (error instanceof SyntaxError) setUploadMetaError("Invalid JSON: " + error.message);
      }
    } else {
      setUploadMetaError("");
    }
  };

  const handleUploadClick = (path: string = "/") => {
    setUploadPath(path);
    setInitialUploadPath(path);
    setUploadMetaValue("{}");
    setUploadMetaError("");
    setIsUploadMetaValid(true);
    setSelectedUploadFile(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setSelectedUploadFile(files[0]);
    setUploadDialogOpen(true);
  };

  const handleUploadConfirm = async () => {
    if (!selectedUploadFile || !selectedDisk) return;

    let meta: Record<string, string> | undefined;
    const trimmedMetaValue = uploadMetaValue.trim();

    if (trimmedMetaValue && trimmedMetaValue !== "{}") {
      try {
        meta = JSON.parse(trimmedMetaValue);
        setUploadMetaError("");
      } catch (error) {
        if (error instanceof SyntaxError) setUploadMetaError("Invalid JSON: " + error.message);
        else setUploadMetaError(String(error));
        return;
      }
    }

    try {
      setIsUploading(true);
      setUploadDialogOpen(false);

      await uploadArtifact(project.id, selectedDisk.id, uploadPath, selectedUploadFile, meta);

      const refreshDir = async (path: string) => {
        const findNodeByPath = (nodes: DiskTreeNode[], targetPath: string): DiskTreeNode | null => {
          for (const node of nodes) {
            if (node.path === targetPath && node.type === "folder") return node;
            if (node.children) { const found = findNodeByPath(node.children as DiskTreeNode[], targetPath); if (found) return found; }
          }
          return null;
        };
        const updateNodeInTree = (nodes: DiskTreeNode[], targetPath: string, newChildren: DiskTreeNode[]): DiskTreeNode[] =>
          nodes.map((n) => {
            if (n.path === targetPath && n.type === "folder") return { ...n, children: newChildren, isLoaded: true, isOpen: true };
            if (n.children) return { ...n, children: updateNodeInTree(n.children as DiskTreeNode[], targetPath, newChildren) };
            return n;
          });

        if (path === "/") {
          const res = await getListArtifacts(project.id, selectedDisk.id, "/");
          setTreeData(formatArtifacts("/", res));
        } else {
          const targetNode = findNodeByPath(treeData, path);
          if (targetNode) {
            const res = await getListArtifacts(project.id, selectedDisk.id, path);
            const files = formatArtifacts(path, res);
            setTreeData((prevData) => updateNodeInTree(prevData, path, files));
          } else {
            const res = await getListArtifacts(project.id, selectedDisk.id, "/");
            setTreeData(formatArtifacts("/", res));
          }
        }
      };

      await refreshDir(uploadPath);
      toast.success("File uploaded successfully");
    } catch (error) {
      console.error("Failed to upload file:", error);
      toast.error("Failed to upload file");
    } finally {
      setIsUploading(false);
      setSelectedUploadFile(null);
      setUploadMetaValue("{}");
      setUploadMetaError("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUploadCancel = () => {
    setUploadDialogOpen(false);
    setSelectedUploadFile(null);
    setUploadMetaValue("{}");
    setUploadMetaError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleEditMetaChange = (value: string) => {
    setEditMetaValue(value);
    const isValid = validateJSON(value);
    setIsEditMetaValid(isValid);
    if (!isValid && value.trim()) {
      try { JSON.parse(value.trim()); } catch (error) {
        if (error instanceof SyntaxError) setEditMetaError("Invalid JSON: " + error.message);
      }
    } else {
      setEditMetaError("");
    }
  };

  const handleEditMetaConfirm = async () => {
    const targetNode = editMetaNode;
    if (!targetNode || !selectedDisk || !targetNode.fileInfo) return;

    let meta: Record<string, unknown>;
    try {
      meta = JSON.parse(editMetaValue.trim());
      setEditMetaError("");
    } catch (error) {
      if (error instanceof SyntaxError) setEditMetaError("Invalid JSON: " + error.message);
      else setEditMetaError(String(error));
      return;
    }

    try {
      setIsUpdatingMeta(true);
      setEditMetaDialogOpen(false);

      const fullPath = `${targetNode.path}${targetNode.fileInfo.filename}`;
      await updateArtifactMeta(project.id, selectedDisk.id, fullPath, meta);

      setTreeData([]);
      const res = await getListArtifacts(project.id, selectedDisk.id, "/");
      setTreeData(formatArtifacts("/", res));

      setSelectedFile(null);
      setImageUrl(null);
      setFileContent(null);
      setFileContentType(null);
      toast.success("Metadata updated successfully");
    } catch (error) {
      console.error("Failed to update metadata:", error);
      toast.error("Failed to update metadata");
    } finally {
      setIsUpdatingMeta(false);
      setEditMetaValue("{}");
      setEditMetaError("");
      setEditMetaNode(null);
    }
  };

  const handleEditMetaCancel = () => {
    setEditMetaDialogOpen(false);
    setEditMetaValue("{}");
    setEditMetaError("");
    setEditMetaNode(null);
  };

  const isImageFile = !!(
    selectedFile?.fileInfo?.meta?.__artifact_info__?.mime?.startsWith("image/")
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />

      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Disk List Panel */}
        <ResizablePanel defaultSize={25} minSize={15} maxSize={35}>
          <div className="h-full bg-background p-4 flex flex-col">
            <div className="mb-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Disks</h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleOpenCreateDialog}
                    disabled={isCreating || isLoadingDisks}
                    title="Create Disk"
                  >
                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleRefreshDisks}
                    disabled={isRefreshing || isLoadingDisks}
                    title="Refresh"
                  >
                    {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter by User" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.identifier}>
                      {user.identifier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="text"
                placeholder="Filter by ID..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="flex-1 overflow-auto">
              {isLoadingDisks ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading disks...</p>
                  </div>
                </div>
              ) : filteredDisks.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">
                    {disks.length === 0 ? "No disks" : "No matching disks"}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {filteredDisks.map((disk) => {
                      const isSelected = selectedDisk?.id === disk.id;
                      return (
                        <div
                          key={disk.id}
                          className={cn(
                            "relative rounded-md border p-3 cursor-pointer transition-colors hover:bg-accent",
                            isSelected && "bg-accent border-primary"
                          )}
                          onClick={() => handleDiskSelect(disk)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" title={disk.id}>
                                {disk.id}
                              </p>
                              <div className="flex items-center justify-between mt-1">
                                <p className="text-xs text-muted-foreground">
                                  {new Date(disk.created_at).toLocaleString()}
                                </p>
                                {isLoadingUsers ? (
                                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-2" />
                                ) : disk.user_id ? (
                                  <p className="text-xs text-muted-foreground truncate ml-2 max-w-[120px]" title={getUserIdentifier(disk.user_id) || ""}>
                                    {getUserIdentifier(disk.user_id)}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => handleDeleteClick(disk, e)}>
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {hasMoreDisks && !filterText && (
                    <div className="p-4 flex justify-center">
                      <Button variant="outline" onClick={loadMoreDisks} disabled={isLoadingMore}>
                        {isLoadingMore ? (<><Loader2 className="h-4 w-4 animate-spin" />Loading...</>) : "Load More"}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />

        {/* FileTreeViewer replaces old File Tree + Content panels */}
        <ResizablePanel defaultSize={75}>
          {!selectedDisk ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Select a disk to view files</p>
            </div>
          ) : (
            <FileTreeViewer<DiskTreeNode>
              nodes={treeData}
              selectedNode={selectedFile}
              loadingNodes={loadingNodes}
              onToggle={handleToggle}
              onSelect={handleSelect}
              isTreeLoading={isInitialLoading}
              emptyMessage="No files in this disk"
              fileContent={fileContent}
              fileContentType={fileContentType}
              imageUrl={imageUrl}
              isImageFile={isImageFile}
              imageName={selectedFile?.fileInfo?.filename}
              isLoadingContent={isLoadingPreview}
              selectedFileName={selectedFile?.fileInfo?.filename}
              isMarkdownFile={selectedFile?.fileInfo?.meta?.__artifact_info__?.mime?.includes("text/markdown") ?? false}
              className="h-full"
              treeHeader={
                <div className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors group">
                  <div className="flex items-center gap-1.5">
                    <FolderOpen className="h-4 w-4 shrink-0 text-blue-500" />
                    <span className="text-sm">/</span>
                  </div>
                  <button
                    className="shrink-0 p-1 rounded-md bg-primary/10 hover:bg-primary/20 opacity-0 group-hover:opacity-100 transition-all"
                    onClick={() => handleUploadClick("/")}
                    disabled={isUploading}
                    title="Upload to root"
                  >
                    {isUploading ? (
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    ) : (
                      <Upload className="h-3 w-3 text-primary" />
                    )}
                  </button>
                </div>
              }
              renderActions={(node) => {
                if (node.type === "folder") {
                  return (
                    <div
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "shrink-0 p-1 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer",
                        isUploading && "pointer-events-none opacity-50"
                      )}
                      onClick={(e) => { e.stopPropagation(); if (!isUploading) handleUploadClick(node.path); }}
                      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !isUploading) { e.preventDefault(); e.stopPropagation(); handleUploadClick(node.path); } }}
                      aria-disabled={isUploading}
                      title="Upload to folder"
                    >
                      {isUploading ? (
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      ) : (
                        <Upload className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  );
                }

                if (!node.fileInfo) return null;
                const isDownloading = downloadingFiles.has(node.id);
                return (
                  <div className="flex items-center gap-0.5">
                    <button
                      className="p-0.5 rounded hover:bg-primary/10 transition-colors"
                      onClick={(e) => handleDownloadNode(node, e)}
                      disabled={isDownloading}
                      title="Download"
                    >
                      {isDownloading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      ) : (
                        <Download className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="p-0.5 rounded hover:bg-primary/10 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => handleEditMetaNode(node, e)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Meta
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => handleDeleteArtifactNode(node, e)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1.5 space-y-1.5 text-xs">
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">MIME</span>
                            <span className="font-mono truncate">{node.fileInfo.meta?.__artifact_info__?.mime ?? "-"}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Size</span>
                            <span className="font-mono">{node.fileInfo.meta?.__artifact_info__?.size != null ? formatBytes(node.fileInfo.meta.__artifact_info__.size) : "-"}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Path</span>
                            <span className="font-mono truncate">{node.fileInfo.path}{node.fileInfo.filename}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Created</span>
                            <span>{new Date(node.fileInfo.created_at).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Updated</span>
                            <span>{new Date(node.fileInfo.updated_at).toLocaleString()}</span>
                          </div>
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              }}
            />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Delete disk dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Disk</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete disk{" "}
              <span className="font-mono font-semibold">{diskToDelete?.id}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDisk} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? (<><Loader2 className="h-4 w-4 animate-spin" />Deleting...</>) : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete file dialog */}
      <AlertDialog open={deleteArtifactDialogOpen} onOpenChange={setDeleteArtifactDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete file{" "}
              <span className="font-mono font-semibold">{artifactToDelete?.fileInfo?.filename}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingArtifact}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteArtifact} disabled={isDeletingArtifact} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeletingArtifact ? (<><Loader2 className="h-4 w-4 animate-spin" />Deleting...</>) : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upload file dialog */}
      <AlertDialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Upload File</AlertDialogTitle>
            <AlertDialogDescription>Upload a file to the selected directory</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Selected File</label>
              <div className="text-sm bg-muted px-3 py-2 rounded-md font-mono">{selectedUploadFile?.name || "No file selected"}</div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Upload Path</label>
              <Input type="text" value={uploadPath} onChange={(e) => setUploadPath(e.target.value)} placeholder="/path/to/file" className="font-mono" disabled={initialUploadPath !== "/"} />
              <p className="text-xs text-muted-foreground mt-1">{initialUploadPath === "/" ? "You can edit the upload path" : "Upload path is locked to the selected folder"}</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Metadata (JSON)</label>
              <CodeEditor value={uploadMetaValue} height="200px" language="json" onChange={handleUploadMetaChange} placeholder='{"key": "value"}' />
              {uploadMetaError && <p className="mt-2 text-sm text-destructive">{uploadMetaError}</p>}
              <p className="text-xs text-muted-foreground mt-1">Enter metadata as JSON object</p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleUploadCancel} disabled={isUploading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUploadConfirm} disabled={isUploading || !selectedUploadFile || !isUploadMetaValid}>
              {isUploading ? (<><Loader2 className="h-4 w-4 animate-spin" />Uploading...</>) : (<><Upload className="h-4 w-4" />Upload</>)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit meta dialog */}
      <AlertDialog open={editMetaDialogOpen} onOpenChange={setEditMetaDialogOpen}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Metadata</AlertDialogTitle>
            <AlertDialogDescription>Edit the metadata for this file</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Selected File</label>
              <div className="text-sm bg-muted px-3 py-2 rounded-md font-mono">{editMetaNode?.fileInfo?.filename || "No file selected"}</div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Metadata (JSON)</label>
              <CodeEditor value={editMetaValue} height="300px" language="json" onChange={handleEditMetaChange} placeholder='{"key": "value"}' />
              {editMetaError && <p className="mt-2 text-sm text-destructive">{editMetaError}</p>}
              <p className="text-xs text-muted-foreground mt-1">Enter metadata as JSON object</p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleEditMetaCancel} disabled={isUpdatingMeta}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleEditMetaConfirm} disabled={isUpdatingMeta || !isEditMetaValid}>
              {isUpdatingMeta ? (<><Loader2 className="h-4 w-4 animate-spin" />Updating...</>) : (<><Edit className="h-4 w-4" />Update</>)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Disk Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Disk</DialogTitle>
            <DialogDescription>Create a new disk. Optionally associate it with a user.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>User Identifier (Optional)</Label>
              <InputGroup>
                <InputGroupInput
                  value={createUserValue}
                  onChange={(e) => setCreateUserValue(e.target.value)}
                  placeholder="Select an existing user or type a new identifier"
                />
                <InputGroupAddon align="inline-end">
                  <Popover open={createUserOpen} onOpenChange={setCreateUserOpen}>
                    <PopoverTrigger asChild>
                      <InputGroupButton variant="outline" size="icon-xs">
                        <ChevronsUpDown className="h-4 w-4" />
                      </InputGroupButton>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="end">
                      <Command>
                        <CommandList>
                          <CommandGroup>
                            {users.map((user) => (
                              <CommandItem key={user.id} value={user.identifier} onSelect={(value) => { setCreateUserValue(value); setCreateUserOpen(false); }}>
                                {user.identifier}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </InputGroupAddon>
              </InputGroup>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={isCreating}>Cancel</Button>
            <Button onClick={handleCreateDisk} disabled={isCreating}>
              {isCreating ? (<><Loader2 className="h-4 w-4 animate-spin" />Creating...</>) : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
