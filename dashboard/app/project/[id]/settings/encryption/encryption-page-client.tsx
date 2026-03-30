"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { encodeId } from "@/lib/id-codec";
import { AlertTriangle, KeyRound, Lock, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
import { useTopNavStore } from "@/stores/top-nav";
import { Organization, Project } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { encryptProjectAction, decryptProjectAction } from "./actions";
import { useApiKeyStorage } from "@/lib/hooks/use-api-key-storage";

interface EncryptionPageClientProps {
  project: Project;
  currentOrganization: Organization;
  allOrganizations: Organization[];
  projects: Project[];
  role: "owner" | "member";
  apiKeyPrefix: string;
}

export function EncryptionPageClient({
  project,
  currentOrganization,
  allOrganizations,
  projects,
  role,
  apiKeyPrefix,
}: EncryptionPageClientProps) {
  const { initialize, setHasSidebar } = useTopNavStore();
  const router = useRouter();

  const [encryptionEnabled, setEncryptionEnabled] = useState(
    project.encryption_enabled ?? false
  );
  const [showEncryptDialog, setShowEncryptDialog] = useState(false);
  const [showDecryptDialog, setShowDecryptDialog] = useState(false);
  const [isEncryptionPending, startEncryptionTransition] = useTransition();
  const { hasApiKey, apiKey, isCompactKey } = useApiKeyStorage(project.id, apiKeyPrefix);

  useEffect(() => {
    initialize({
      title: "",
      organization: currentOrganization,
      project: project,
      organizations: allOrganizations,
      projects: projects,
      hasSidebar: true,
    });

    return () => {
      setHasSidebar(false);
    };
  }, [project, currentOrganization, allOrganizations, projects, initialize, setHasSidebar]);

  const isOwner = role === "owner";

  return (
    <>
      <div className="space-y-6">
        {!isOwner && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You don&apos;t have permission to modify encryption settings. Only project owners can make changes.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Data Encryption</CardTitle>
            <CardDescription>
              Enable per-project encryption to protect your data at rest.
              When enabled, all project data (sessions, messages, skills, etc.) will be encrypted using your API key.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="encryption-toggle" className="text-sm font-medium">
                  Encryption
                </Label>
                <p className="text-sm text-muted-foreground">
                  {encryptionEnabled ? "Encryption is currently enabled" : "Encryption is currently disabled"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isEncryptionPending && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                <Switch
                  id="encryption-toggle"
                  checked={encryptionEnabled}
                  onCheckedChange={(checked) => {
                    if (!isOwner) return;
                    if (!hasApiKey) {
                      toast.error(
                        "No API key saved. Please go to the API Keys page and save your API key first.",
                        { duration: 5000 }
                      );
                      return;
                    }
                    if (!isCompactKey) {
                      toast.error(
                        "Your API key is in legacy format and does not support encryption. Please rotate your API key on the API Keys page to get a new key that supports encryption.",
                        { duration: 8000 }
                      );
                      return;
                    }
                    if (checked) {
                      setShowEncryptDialog(true);
                    } else {
                      setShowDecryptDialog(true);
                    }
                  }}
                  disabled={isEncryptionPending || !isOwner || (hasApiKey && !isCompactKey)}
                />
              </div>
            </div>

            {!hasApiKey && (
              <Alert>
                <Lock className="h-4 w-4" />
                <AlertDescription>
                  No API key is saved in your browser. To enable or disable encryption, go to the{" "}
                  <a
                    href={`/project/${encodeId(project.id)}/api-keys`}
                    className="font-medium underline underline-offset-4"
                  >
                    API Keys page
                  </a>{" "}
                  and save your API key first.
                </AlertDescription>
              </Alert>
            )}

            {hasApiKey && !isCompactKey && (
              <Alert variant="destructive">
                <KeyRound className="h-4 w-4" />
                <AlertDescription>
                  Your saved API key is in legacy format and does not support encryption.
                  Please go to the{" "}
                  <a
                    href={`/project/${encodeId(project.id)}/api-keys`}
                    className="font-medium underline underline-offset-4"
                  >
                    API Keys page
                  </a>{" "}
                  and rotate your API key to get a new key that supports encryption.
                </AlertDescription>
              </Alert>
            )}

            {encryptionEnabled && (
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Important:</strong> Your data is encrypted using a master key embedded in your API key.
                  Rotating your API key will preserve the same encryption — no data re-encryption needed.
                  Always ensure your API key is saved in your browser.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Encrypt Confirmation Dialog */}
      <AlertDialog open={showEncryptDialog} onOpenChange={setShowEncryptDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Enable Encryption?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will encrypt all existing project data using your API key.
              This process may take a moment depending on the amount of data.
              <br /><br />
              <strong>Important:</strong> Only your API key can decrypt this data.
              Make sure your API key is safely stored before proceeding.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isEncryptionPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isEncryptionPending}
              onClick={() => {
                setShowEncryptDialog(false);
                startEncryptionTransition(async () => {
                  const result = await encryptProjectAction(project.id, apiKey!);
                  if (result.error) {
                    toast.error(result.error);
                  } else {
                    setEncryptionEnabled(true);
                    toast.success("Project encryption enabled successfully");
                    router.refresh();
                  }
                });
              }}
            >
              {isEncryptionPending ? "Encrypting..." : "Enable Encryption"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Decrypt Confirmation Dialog */}
      <AlertDialog open={showDecryptDialog} onOpenChange={setShowDecryptDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Disable Encryption?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will decrypt all project data. Your data will no longer be encrypted at rest.
              This process may take a moment depending on the amount of data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isEncryptionPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isEncryptionPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setShowDecryptDialog(false);
                startEncryptionTransition(async () => {
                  const result = await decryptProjectAction(project.id, apiKey!);
                  if (result.error) {
                    toast.error(result.error);
                  } else {
                    setEncryptionEnabled(false);
                    toast.success("Project encryption disabled successfully");
                    router.refresh();
                  }
                });
              }}
            >
              {isEncryptionPending ? "Decrypting..." : "Disable Encryption"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
