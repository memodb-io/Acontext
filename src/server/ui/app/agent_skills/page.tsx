"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Upload, RefreshCw } from "lucide-react";
import {
  getAgentSkills,
  createAgentSkill,
  deleteAgentSkill,
} from "@/app/agent_skills/actions";
import { AgentSkill } from "@/types";

export default function AgentSkillsPage() {
  const t = useTranslations("agentSkills");

  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterText, setFilterText] = useState("");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [skillToDelete, setSkillToDelete] = useState<AgentSkill | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadUser, setUploadUser] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<AgentSkill | null>(null);

  const filteredSkills = skills.filter((skill) =>
    skill.name.toLowerCase().includes(filterText.toLowerCase())
  );

  const loadSkills = async () => {
    try {
      setIsLoading(true);
      const allSkills: AgentSkill[] = [];
      let cursor: string | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        const res = await getAgentSkills(50, cursor, true);
        if (res.code !== 0) {
          console.error(res.message);
          break;
        }
        allSkills.push(...(res.data?.items || []));
        cursor = res.data?.next_cursor;
        hasMore = res.data?.has_more || false;
      }

      setSkills(allSkills);
    } catch (error) {
      console.error("Failed to load agent skills:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSkills();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadSkills();
    setIsRefreshing(false);
  };

  const handleOpenUpload = () => {
    setUploadFile(null);
    setUploadUser("");
    setUploadError("");
    setUploadDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setUploadError("");
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;

    try {
      setIsUploading(true);
      setUploadError("");
      const res = await createAgentSkill(
        uploadFile,
        uploadUser || undefined
      );
      if (res.code !== 0) {
        setUploadError(res.message);
        return;
      }
      await loadSkills();
      setUploadDialogOpen(false);
    } catch (error) {
      console.error("Failed to upload agent skill:", error);
      setUploadError(String(error));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!skillToDelete) return;
    try {
      setIsDeleting(true);
      const res = await deleteAgentSkill(skillToDelete.id);
      if (res.code !== 0) {
        console.error(res.message);
        return;
      }
      await loadSkills();
    } catch (error) {
      console.error("Failed to delete agent skill:", error);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setSkillToDelete(null);
    }
  };

  const handleViewDetails = (skill: AgentSkill) => {
    setSelectedSkill(skill);
    setDetailDialogOpen(true);
  };

  return (
    <div className="h-full bg-background p-6 flex flex-col overflow-hidden space-y-2">
      <div className="shrink-0 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("description")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleOpenUpload}>
              <Upload className="h-4 w-4" />
              {t("upload")}
            </Button>
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
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

        <div className="flex gap-2">
          <Input
            type="text"
            placeholder={t("filterById")}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="max-w-sm"
          />
        </div>
      </div>

      <div className="flex-1 rounded-md border overflow-hidden flex flex-col min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">
              {skills.length === 0 ? t("noData") : t("noMatching")}
            </p>
          </div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("skillDescription")}</TableHead>
                  <TableHead>{t("files")}</TableHead>
                  <TableHead>{t("createdAt")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSkills.map((skill) => (
                  <TableRow key={skill.id}>
                    <TableCell className="font-medium">
                      {skill.name}
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate">
                      {skill.description || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-md bg-secondary border border-border px-2 py-1 text-xs font-medium">
                        {skill.file_index?.length || 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date(skill.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleViewDetails(skill)}
                        >
                          {t("viewDetails")}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setSkillToDelete(skill);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          {t("delete")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirmDescription")}
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

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("uploadTitle")}</DialogTitle>
            <DialogDescription>{t("uploadDescription")}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("selectFile")}
              </label>
              <div className="flex gap-2 items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {t("selectFile")}
                </Button>
                <span className="text-sm text-muted-foreground truncate">
                  {uploadFile?.name || t("noFileSelected")}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("userOptional")}
              </label>
              <Input
                type="text"
                placeholder={t("userPlaceholder")}
                value={uploadUser}
                onChange={(e) => setUploadUser(e.target.value)}
              />
            </div>
            {uploadError && (
              <p className="text-sm text-destructive">{uploadError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUploadDialogOpen(false)}
              disabled={isUploading}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleUpload}
              disabled={isUploading || !uploadFile}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("uploading")}
                </>
              ) : (
                t("upload")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>{t("detailsTitle")}</DialogTitle>
          </DialogHeader>
          {selectedSkill && (
            <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    {t("name")}
                  </p>
                  <p className="text-sm bg-muted px-2 py-1 rounded">
                    {selectedSkill.name}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    {t("createdAt")}
                  </p>
                  <p className="text-sm bg-muted px-2 py-1 rounded">
                    {new Date(selectedSkill.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {selectedSkill.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    {t("skillDescription")}
                  </p>
                  <p className="text-sm bg-muted px-2 py-1 rounded whitespace-pre-wrap">
                    {selectedSkill.description}
                  </p>
                </div>
              )}

              {selectedSkill.file_index && selectedSkill.file_index.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    {t("fileIndex")}
                  </p>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("path")}</TableHead>
                          <TableHead>{t("mime")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedSkill.file_index.map((file, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono text-xs">
                              {file.path}
                            </TableCell>
                            <TableCell className="text-xs">
                              {file.mime}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {selectedSkill.meta && Object.keys(selectedSkill.meta).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    {t("meta")}
                  </p>
                  <pre className="text-xs bg-muted px-3 py-2 rounded overflow-auto max-h-[200px]">
                    {JSON.stringify(selectedSkill.meta, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="shrink-0">
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
