"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { encodeId } from "@/lib/id-codec";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileTreeViewer } from "@/components/file-tree";
import type { TreeNode } from "@/components/file-tree";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Download,
  Info,
} from "lucide-react";
import { useTopNavStore } from "@/stores/top-nav";
import type { Organization, Project, AgentSkill, AgentSkillFileIndex } from "@/types";
import { getAgentSkill, deleteAgentSkill, getAgentSkillFile } from "../actions";
import { toast } from "sonner";

interface SkillTreeNode extends TreeNode {
  skillId?: string;
  fileInfo?: AgentSkillFileIndex;
}

function fileIndexToTreeNodes(
  skillId: string,
  fileIndex: AgentSkillFileIndex[]
): SkillTreeNode[] {
  const rootChildren: SkillTreeNode[] = [];
  const folderMap = new Map<string, SkillTreeNode>();

  for (const file of fileIndex) {
    const parts = file.path.split("/").filter(Boolean);
    let currentPath = "";
    let currentChildren = rootChildren;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      currentPath += "/" + part;

      if (isLast) {
        currentChildren.push({
          id: `${skillId}:${file.path}`,
          name: part,
          type: "file",
          path: file.path,
          skillId,
          fileInfo: file,
        });
      } else {
        let folder = folderMap.get(currentPath);
        if (!folder) {
          folder = {
            id: `${skillId}:folder:${currentPath}`,
            name: part,
            type: "folder",
            path: currentPath,
            children: [],
            isLoaded: true,
            isOpen: false,
            skillId,
          };
          folderMap.set(currentPath, folder);
          currentChildren.push(folder);
        }
        currentChildren = folder.children! as SkillTreeNode[];
      }
    }
  }

  return rootChildren;
}

interface AgentSkillDetailClientProps {
  project: Project;
  currentOrganization: Organization;
  allOrganizations: Organization[];
  projects: Project[];
  skillId: string;
}

