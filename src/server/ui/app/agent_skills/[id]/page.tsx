"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Loader2, ArrowLeft, Trash2 } from "lucide-react";
import { getAgentSkill, deleteAgentSkill } from "@/app/agent_skills/actions";
import { AgentSkill } from "@/types";
import DiskTreeViewer from "@/components/disk-tree-viewer/disk-tree-viewer";

export default function SkillDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const t = useTranslations("skillDetail");
  const tSkills = useTranslations("agentSkills");

  const [skill, setSkill] = useState<AgentSkill | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const loadSkill = async () => {
      setIsLoading(true);
      setNotFound(false);
      try {
        const res = await getAgentSkill(id);
        if (res.code !== 0 || !res.data) {
          setNotFound(true);
          return;
        }
        setSkill(res.data);
      } catch (error) {
        console.error("Failed to load skill:", error);
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };
    loadSkill();
  }, [id]);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const res = await deleteAgentSkill(id);
      if (res.code !== 0) {
        console.error(res.message);
        return;
      }
      router.push("/agent_skills");
    } catch (error) {
      console.error("Failed to delete skill:", error);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("loadingSkill")}</p>
        </div>
      </div>
    );
  }

  if (notFound || !skill) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">{t("notFound")}</p>
        <Button
          variant="outline"
          onClick={() => router.push("/agent_skills")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("backToSkills")}
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full bg-background p-6 flex flex-col overflow-hidden space-y-4">
      {/* Header */}
      <div className="shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => router.push("/agent_skills")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("backToSkills")}
          </Button>
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            {tSkills("delete")}
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{skill.name}</h1>
          <Badge variant="secondary">
            {skill.file_index?.length || 0} {tSkills("files")}
          </Badge>
        </div>

        {skill.description && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {skill.description}
          </p>
        )}

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>
            <span className="font-medium">{t("createdAt")}:</span>{" "}
            {new Date(skill.created_at).toLocaleString()}
          </span>
          <span>
            <span className="font-medium">{t("updatedAt")}:</span>{" "}
            {new Date(skill.updated_at).toLocaleString()}
          </span>
        </div>
      </div>

      {/* File Viewer */}
      {!skill.disk_id ? (
        <div className="flex-1 flex items-center justify-center rounded-md border">
          <p className="text-sm text-muted-foreground">
            {t("noAssociatedDisk")}
          </p>
        </div>
      ) : (
        <DiskTreeViewer diskId={skill.disk_id} />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tSkills("deleteConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tSkills("deleteConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {tSkills("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tSkills("deleting")}
                </>
              ) : (
                tSkills("delete")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
