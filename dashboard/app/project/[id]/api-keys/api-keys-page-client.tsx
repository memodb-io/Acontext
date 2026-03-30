"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Download,
  RefreshCw,
  AlertTriangle,
  KeyRound,
  Save,
  Trash2,
  Eye,
  EyeOff,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useTopNavStore } from "@/stores/top-nav";
import { Organization, Project } from "@/types";
import { SecretKeyRotation } from "@/lib/supabase/operations/projects";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { rotateSecretKey } from "./actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeEditor } from "@/components/code-editor";
import { useApiKeyStorage, hasValidApiKeyPrefix } from "@/lib/hooks/use-api-key-storage";

const SERVICE_URL = "api.acontext.app/api/v1";

interface ApiKeysPageClientProps {
  project: Project;
  currentOrganization: Organization;
  allOrganizations: Organization[];
  projects: Project[];
  keyRotations: SecretKeyRotation[];
  role: "owner" | "member";
  apiKeyPrefix: string;
}

export function ApiKeysPageClient({
  project,
  currentOrganization,
  allOrganizations,
  projects,
  keyRotations,
  role,
  apiKeyPrefix,
}: ApiKeysPageClientProps) {
  const { initialize, setHasSidebar } = useTopNavStore();
  const router = useRouter();

  // State for newly generated key (only shown once)
  const [newlyGeneratedKey, setNewlyGeneratedKey] = useState<string | null>(
    null
  );
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [activeCodeTab, setActiveCodeTab] = useState<"python" | "typescript">(
    "python"
  );

  // Saved API key in localStorage
  const { apiKey: savedApiKey, hasApiKey: hasSavedApiKey, saveApiKey, removeApiKey } = useApiKeyStorage(project.id, apiKeyPrefix);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showSavedKey, setShowSavedKey] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  const isOwner = role === "owner";
  const hasExistingKey = keyRotations.length > 0;
  const latestRotation = keyRotations[0] || null;

  const currentApiKey =
    newlyGeneratedKey || latestRotation?.secret_key || "your-api-key";

  const codeExamples = useMemo(
    () => ({
      python: `from acontext import AcontextClient

client = AcontextClient(
    base_url="https://${SERVICE_URL}",
    api_key="${currentApiKey}"
)

print(client.ping())`,
      typescript: `import { AcontextClient } from '@acontext/acontext';

const client = new AcontextClient({
  baseUrl: "https://${SERVICE_URL}",
  apiKey: "${currentApiKey}"
});

console.log(await client.ping());`,
    }),
    [currentApiKey]
  );

  useEffect(() => {
    // Initialize top-nav state when page loads
    initialize({
      title: "",
      organization: currentOrganization,
      project: project,
      organizations: allOrganizations,
      projects: projects,
      hasSidebar: true,
    });

    // Cleanup: reset hasSidebar when leaving this page
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

  const handleGenerateKey = () => {
    if (hasExistingKey) {
      // Show confirmation dialog for rotation
      setShowConfirmDialog(true);
    } else {
      // Generate directly for new keys
      performKeyGeneration();
    }
  };

  const performKeyGeneration = () => {
    startTransition(async () => {
      const result = await rotateSecretKey(
        project.id,
        savedApiKey ?? undefined,
      );
      if (result.error) {
        toast.error(result.error);
      } else if (result.secretKey) {
        setNewlyGeneratedKey(result.secretKey);
        setShowKeyDialog(true);
        // Auto-update localStorage if the user had a saved key
        if (hasSavedApiKey) {
          saveApiKey(result.secretKey);
          toast.info("Saved API key in your browser has been updated with the new key.");
        }
        router.refresh();
        toast.success(
          hasExistingKey
            ? "API key rotated successfully"
            : "API key generated successfully"
        );
      }
    });
  };

  const handleCopyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      toast.success("API key copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(`https://${SERVICE_URL}`);
      toast.success("URL copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleDownloadKey = (key: string) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const content = `Acontext API Key
================

Secret Key: ${key}

Generated: ${new Date().toISOString()}
Project ID: ${project.id}
Project Name: ${project.name}

IMPORTANT: Store this key securely. It will not be shown again.
`;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `acontext-api-key-${timestamp}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("API key downloaded");
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  return (
    <>
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-semibold">API Keys</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage your project API keys for authentication
            </p>
          </div>

          {/* Non-owner Alert */}
          {!isOwner && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You don&apos;t have permission to generate or rotate API keys.
                Only organization owners can manage API keys.
              </AlertDescription>
            </Alert>
          )}

          {/* Quick Start Card */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Start</CardTitle>
              <CardDescription>
                Get started with the Acontext API in your preferred language
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs
                value={activeCodeTab}
                onValueChange={(v) =>
                  setActiveCodeTab(v as "python" | "typescript")
                }
                className="w-full gap-0"
              >
                <div className="flex items-center justify-between bg-muted/50 rounded-t-md border border-b-0 px-1">
                  <TabsList className="h-9 bg-transparent p-0">
                    <TabsTrigger
                      value="python"
                      className="rounded-none border-0 bg-transparent! shadow-none! text-muted-foreground! data-[state=active]:text-primary! data-[state=active]:border-b-2 data-[state=active]:border-b-primary"
                    >
                      Python
                    </TabsTrigger>
                    <TabsTrigger
                      value="typescript"
                      className="rounded-none border-0 bg-transparent! shadow-none! text-muted-foreground! data-[state=active]:text-primary! data-[state=active]:border-b-2 data-[state=active]:border-b-primary"
                    >
                      TypeScript
                    </TabsTrigger>
                  </TabsList>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      navigator.clipboard.writeText(codeExamples[activeCodeTab]);
                      toast.success("Code copied to clipboard");
                    }}
                    title="Copy code"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <TabsContent value="python" className="mt-0">
                  <CodeEditor
                    value={codeExamples.python}
                    language="python"
                    readOnly
                    height="200px"
                    className="rounded-t-none"
                  />
                </TabsContent>
                <TabsContent value="typescript" className="mt-0">
                  <CodeEditor
                    value={codeExamples.typescript}
                    language="typescript"
                    readOnly
                    height="200px"
                    className="rounded-t-none"
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* API Endpoint Card */}
          <Card>
            <CardHeader>
              <CardTitle>API Endpoint</CardTitle>
              <CardDescription>
                Use this URL to connect to the Acontext API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Input
                  value={`https://${SERVICE_URL}`}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyUrl}
                  title="Copy URL"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Current API Key Card */}
          <Card>
            <CardHeader>
              <CardTitle>Current API Key</CardTitle>
              <CardDescription>
                {hasExistingKey
                  ? "Your current API key (masked for security)"
                  : "No API key has been generated yet. Generate one to get started."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Display current key or newly generated key */}
              {(newlyGeneratedKey || hasExistingKey) && (
                <div className="space-y-2">
                  <Label>Secret Key</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={
                        newlyGeneratedKey || latestRotation?.secret_key || ""
                      }
                      readOnly
                      className="font-mono text-sm"
                    />
                    {newlyGeneratedKey && (
                      <>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleCopyKey(newlyGeneratedKey)}
                          title="Copy key"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDownloadKey(newlyGeneratedKey)}
                          title="Download key"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                  {newlyGeneratedKey && (
                    <Alert className="mt-2">
                      <KeyRound className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Important:</strong> This is the only time you
                        will see the full API key. Please copy or download it
                        now and store it securely. After closing this page, only
                        the masked version will be available.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {/* Generate/Rotate Button */}
              <div className="flex items-center justify-between gap-4 pt-2 border-t">
                <div className="space-y-1 flex-1">
                  <h4 className="text-sm font-medium">
                    {hasExistingKey ? "Rotate API Key" : "Generate API Key"}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {hasExistingKey
                      ? "Rotating the API key will immediately invalidate the current key. Make sure to update your applications before rotating."
                      : "Generate a new API key to authenticate your applications with the Acontext API."}
                  </p>
                </div>
                <Button
                  onClick={handleGenerateKey}
                  disabled={isPending || !isOwner}
                  variant={hasExistingKey ? "destructive" : "default"}
                >
                  {isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {hasExistingKey ? "Rotating..." : "Generating..."}
                    </>
                  ) : (
                    <>
                      {hasExistingKey ? (
                        <RefreshCw className="h-4 w-4" />
                      ) : (
                        <KeyRound className="h-4 w-4" />
                      )}
                      {hasExistingKey ? "Rotate" : "Generate"}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Saved API Key Card */}
          <Card>
            <CardHeader>
              <CardTitle>Saved API Key</CardTitle>
              <CardDescription>
                Save your API key in your browser for encryption features.
                Your API key is stored only in your browser and is never sent to our servers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasSavedApiKey ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Current Saved Key</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={showSavedKey ? (savedApiKey ?? "") : "****************************************"}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowSavedKey(!showSavedKey)}
                        title={showSavedKey ? "Hide key" : "Show key"}
                      >
                        {showSavedKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          if (savedApiKey) {
                            navigator.clipboard.writeText(savedApiKey);
                            toast.success("Saved API key copied to clipboard");
                          }
                        }}
                        title="Copy saved key"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => {
                          removeApiKey();
                          setShowSavedKey(false);
                          toast.success("Saved API key removed from browser");
                        }}
                        title="Remove saved key"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Your API key is stored only in your browser. It is used for encryption/decryption operations.
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="api-key-input">API Key</Label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="api-key-input"
                          type={showApiKeyInput ? "text" : "password"}
                          value={apiKeyInput}
                          onChange={(e) => setApiKeyInput(e.target.value)}
                          placeholder="Paste your API key here"
                          className="font-mono text-sm pr-10"
                          autoComplete="off"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                          onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                          title={showApiKeyInput ? "Hide API key" : "Show API key"}
                          type="button"
                        >
                          {showApiKeyInput ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <Button
                        onClick={() => {
                          const trimmed = apiKeyInput.trim();
                          if (!trimmed) return;
                          if (!hasValidApiKeyPrefix(trimmed, apiKeyPrefix)) {
                            toast.error(`Invalid API key format. API key must start with "${apiKeyPrefix}".`);
                            return;
                          }
                          saveApiKey(trimmed);
                          setApiKeyInput("");
                          setShowApiKeyInput(false);
                          toast.success("API key saved to browser");
                        }}
                        disabled={!apiKeyInput.trim()}
                      >
                        <Save className="h-4 w-4" />
                        Save
                      </Button>
                    </div>
                  </div>
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Your API key is stored only in your browser. It is used for encryption/decryption operations.
                      Save your API key here after generating or rotating it.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Key History Card */}
          {hasExistingKey && (
            <Card>
              <CardHeader>
                <CardTitle>Key History</CardTitle>
                <CardDescription>
                  History of API key generations and rotations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Secret Key (Masked)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Generated By</TableHead>
                      <TableHead>Generated At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keyRotations.map((rotation, index) => (
                      <TableRow key={rotation.id}>
                        <TableCell className="font-mono text-sm">
                          {rotation.secret_key}
                        </TableCell>
                        <TableCell>
                          {index === 0 ? (
                            <Badge variant="default">Active</Badge>
                          ) : (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>{rotation.user_email}</TableCell>
                        <TableCell>{formatDate(rotation.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Key Display Dialog */}
      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              {hasExistingKey ? "API Key Rotated" : "API Key Generated"}
            </DialogTitle>
            <DialogDescription>
              Your new API key has been{" "}
              {hasExistingKey ? "rotated" : "generated"}. This is the only time
              you will see the full key.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Your New API Key</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={newlyGeneratedKey || ""}
                  readOnly
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> This key will not be shown again. Make
                sure to copy or download it now.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                newlyGeneratedKey && handleCopyKey(newlyGeneratedKey)
              }
            >
              <Copy className="h-4 w-4" />
              Copy
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                newlyGeneratedKey && handleDownloadKey(newlyGeneratedKey)
              }
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button onClick={() => setShowKeyDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Rotation */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Rotate API Key?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Rotating the API key will immediately invalidate your current key.
              Any applications using the current key will stop working until
              updated with the new key. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConfirmDialog(false);
                performKeyGeneration();
              }}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Rotating..." : "Rotate Key"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
