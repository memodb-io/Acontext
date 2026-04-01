"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, Trash2 } from "lucide-react";
import { useLearningSpaceContext } from "../learning-space-layout-client";

export default function SkillsPage() {
  const { id, skills, setExcludeTarget } = useLearningSpaceContext();
  const t = useTranslations("learningSpaces");

  if (skills.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1">
        <p className="text-sm text-muted-foreground">{t("noSkills")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto flex-1 space-y-3">
      {skills.map((skill) => (
        <div
          key={skill.id}
          className="rounded-md border bg-card p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm">{skill.name}</h3>
              <Badge variant="secondary">
                {skill.file_index?.length || 0} {t("files")}
              </Badge>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" asChild>
                <Link
                  href={`/agent_skills/${skill.id}?returnTo=${encodeURIComponent(`/learning_spaces/${id}/skills`)}`}
                >
                  <FolderOpen className="h-4 w-4" />
                  {t("viewFiles")}
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setExcludeTarget(skill)}
              >
                <Trash2 className="h-4 w-4" />
                {t("remove")}
              </Button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {skill.description || t("noDescription")}
          </p>

          {skill.meta && Object.keys(skill.meta).length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                {t("metaLabel")}
              </p>
              <pre className="text-xs bg-muted px-3 py-2 rounded overflow-auto max-h-[150px]">
                {JSON.stringify(skill.meta, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
