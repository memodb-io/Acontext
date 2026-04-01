"use client";

import { useState } from "react";
import Link from "next/link";
import { encodeId } from "@/lib/id-codec";
import { Button } from "@/components/ui/button";
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
import { CodeEditor } from "@/components/code-editor";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getSessionConfigs,
  updateSessionConfigs,
  deleteSession,
} from "@/app/project/[id]/session/actions";

interface SessionActionsProps {
  projectId: string;
  sessionId: string;
  returnTo?: string;
  onDelete?: () => void;
}

export function SessionActions({
  projectId,
  sessionId,
  returnTo,
  onDelete,
}: SessionActionsProps) {
  const encodedProjectId = encodeId(projectId);
  const encodedSessionId = encodeId(sessionId);

  const returnToParam = returnTo
    ? `?returnTo=${encodeURIComponent(returnTo)}`
    : "";

  // Config dialog state
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configEditValue, setConfigEditValue] = useState("");
  const [configEditError, setConfigEditError] = useState("");
  const [isConfigEditValid, setIsConfigEditValid] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  const handleConfigEditChange = (value: string) => {
    setConfigEditValue(value);
    const trimmed = value.trim();
    if (!trimmed) {
      setIsConfigEditValid(false);
      setConfigEditError("Invalid JSON: Empty configuration");
      return;
    }
    try {
      JSON.parse(trimmed);
      setIsConfigEditValid(true);
      setConfigEditError("");
    } catch (error) {
      setIsConfigEditValid(false);
      if (error instanceof SyntaxError) {
        setConfigEditError("Invalid JSON: " + error.message);
      }
    }
  };

  const handleViewConfig = async () => {
    try {
      setConfigEditError("");
      setIsConfigEditValid(true);
      const res = await getSessionConfigs(projectId, sessionId);
      setConfigEditValue(JSON.stringify(res?.configs ?? {}, null, 2));
      setConfigDialogOpen(true);
    } catch (error) {
      console.error("Failed to load config:", error);
      toast.error("Failed to load session config");
    }
  };

  const handleSaveConfig = async () => {
    const trimmed = configEditValue.trim();
    if (!trimmed) {
      setConfigEditError("Invalid JSON: Empty configuration");
      return;
    }
    try {
      const configs = JSON.parse(trimmed);
      setConfigEditError("");
      setIsSavingConfig(true);
      await updateSessionConfigs(projectId, sessionId, configs);
      setConfigDialogOpen(false);
      toast.success("Session config updated successfully");
    } catch (error) {
      console.error("Failed to save config:", error);
      if (error instanceof SyntaxError) {
        setConfigEditError("Invalid JSON: " + error.message);
      } else {
        setConfigEditError(String(error));
      }
      toast.error("Failed to update session config");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleDeleteSession = async () => {
    try {
      setIsDeletingSession(true);
      await deleteSession(projectId, sessionId);
      setDeleteDialogOpen(false);
      toast.success("Session deleted successfully");
      onDelete?.();
    } catch (error) {
      console.error("Failed to delete session:", error);
      toast.error("Failed to delete session");
    } finally {
      setIsDeletingSession(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" asChild>
          <Link
            href={`/project/${encodedProjectId}/session/${encodedSessionId}/messages${returnToParam}`}
          >
            Messages
          </Link>
        </Button>
        <Button variant="secondary" size="sm" asChild>
          <Link
            href={`/project/${encodedProjectId}/session/${encodedSessionId}/task${returnToParam}`}
          >
            Tasks
          </Link>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleViewConfig();
          }}
        >
          Config
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            setDeleteDialogOpen(true);
          }}
        >
          Delete
        </Button>
      </div>

      {/* Config Dialog */}
      <AlertDialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Configs</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="py-4">
            <CodeEditor
              value={configEditValue}
              onChange={handleConfigEditChange}
              language="json"
              height="400px"
            />
            {configEditError && (
              <p className="mt-2 text-sm text-destructive">
                {configEditError}
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSavingConfig}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSaveConfig}
              disabled={isSavingConfig || !isConfigEditValid}
            >
              {isSavingConfig ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : (
                "Save"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this session? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingSession}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSession}
              disabled={isDeletingSession}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingSession ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting
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
