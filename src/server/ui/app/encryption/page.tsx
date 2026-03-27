"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Shield, Eye, EyeOff } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  getEncryptionStatus,
  encryptProject,
  decryptProject,
} from "./actions";

export default function EncryptionPage() {
  const t = useTranslations("encryption");
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [confirmAction, setConfirmAction] = useState<
    "encrypt" | "decrypt" | null
  >(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await getEncryptionStatus();
      if (result.code === 0 && result.data) {
        setEncryptionEnabled(result.data.encryption_enabled ?? false);
        setLoaded(true);
      } else {
        setError(result.message);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleToggle = () => {
    if (!apiKey.trim()) {
      setError(t("apiKeyRequired"));
      return;
    }
    setConfirmAction(encryptionEnabled ? "decrypt" : "encrypt");
  };

  const handleConfirm = () => {
    const action = confirmAction;
    setConfirmAction(null);
    if (!action) return;

    startTransition(async () => {
      setError(null);
      setSuccess(null);
      const result =
        action === "encrypt"
          ? await encryptProject(apiKey.trim())
          : await decryptProject(apiKey.trim());

      if (result.code === 0) {
        setEncryptionEnabled(action === "encrypt");
        setSuccess(t(action === "encrypt" ? "enableSuccess" : "disableSuccess"));
      } else {
        setError(result.message);
      }
    });
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
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            {t("title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("description")}
          </p>
        </div>

        {loaded && <Card>
          <CardHeader>
            <CardTitle>{t("statusTitle")}</CardTitle>
            <CardDescription>
              {encryptionEnabled ? t("enabled") : t("disabled")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">{t("apiKeyLabel")}</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="api-key"
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setError(null);
                      setSuccess(null);
                    }}
                    placeholder={t("apiKeyPlaceholder")}
                    disabled={isPending}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("apiKeyHint")}
              </p>
            </div>

            <Button
              onClick={handleToggle}
              disabled={isPending || !apiKey.trim()}
              variant={encryptionEnabled ? "destructive" : "default"}
            >
              {isPending
                ? t("processing")
                : encryptionEnabled
                  ? t("disable")
                  : t("enable")}
            </Button>
          </CardContent>
        </Card>}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
      </div>

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={() => setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "encrypt"
                ? t("enableConfirmTitle")
                : t("disableConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "encrypt"
                ? t("enableConfirmDesc")
                : t("disableConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
