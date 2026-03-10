"use client";

import { useEffect, useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Copy, Plus, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useTopNavStore } from "@/stores/top-nav";
import { Organization, Project } from "@/types";
import { encodeId } from "@/lib/id-codec";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CodeEditor } from "@/components/code-editor";
import { rotateSecretKey } from "../api-keys/actions";

const SERVICE_URL = "api.acontext.app/api/v1";

interface OnboardingPageClientProps {
  project: Project;
  currentOrganization: Organization;
  allOrganizations: Organization[];
  projects: Project[];
  hasApiKey: boolean;
  currentApiKey: string | null;
  role: "owner" | "member";
}

export function OnboardingPageClient({
  project,
  currentOrganization,
  allOrganizations,
  projects,
  hasApiKey: initialHasApiKey,
  currentApiKey: initialApiKey,
  role,
}: OnboardingPageClientProps) {
  const { initialize, setHasSidebar } = useTopNavStore();
  const router = useRouter();
  const [language, setLanguage] = useState<"python" | "typescript">("python");
  const [hasApiKey, setHasApiKey] = useState(initialHasApiKey);
  const [apiKey, setApiKey] = useState<string>(
    initialApiKey || "your-api-key"
  );
  const [isPending, startTransition] = useTransition();
  const [newlyGeneratedKey, setNewlyGeneratedKey] = useState<string | null>(
    null
  );

  const isOwner = role === "owner";

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

  const handleCreateApiKey = () => {
    if (!isOwner) {
      toast.error("Only organization owners can create API keys");
      return;
    }

    startTransition(async () => {
      const result = await rotateSecretKey(project.id);
      if (result.error) {
        toast.error(result.error);
      } else if (result.secretKey) {
        setNewlyGeneratedKey(result.secretKey);
        setApiKey(result.secretKey);
        setHasApiKey(true);
        router.refresh();
        toast.success("API key created successfully");
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

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const installCommands = useMemo(
    () => ({
      python: "pip install acontext",
      typescript: "npm install @acontext/acontext",
    }),
    []
  );

  const runCommands = useMemo(
    () => ({
      python: "python main.py",
      typescript: "npx ts-node main.ts",
    }),
    []
  );

  const codeExamples = useMemo(
    () => ({
      python: `from acontext import AcontextClient

client = AcontextClient(
    base_url="https://${SERVICE_URL}",
    api_key="${apiKey}",
)

print(client.ping())

session = client.sessions.create()
client.sessions.store_message(
    session_id=session.id,
    blob={
        "role": "assistant",
        "content": """Here is my plan:
1. Use Next.js for the frontend
2. Use Supabase for the database
3. deploy to Cloudflare Pages
""",
    },
)
client.sessions.store_message(
    session_id=session.id,
    blob={
        "role": "user",
        "content": "Confirm, go ahead. Use tailwind for frontend styling.",
    },
)

messages = client.sessions.get_messages(session_id=session.id)
print(messages.items)`,
      typescript: `import { AcontextClient } from '@acontext/acontext';

const client = new AcontextClient({
  baseUrl: "https://${SERVICE_URL}",
  apiKey: "${apiKey}",
});

console.log(await client.ping());
const session = await client.sessions.create();
  await client.sessions.storeMessage(session.id, {
      role: "assistant",
      content: \`Here is my plan:
1. Use Next.js for the frontend
2. Use Supabase for the database
3. deploy to Cloudflare Pages\`,
    });
  await client.sessions.storeMessage(session.id, {
      role: "user",
      content: "Confirm, go ahead. Use tailwind for frontend styling.",
  });

const messages = await client.sessions.getMessages(session.id);
console.log(messages.items);`,
    }),
    [apiKey]
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-2">Get Started</h1>
            <p className="text-muted-foreground">
              Install and start using the Acontext API.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Tabs
              value={language}
              onValueChange={(v) => setLanguage(v as "python" | "typescript")}
            >
              <TabsList className="h-10 bg-muted/50 p-1">
                <TabsTrigger value="python" className="px-4 py-2 gap-2">
                  <Image
                    src="/python.svg"
                    alt="Python"
                    width={20}
                    height={20}
                  />
                  Python
                </TabsTrigger>
                <TabsTrigger value="typescript" className="px-4 py-2 gap-2">
                  <Image
                    src="/typescript.svg"
                    alt="TypeScript"
                    width={20}
                    height={20}
                  />
                  TypeScript
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative">
          <div className="absolute left-[15px] top-[40px] bottom-0 w-[2px] bg-border"></div>
          <div className="space-y-12">
            {/* Step 1: Install SDK */}
            <div className="relative pl-12">
              <div className="absolute left-0 w-8 h-8 text-primary-foreground rounded-full bg-primary flex items-center justify-center text-sm font-medium">
                1
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-4">Install the SDK</h2>
                <p className="mb-4">
                  Run the following command in your terminal to install the
                  Acontext SDK:
                </p>
                <div className="relative rounded-lg">
                  <pre className="p-4 rounded-lg overflow-x-auto bg-muted dark:bg-muted/50 text-foreground font-mono text-sm border">
                    <code>{installCommands[language]}</code>
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2.5 h-8 w-8 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => handleCopyCode(installCommands[language])}
                    aria-label="Copy code"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Step 2: Create API Key */}
            <div className="relative pl-12">
              <div
                className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${hasApiKey
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground border"
                  }`}
              >
                2
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-4">
                  Create an API Key
                </h2>
                <p className="mb-4">
                  Create an API key to authenticate your requests. For key
                  management, head to the{" "}
                  <a
                    href={`/project/${encodeId(project.id)}/api-keys`}
                    className="underline cursor-pointer hover:text-muted-foreground"
                  >
                    Keys
                  </a>{" "}
                  page.
                </p>
                {!hasApiKey ? (
                  <Button
                    onClick={handleCreateApiKey}
                    disabled={isPending || !isOwner}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    {isPending ? "Creating..." : "Create API Key"}
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Input
                        value={newlyGeneratedKey || apiKey}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          handleCopyKey(newlyGeneratedKey || apiKey)
                        }
                        title="Copy key"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    {newlyGeneratedKey && (
                      <Alert>
                        <KeyRound className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Important:</strong> This is the only time you
                          will see the full API key. Please copy it now and
                          store it securely.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Step 3: Test Connection */}
            <div className="relative pl-12">
              <div
                className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${hasApiKey
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground border"
                  }`}
              >
                3
              </div>
              <div
                className={hasApiKey ? "" : "opacity-40 pointer-events-none"}
              >
                <h2 className="text-xl font-semibold mb-4">Test Connection</h2>
                <p className="mb-4">
                  The example below will connect to the Acontext API and test
                  the connection:
                </p>
                <div className="relative rounded-lg">
                  <CodeEditor
                    value={codeExamples[language]}
                    language={language === "python" ? "python" : "typescript"}
                    readOnly
                    height="420px"
                    className="rounded-lg"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2.5 h-8 w-8 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => handleCopyCode(codeExamples[language])}
                    aria-label="Copy code"
                    disabled={!hasApiKey}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Step 4: Run Example */}
            <div className="relative pl-12">
              <div
                className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${hasApiKey
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground border"
                  }`}
              >
                4
              </div>
              <div
                className={hasApiKey ? "" : "opacity-40 pointer-events-none"}
              >
                <h2 className="text-xl font-semibold mb-4">Run the Example</h2>
                <p className="mb-4">
                  Run the following command in your terminal to run the example:
                </p>
                <div className="relative rounded-lg">
                  <pre className="p-4 rounded-lg overflow-x-auto bg-muted dark:bg-muted/50 text-foreground font-mono text-sm border">
                    <code>{runCommands[language]}</code>
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2.5 h-8 w-8 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => handleCopyCode(runCommands[language])}
                    aria-label="Copy code"
                    disabled={!hasApiKey}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Step 5: That's It */}
            <div className="relative pl-12">
              <div
                className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${hasApiKey
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground border"
                  }`}
              >
                5
              </div>
              <div
                className={hasApiKey ? "" : "opacity-40 pointer-events-none"}
              >
                <h2 className="text-xl font-semibold mb-4">That&apos;s It</h2>
                <p className="text-muted-foreground">
                  You&apos;re all set! Explore more features in the{" "}
                  <a href={`/project/${encodeId(project.id)}`} className="text-primary">
                    Project Overview
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