export function AgentSkillDetailClient({
  project,
  currentOrganization,
  allOrganizations,
  projects,
  skillId,
}: AgentSkillDetailClientProps) {
  const { initialize, setHasSidebar } = useTopNavStore();
  const router = useRouter();
  const encodedProjectId = encodeId(project.id);

  const [skill, setSkill] = useState<AgentSkill | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Tree state
  const [treeData, setTreeData] = useState<SkillTreeNode[]>([]);
  const [loadingNodes] = useState<Set<string>>(new Set());
  const [isTreeLoading, setIsTreeLoading] = useState(true);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<SkillTreeNode | null>(null);

  // Content state
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileContentType, setFileContentType] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    initialize({
      title: "",
      organization: currentOrganization,
      project,
      organizations: allOrganizations,
      projects,
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

  const loadSkill = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getAgentSkill(project.id, skillId);
      setSkill(data);
    } catch (error) {
      console.error("Failed to load agent skill:", error);
      toast.error("Failed to load agent skill");
    } finally {
      setIsLoading(false);
    }
  }, [project.id, skillId]);

  useEffect(() => {
    loadSkill();
  }, [loadSkill]);

  const loadSkillFiles = useCallback(async () => {
    setIsTreeLoading(true);
    setTreeError(null);
    setTreeData([]);
    setSelectedFile(null);

    try {
      const skillDetails = await getAgentSkill(project.id, skillId);
      const children = fileIndexToTreeNodes(
        skillId,
        skillDetails.file_index || []
      );
      setTreeData(children);

      const findSkillMd = (nodes: SkillTreeNode[]): SkillTreeNode | undefined => {
        for (const node of nodes) {
          if (node.type === "file" && node.name.toLowerCase() === "skill.md") {
            return node;
          }
          if (node.children) {
            const found = findSkillMd(node.children as SkillTreeNode[]);
            if (found) return found;
          }
        }
        return undefined;
      };

      const skillMdNode = findSkillMd(children);
      if (skillMdNode) {
        setSelectedFile(skillMdNode);
      }
    } catch (error) {
      console.error("Failed to load skill files:", error);
      setTreeError("Failed to load skill files");
    } finally {
      setIsTreeLoading(false);
    }
  }, [project.id, skillId]);

  useEffect(() => {
    loadSkillFiles();
  }, [loadSkillFiles]);

  // Auto-load preview when file selection changes
  useEffect(() => {
    setFileContent(null);
    setFileContentType(null);

    if (!selectedFile?.skillId || !selectedFile.fileInfo) return;

    let cancelled = false;

    const loadPreview = async () => {
      setIsLoadingContent(true);
      try {
        const res = await getAgentSkillFile(
          project.id,
          selectedFile.skillId!,
          selectedFile.fileInfo!.path
        );
        if (cancelled) return;
        if (res.content) {
          setFileContent(res.content.raw);
          setFileContentType(res.content.type);
        }
      } catch (error) {
        if (!cancelled) console.error("Failed to load preview:", error);
      } finally {
        if (!cancelled) setIsLoadingContent(false);
      }
    };

    loadPreview();
    return () => { cancelled = true; };
  }, [selectedFile, project.id]);

  const handleToggle = (nodeId: string) => {
    setTreeData((prevData) => {
      const updateNode = (nodes: SkillTreeNode[]): SkillTreeNode[] =>
        nodes.map((n) => {
          if (n.id === nodeId) {
            return { ...n, isOpen: !n.isOpen };
          }
          if (n.children) {
            return { ...n, children: updateNode(n.children as SkillTreeNode[]) };
          }
          return n;
        });
      return updateNode(prevData);
    });
  };

  const handleSelect = (node: SkillTreeNode) => {
    if (node.type === "file") {
      setSelectedFile(node);
    }
  };

  const handleGoBack = () => {
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get("returnTo");
    if (returnTo) {
      router.push(returnTo);
    } else {
      router.push(`/project/${encodedProjectId}/agent-skills`);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteAgentSkill(project.id, skillId);
      toast.success("Agent skill deleted successfully");
      router.push(`/project/${encodedProjectId}/agent-skills`);
    } catch (error) {
      console.error("Failed to delete agent skill:", error);
      toast.error("Failed to delete agent skill");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleDownloadNode = async (node: SkillTreeNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!node.skillId || !node.fileInfo) return;

    const fileId = node.id;
    setDownloadingFiles((prev) => new Set(prev).add(fileId));

    try {
      const res = await getAgentSkillFile(
        project.id,
        node.skillId,
        node.fileInfo.path,
        1800
      );

      if (res.url) {
        const link = document.createElement("a");
        link.href = res.url;
        link.download = node.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Download started");
      } else if (res.content) {
        const blob = new Blob([res.content.raw], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = node.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("Download started");
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

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!skill) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">Agent skill not found</p>
        <Button variant="outline" onClick={handleGoBack}>
          <ArrowLeft className="h-4 w-4" />
          Back to Agent Skills
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="h-full bg-background p-6 flex flex-col overflow-hidden space-y-2">
        <div className="shrink-0 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-stretch gap-2">
              <Button
                variant="outline"
                onClick={handleGoBack}
                className="rounded-l-md rounded-r-none h-auto px-3"
                title="Back to Agent Skills"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{skill.name}</h1>
                  <Badge variant="secondary">
                    {skill.file_index?.length || 0} files
                  </Badge>
                </div>
                {skill.description ? (
                  <p className="text-sm text-muted-foreground">
                    {skill.description}
                  </p>
                ) : null}
              </div>
            </div>

            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        <FileTreeViewer<SkillTreeNode>
          nodes={treeData}
          selectedNode={selectedFile}
          loadingNodes={loadingNodes}
          onToggle={handleToggle}
          onSelect={handleSelect}
          isTreeLoading={isTreeLoading}
          treeError={treeError}
          onRetryTree={loadSkillFiles}
          emptyMessage="No files in this skill"
          fileContent={fileContent}
          fileContentType={fileContentType}
          isLoadingContent={isLoadingContent}
          selectedFileName={selectedFile?.name}
          isMarkdownFile={selectedFile?.fileInfo?.mime.includes("text/markdown") ?? false}
          className="flex-1 min-h-0"
          renderActions={(node) => {
            if (node.type !== "file" || !node.fileInfo) return null;
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="p-0.5 rounded hover:bg-primary/10 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    className="[--tooltip-bg:var(--color-popover)] [--tooltip-border:var(--color-border)] bg-popover text-popover-foreground border shadow-md max-w-[280px]"
                  >
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Path</span>
                        <span className="font-mono truncate">
                          {node.fileInfo.path}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">MIME</span>
                        <span className="font-mono truncate">
                          {node.fileInfo.mime}
                        </span>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          }}
        />
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent Skill</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete agent skill{" "}
              <span className="font-semibold">{skill.name}</span>? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
