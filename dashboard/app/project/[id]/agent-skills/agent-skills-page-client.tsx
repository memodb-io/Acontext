"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
import { SkillList, type SkillItem } from "@/components/skill-list";
import {
  Loader2,
  RefreshCw,
  Upload,
  ChevronsUpDown,
} from "lucide-react";
import { useTopNavStore } from "@/stores/top-nav";
import { PaginationBar } from "@/components/pagination-bar";
import {
  Organization,
  Project,
  AgentSkillListItem,
  User,
} from "@/types";
import {
  getAgentSkills,
  deleteAgentSkill,
  createAgentSkill,
} from "./actions";
import { getAllUsers } from "../actions";
import { toast } from "sonner";

const PAGE_SIZE = 20;

interface AgentSkillsPageClientProps {
  project: Project;
  currentOrganization: Organization;
  allOrganizations: Organization[];
  projects: Project[];
}

export function AgentSkillsPageClient({
  project,
  currentOrganization,
  allOrganizations,
  projects,
}: AgentSkillsPageClientProps) {
  const { initialize, setHasSidebar } = useTopNavStore();
  const router = useRouter();
  const encodedProjectId = encodeId(project.id);

  const [skills, setSkills] = useState<AgentSkillListItem[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [skillToDelete, setSkillToDelete] = useState<AgentSkillListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadMetaValue, setUploadMetaValue] = useState<string>("{}");
  const [uploadMetaError, setUploadMetaError] = useState<string>("");
  const [isUploadMetaValid, setIsUploadMetaValid] = useState(true);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [uploadUserValue, setUploadUserValue] = useState("");
  const [uploadUserOpen, setUploadUserOpen] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const [filterText, setFilterText] = useState("");
  const [userFilter, setUserFilter] = useState<string>("all");

  const [users, setUsers] = useState<User[]>([]);

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

  const loadSkills = useCallback(async () => {
    try {
      setIsLoadingSkills(true);
      const userParam = userFilter === "all" ? undefined : userFilter;

      const first = await getAgentSkills(project.id, 50, undefined, true, userParam);
      setSkills(first.items || []);
      setCurrentPage(1);
      setIsLoadingSkills(false);

      if (first.has_more) {
        setIsLoadingMore(true);
        let cursor = first.next_cursor;
        while (cursor) {
          const res = await getAgentSkills(project.id, 50, cursor, true, userParam);
          setSkills(prev => [...prev, ...(res.items || [])]);
          cursor = res.has_more ? res.next_cursor : undefined;
        }
        setIsLoadingMore(false);
      }
    } catch (error) {
      console.error("Failed to load skills:", error);
      toast.error("Failed to load agent skills");
      setIsLoadingSkills(false);
      setIsLoadingMore(false);
    }
  }, [project.id, userFilter]);

  const loadUsers = useCallback(async () => {
    try {
      const allUsers = await getAllUsers(project.id);
      setUsers(allUsers);
    } catch (error) {
      console.error("Failed to load users:", error);
    }
  }, [project.id]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredSkills = filterText
    ? skills.filter((s) =>
        s.name.toLowerCase().includes(filterText.toLowerCase())
      )
    : skills;

  const totalPages = Math.ceil(filteredSkills.length / PAGE_SIZE);
  const paginatedSkills = filteredSkills.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleSkillClick = (skill: SkillItem) => {
    const encodedSkillId = encodeId(skill.id);
    router.push(`/project/${encodedProjectId}/agent-skills/${encodedSkillId}`);
  };

  const handleSkillDelete = (skill: SkillItem) => {
    setSkillToDelete(skill as AgentSkillListItem);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!skillToDelete) return;

    try {
      setIsDeleting(true);
      await deleteAgentSkill(project.id, skillToDelete.id);
      await loadSkills();
      toast.success("Agent skill deleted successfully");
    } catch (error) {
      console.error("Failed to delete agent skill:", error);
      toast.error("Failed to delete agent skill");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setSkillToDelete(null);
    }
  };

  const handleRefreshSkills = async () => {
    try {
      setIsRefreshing(true);
      await loadSkills();
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
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  };

  const handleUploadMetaChange = (value: string) => {
    setUploadMetaValue(value);
    const isValid = validateJSON(value);
    setIsUploadMetaValid(isValid);
    if (!isValid && value.trim()) {
      try {
        JSON.parse(value.trim());
      } catch (error) {
        if (error instanceof SyntaxError) {
          setUploadMetaError("Invalid JSON: " + error.message);
        }
      }
    } else {
      setUploadMetaError("");
    }
  };

  const handleUploadClick = () => {
    setUploadMetaValue("{}");
    setUploadMetaError("");
    setIsUploadMetaValid(true);
    setSelectedUploadFile(null);
    setUploadUserValue("");
    setUploadUserOpen(false);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    if (!file.name.endsWith(".zip")) {
      toast.error("Please select a ZIP file");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setSelectedUploadFile(file);
    setUploadDialogOpen(true);
  };

  const handleUploadConfirm = async () => {
    if (!selectedUploadFile) return;

    let meta: Record<string, unknown> | undefined;
    const trimmedMetaValue = uploadMetaValue.trim();

    if (trimmedMetaValue && trimmedMetaValue !== "{}") {
      try {
        meta = JSON.parse(trimmedMetaValue);
        setUploadMetaError("");
      } catch (error) {
        if (error instanceof SyntaxError) {
          setUploadMetaError("Invalid JSON: " + error.message);
        } else {
          setUploadMetaError(String(error));
        }
        return;
      }
    }

    try {
      setIsUploading(true);
      setUploadDialogOpen(false);

      const userParam = uploadUserValue.trim() || undefined;
      await createAgentSkill(project.id, selectedUploadFile, userParam, meta);

      await loadSkills();
      await loadUsers();
      toast.success("Agent skill uploaded successfully");
    } catch (error) {
      console.error("Failed to upload agent skill:", error);
      toast.error("Failed to upload agent skill");
    } finally {
      setIsUploading(false);
      setSelectedUploadFile(null);
      setUploadMetaValue("{}");
      setUploadMetaError("");
      setUploadUserValue("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleUploadCancel = () => {
    setUploadDialogOpen(false);
    setSelectedUploadFile(null);
    setUploadMetaValue("{}");
    setUploadMetaError("");
    setUploadUserValue("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <div className="h-full bg-background p-6 flex flex-col overflow-hidden space-y-2">
        <div className="shrink-0 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Agent Skills</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage all Agent Skills
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleUploadClick}
                disabled={isUploading || isLoadingSkills}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Upload
              </Button>
              <Button
                variant="outline"
                onClick={handleRefreshSkills}
                disabled={isRefreshing || isLoadingSkills}
              >
                {isRefreshing ? (
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

          <div className="flex gap-2">
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-[200px]">
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
              placeholder="Filter by name..."
              value={filterText}
              onChange={(e) => {
              setFilterText(e.target.value);
              setCurrentPage(1);
            }}
              className="max-w-sm"
            />
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={handleFileChange}
        />

        {isLoadingSkills ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="flex items-center justify-center flex-1">
            <p className="text-sm text-muted-foreground">
              {skills.length === 0
                ? "No agent skills"
                : "No matching agent skills"}
            </p>
          </div>
        ) : (
          <>
            <SkillList
              skills={paginatedSkills}
              onSkillClick={handleSkillClick}
              onSkillDelete={handleSkillDelete}
              className="overflow-auto flex-1"
            />
            <PaginationBar
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredSkills.length}
              onPageChange={setCurrentPage}
              itemLabel="skills"
              isLoading={isLoadingMore}
            />
          </>
        )}
      </div>

      {/* Delete agent skill dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent Skill</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete agent skill{" "}
              <span className="font-semibold">{skillToDelete?.name}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
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

      {/* Upload agent skill dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Agent Skill</DialogTitle>
            <DialogDescription>
              Upload a ZIP file containing an agent skill. The ZIP must include a
              SKILL.md file with name and description.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Selected File
              </Label>
              <div className="text-sm bg-muted px-3 py-2 rounded-md font-mono">
                {selectedUploadFile?.name || "No file selected"}
              </div>
            </div>

            <div className="space-y-2">
              <Label>User Identifier (Optional)</Label>
              <InputGroup>
                <InputGroupInput
                  value={uploadUserValue}
                  onChange={(e) => setUploadUserValue(e.target.value)}
                  placeholder="Select an existing user or type a new identifier"
                />
                <InputGroupAddon align="inline-end">
                  <Popover
                    open={uploadUserOpen}
                    onOpenChange={setUploadUserOpen}
                  >
                    <PopoverTrigger asChild>
                      <InputGroupButton variant="outline" size="icon-xs">
                        <ChevronsUpDown className="h-4 w-4" />
                      </InputGroupButton>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[--radix-popover-trigger-width] p-0"
                      align="end"
                    >
                      <Command>
                        <CommandList>
                          <CommandGroup>
                            {users.map((user) => (
                              <CommandItem
                                key={user.id}
                                value={user.identifier}
                                onSelect={(value) => {
                                  setUploadUserValue(value);
                                  setUploadUserOpen(false);
                                }}
                              >
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

            <div>
              <Label className="text-sm font-medium mb-2 block">
                Metadata (JSON)
              </Label>
              <CodeEditor
                value={uploadMetaValue}
                height="200px"
                language="json"
                onChange={handleUploadMetaChange}
                placeholder='{"key": "value"}'
              />
              {uploadMetaError ? (
                <p className="mt-2 text-sm text-destructive">
                  {uploadMetaError}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground mt-1">
                Enter additional metadata as JSON object
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleUploadCancel}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUploadConfirm}
              disabled={isUploading || !selectedUploadFile || !isUploadMetaValid}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
