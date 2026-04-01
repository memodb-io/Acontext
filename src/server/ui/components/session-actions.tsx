"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
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
import { Loader2 } from "lucide-react";
import {
  getSessionConfigs,
  updateSessionConfigs,
  deleteSession,
} from "@/app/session/actions";
import ReactCodeMirror from "@uiw/react-codemirror";
import { okaidia } from "@uiw/codemirror-theme-okaidia";
import { json } from "@codemirror/lang-json";
import { EditorView } from "@codemirror/view";

interface SessionActionsProps {
  sessionId: string;
  returnTo?: string;
  onDelete?: () => void;
}

export function SessionActions({
  sessionId,
  returnTo,
  onDelete,
}: SessionActionsProps) {
  const t = useTranslations("session");
  const { resolvedTheme } = useTheme();

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
      setConfigEditError(t("invalidJson") + ": Empty configuration");
      return;
    }
    try {
      JSON.parse(trimmed);
      setIsConfigEditValid(true);
      setConfigEditError("");
    } catch (error) {
      setIsConfigEditValid(false);
      if (error instanceof SyntaxError) {
        setConfigEditError(t("invalidJson") + ": " + error.message);
      }
    }
  };

  const handleViewConfig = async () => {
    try {
      setConfigEditError("");
      setIsConfigEditValid(true);
      const res = await getSessionConfigs(sessionId);
      if (res.code === 0 && res.data) {
        setConfigEditValue(JSON.stringify(res.data.configs, null, 2));
      } else {
        setConfigEditValue("{}");
      }
      setConfigDialogOpen(true);
    } catch (error) {
      console.error("Failed to load config:", error);
    }
  };

  const handleSaveConfig = async () => {
    const trimmed = configEditValue.trim();
    if (!trimmed) {
      setConfigEditError(t("invalidJson") + ": Empty configuration");
      return;
    }
    try {
      const configs = JSON.parse(trimmed);
      setConfigEditError("");
      setIsSavingConfig(true);
      const res = await updateSessionConfigs(sessionId, configs);
      if (res.code !== 0) {
        setConfigEditError(res.message);
        return;
      }
      setConfigDialogOpen(false);
    } catch (error) {
      console.error("Failed to save config:", error);
      if (error instanceof SyntaxError) {
        setConfigEditError(t("invalidJson") + ": " + error.message);
      } else {
        setConfigEditError(String(error));
      }
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleDeleteSession = async () => {
    try {
      setIsDeletingSession(true);
      const res = await deleteSession(sessionId);
      if (res.code !== 0) {
        console.error(res.message);
        return;
      }
      setDeleteDialogOpen(false);
      onDelete?.();
    } catch (error) {
      console.error("Failed to delete session:", error);
    } finally {
      setIsDeletingSession(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" asChild>
          <Link
            href={`/session/${sessionId}/messages${returnToParam}`}
            onClick={(e) => e.stopPropagation()}
          >
            {t("messages")}
          </Link>
        </Button>
        <Button variant="secondary" size="sm" asChild>
          <Link
            href={`/session/${sessionId}/task${returnToParam}`}
            onClick={(e) => e.stopPropagation()}
          >
            {t("tasks")}
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
          {t("config")}
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
          {t("delete")}
        </Button>
      </div>

      {/* Config Dialog */}
      <AlertDialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("editConfigsTitle")}</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="py-4">
            <ReactCodeMirror
              value={configEditValue}
              height="400px"
              theme={resolvedTheme === "dark" ? okaidia : "light"}
              extensions={[json(), EditorView.lineWrapping]}
              onChange={handleConfigEditChange}
              placeholder={t("configsPlaceholder")}
              className="border rounded-md overflow-hidden"
            />
            {configEditError && (
              <p className="mt-2 text-sm text-destructive">
                {configEditError}
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSavingConfig}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSaveConfig}
              disabled={isSavingConfig || !isConfigEditValid}
            >
              {isSavingConfig ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                t("save")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteSessionConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingSession}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSession}
              disabled={isDeletingSession}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingSession ? (
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
    </>
  );
}
