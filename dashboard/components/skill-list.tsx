"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FolderOpen, Trash2, Loader2 } from "lucide-react";
import type { AgentSkill, AgentSkillListItem } from "@/types";

export type SkillItem = AgentSkill | AgentSkillListItem;

function getFileCount(skill: SkillItem): number {
  if ("file_index" in skill && Array.isArray(skill.file_index)) {
    return skill.file_index.length;
  }
  return 0;
}

export interface SkillListProps {
  skills: SkillItem[];
  onSkillClick: (skill: SkillItem) => void;
  onSkillDelete?: (skill: SkillItem) => void;
  emptyMessage?: string;
  isLoading?: boolean;
  deleteLabel?: string;
  className?: string;
}

export function SkillList({
  skills,
  onSkillClick,
  onSkillDelete,
  emptyMessage = "No skills found.",
  isLoading = false,
  deleteLabel = "Delete",
  className,
}: SkillListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading skills...</p>
        </div>
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {skills.map((skill) => {
        const fileCount = getFileCount(skill);
        return (
          <div
            key={skill.id}
            className="rounded-md border bg-card p-4 space-y-3 cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => onSkillClick(skill)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm">{skill.name}</h3>
                {fileCount > 0 ? (
                  <Badge variant="secondary">{fileCount} files</Badge>
                ) : null}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSkillClick(skill);
                  }}
                >
                  <FolderOpen className="h-4 w-4" />
                  View Files
                </Button>
                {onSkillDelete ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSkillDelete(skill);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    {deleteLabel}
                  </Button>
                ) : null}
              </div>
            </div>

            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {skill.description || "No description"}
            </p>

            {skill.meta && Object.keys(skill.meta).length > 0 ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Metadata
                </p>
                <pre className="text-xs bg-muted px-3 py-2 rounded overflow-auto max-h-[150px]">
                  {JSON.stringify(skill.meta, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
