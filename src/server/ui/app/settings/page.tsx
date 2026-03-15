"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  getProjectConfigs,
  updateProjectConfigs,
  type ProjectConfig,
} from "./actions";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const [successCriteria, setSuccessCriteria] = useState("");
  const [failureCriteria, setFailureCriteria] = useState("");
  const [initialConfig, setInitialConfig] = useState<ProjectConfig | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await getProjectConfigs();
      if (result.code === 0 && result.data) {
        setSuccessCriteria(result.data.task_success_criteria ?? "");
        setFailureCriteria(result.data.task_failure_criteria ?? "");
        setInitialConfig(result.data);
      } else {
        setError(result.message);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = () => {
    startTransition(async () => {
      setError(null);
      setSuccess(false);
      const configs: Record<string, string | null> = {};
      configs.task_success_criteria = successCriteria.trim() || null;
      configs.task_failure_criteria = failureCriteria.trim() || null;
      const result = await updateProjectConfigs(configs);
      if (result.code === 0) {
        setSuccess(true);
        setInitialConfig(result.data);
      } else {
        setError(result.message);
      }
    });
  };

  const handleCancel = () => {
    setSuccessCriteria(initialConfig?.task_success_criteria ?? "");
    setFailureCriteria(initialConfig?.task_failure_criteria ?? "");
    setError(null);
    setSuccess(false);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("description")}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("successCriteriaTitle")}</CardTitle>
            <CardDescription>{t("successCriteriaDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={successCriteria}
              onChange={(e) => {
                setSuccessCriteria(e.target.value);
                setError(null);
                setSuccess(false);
              }}
              placeholder={t("successCriteriaPlaceholder")}
              rows={4}
              disabled={isPending}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("failureCriteriaTitle")}</CardTitle>
            <CardDescription>{t("failureCriteriaDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={failureCriteria}
              onChange={(e) => {
                setFailureCriteria(e.target.value);
                setError(null);
                setSuccess(false);
              }}
              placeholder={t("failureCriteriaPlaceholder")}
              rows={4}
              disabled={isPending}
            />
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <AlertDescription>{t("saveSuccess")}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isPending}
          >
            {t("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? t("saving") : t("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
