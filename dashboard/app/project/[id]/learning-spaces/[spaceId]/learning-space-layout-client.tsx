"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { encodeId } from "@/lib/id-codec";
import { useTopNavStore } from "@/stores/top-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Project,
  LearningSpace,
  LearningSpaceSession,
  AgentSkill,
  User,
} from "@/types";
import {
  getLearningSpace,
  updateLearningSpace,
  listSpaceSkills,
  listSpaceSessions,
  includeSkill,
  excludeSkill,
  learnFromSession,
} from "../actions";
import { getAllUsers } from "../../actions";

// --- Context ---

interface LearningSpaceContextValue {
  projectId: string;
  encodedProjectId: string;
  spaceId: string;
  space: LearningSpace | null;
  setSpace: (space: LearningSpace) => void;
  users: User[];
  skills: AgentSkill[];
  sessions: LearningSpaceSession[];
  isLoading: boolean;
  error: string | null;
  refreshSkills: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  // Metadata
  metaValue: string;
  metaError: string;
  isMetaValid: boolean;
  isSavingMeta: boolean;
  metaDirty: boolean;
  handleMetaChange: (value: string) => void;
  handleSaveMeta: () => Promise<void>;
  // Skill actions
  setExcludeTarget: (skill: AgentSkill | null) => void;
  // Navigation
  basePath: string;
  returnTo: string;
}

const LearningSpaceContext = createContext<LearningSpaceContextValue | null>(
  null
);

export function useLearningSpaceContext() {
  const ctx = useContext(LearningSpaceContext);
  if (!ctx)
    throw new Error(
      "useLearningSpaceContext must be used within LearningSpaceLayoutClient"
    );
  return ctx;
}

// --- Layout Client ---

interface LearningSpaceLayoutClientProps {
  project: Project;
  spaceId: string;
  children: ReactNode;
}

export function LearningSpaceLayoutClient({
  project,
  spaceId,
  children,
}: LearningSpaceLayoutClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { initialize, setHasSidebar } = useTopNavStore();

  useEffect(() => {
    initialize({ hasSidebar: true });
    return () => {
      setHasSidebar(false);
    };
  }, [initialize, setHasSidebar]);

  const projectId = project.id;
  const encodedProjectId = encodeId(projectId);
  const encodedSpaceId = encodeId(spaceId);
  const basePath = `/project/${encodedProjectId}/learning-spaces/${encodedSpaceId}`;
  const returnTo = basePath;

  // Redirect to default tab if landing on bare path
  useEffect(() => {
    if (pathname === basePath || pathname === `${basePath}/`) {
      router.replace(`${basePath}/skills`);
    }
  }, [pathname, basePath, router]);

  const [space, setSpace] = useState<LearningSpace | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [sessions, setSessions] = useState<LearningSpaceSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Metadata editor
  const [metaValue, setMetaValue] = useState("{}");
  const [metaError, setMetaError] = useState("");
  const [isMetaValid, setIsMetaValid] = useState(true);
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [metaDirty, setMetaDirty] = useState(false);

  // Include skill dialog
  const [includeDialogOpen, setIncludeDialogOpen] = useState(false);
  const [includeSkillId, setIncludeSkillId] = useState("");
  const [isIncluding, setIsIncluding] = useState(false);

  // Exclude skill dialog
  const [excludeTarget, setExcludeTarget] = useState<AgentSkill | null>(null);
  const [isExcluding, setIsExcluding] = useState(false);

  // Learn from session dialog
  const [learnDialogOpen, setLearnDialogOpen] = useState(false);
  const [learnSessionId, setLearnSessionId] = useState("");
  const [isLearning, setIsLearning] = useState(false);

  const getUserIdentifier = useCallback(
    (userId: string | null | undefined) => {
      if (!userId) return null;
      const user = users.find((u) => u.id === userId);
      return user?.identifier || null;
    },
    [users]
  );

  const loadData = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const [spaceData, skillsData, sessionsData, allUsers] =
        await Promise.all([
          getLearningSpace(projectId, spaceId),
          listSpaceSkills(projectId, spaceId),
          listSpaceSessions(projectId, spaceId),
          getAllUsers(projectId),
        ]);

      setSpace(spaceData);
      setMetaValue(
        spaceData?.meta ? JSON.stringify(spaceData.meta, null, 2) : "{}"
      );
      setMetaDirty(false);
      setMetaError("");
      setIsMetaValid(true);
      setSkills(skillsData ?? []);
      setSessions(sessionsData ?? []);
      setUsers(allUsers);
    } catch (err) {
      console.error("Failed to load learning space:", err);
      setError("Failed to load learning space");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, spaceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshSkills = async () => {
    try {
      const data = await listSpaceSkills(projectId, spaceId);
      setSkills(data ?? []);
    } catch {
      toast.error("Failed to refresh skills");
    }
  };

  const refreshSessions = async () => {
    try {
      const data = await listSpaceSessions(projectId, spaceId);
      setSessions(data ?? []);
    } catch {
      toast.error("Failed to refresh sessions");
    }
  };

  const handleIncludeSkill = async () => {
    if (!includeSkillId.trim()) return;
    setIsIncluding(true);
    try {
      await includeSkill(projectId, spaceId, includeSkillId.trim());
      toast.success("Skill added to learning space");
      setIncludeDialogOpen(false);
      setIncludeSkillId("");
      await refreshSkills();
    } catch (err) {
      console.error("Failed to include skill:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to add skill"
      );
    } finally {
      setIsIncluding(false);
    }
  };

  const handleExcludeSkill = async () => {
    if (!excludeTarget) return;
    setIsExcluding(true);
    try {
      await excludeSkill(projectId, spaceId, excludeTarget.id);
      toast.success("Skill removed from learning space");
      setExcludeTarget(null);
      await refreshSkills();
    } catch (err) {
      console.error("Failed to exclude skill:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to remove skill"
      );
    } finally {
      setIsExcluding(false);
    }
  };

  const handleLearnFromSession = async () => {
    if (!learnSessionId.trim()) return;
    setIsLearning(true);
    try {
      await learnFromSession(projectId, spaceId, learnSessionId.trim());
      toast.success("Learning triggered from session");
      setLearnDialogOpen(false);
      setLearnSessionId("");
      await refreshSessions();
    } catch (err) {
      console.error("Failed to learn from session:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to learn from session"
      );
    } finally {
      setIsLearning(false);
    }
  };

  const handleMetaChange = (value: string) => {
    setMetaValue(value);
    setMetaDirty(true);
    const trimmed = value.trim();
    if (!trimmed) {
      setIsMetaValid(false);
      setMetaError("JSON cannot be empty");
      return;
    }
    try {
      JSON.parse(trimmed);
      setIsMetaValid(true);
      setMetaError("");
    } catch (e) {
      setIsMetaValid(false);
      if (e instanceof SyntaxError) {
        setMetaError("Invalid JSON: " + e.message);
      }
    }
  };

  const handleSaveMeta = async () => {
    const trimmed = metaValue.trim();
    if (!trimmed) return;
    setIsSavingMeta(true);
    try {
      const parsed = JSON.parse(trimmed);
      const updated = await updateLearningSpace(projectId, spaceId, parsed);
      setSpace(updated);
      setMetaDirty(false);
      toast.success("Metadata saved");
    } catch (err) {
      console.error("Failed to save metadata:", err);
      if (err instanceof SyntaxError) {
        setMetaError("Invalid JSON: " + err.message);
      } else {
        toast.error(
          err instanceof Error ? err.message : "Failed to save metadata"
        );
      }
    } finally {
      setIsSavingMeta(false);
    }
  };

  const handleGoBack = () => {
    router.push(`/project/${encodedProjectId}/learning-spaces`);
  };

  // Determine active tab from pathname
  const activeTab = pathname.endsWith("/metadata")
    ? "metadata"
    : pathname.endsWith("/sessions")
      ? "sessions"
      : "skills";

  const tabs = [
    { value: "metadata", label: "Metadata", href: `${basePath}/metadata` },
    { value: "skills", label: "Skills", href: `${basePath}/skills` },
    { value: "sessions", label: "Sessions", href: `${basePath}/sessions` },
  ];

  const ctxValue: LearningSpaceContextValue = {
    projectId,
    encodedProjectId,
    spaceId,
    space,
    setSpace,
    users,
    skills,
    sessions,
    isLoading,
    error,
    refreshSkills,
    refreshSessions,
    metaValue,
    metaError,
    isMetaValid,
    isSavingMeta,
    metaDirty,
    handleMetaChange,
    handleSaveMeta,
    setExcludeTarget,
    basePath,
    returnTo,
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={handleGoBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Learning Spaces
        </Button>
      </div>
    );
  }

  if (!space) return null;

  const displayUser =
    space.user_id === null
      ? "—"
      : getUserIdentifier(space.user_id) ??
        `${space.user_id.slice(0, 8)}…`;

  return (
    <LearningSpaceContext.Provider value={ctxValue}>
      <div className="h-full bg-background p-6 flex flex-col overflow-hidden space-y-4">
        {/* Header */}
        <div className="shrink-0 space-y-2">
          <div className="flex items-stretch gap-2">
            <Button
              variant="outline"
              onClick={handleGoBack}
              className="rounded-l-md rounded-r-none h-auto px-3"
              title="Back to Learning Spaces"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Learning Space</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="font-mono">{space.id}</span>
                {displayUser !== "—" && (
                  <>
                    <span className="text-border">|</span>
                    <span>{displayUser}</span>
                  </>
                )}
                <span className="text-border">|</span>
                <span>
                  Created {new Date(space.created_at).toLocaleString()}
                </span>
                <span className="text-border">|</span>
                <span>
                  Updated {new Date(space.updated_at).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab bar + action buttons */}
        <div className="flex items-center justify-between shrink-0">
          <Tabs
            value={activeTab}
            onValueChange={(tab) => {
              const target = tabs.find((t) => t.value === tab);
              if (target) router.replace(target.href);
            }}
          >
            <TabsList>
              {tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex gap-2">
            {activeTab === "metadata" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveMeta}
                disabled={isSavingMeta || !isMetaValid || !metaDirty}
              >
                {isSavingMeta ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            )}
            {activeTab === "skills" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIncludeSkillId("");
                  setIncludeDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Add Skill
              </Button>
            )}
            {activeTab === "sessions" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLearnSessionId("");
                  setLearnDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Learn from Session
              </Button>
            )}
          </div>
        </div>

        {/* Tab content (child route) */}
        <div className="flex-1 flex flex-col min-h-0">{children}</div>
      </div>

      {/* Include Skill Dialog */}
      <Dialog open={includeDialogOpen} onOpenChange={setIncludeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Skill</DialogTitle>
            <DialogDescription>
              Enter the ID of the agent skill to associate with this learning
              space.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="text"
              placeholder="Skill ID (UUID)"
              value={includeSkillId}
              onChange={(e) => setIncludeSkillId(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIncludeDialogOpen(false)}
              disabled={isIncluding}
            >
              Cancel
            </Button>
            <Button
              onClick={handleIncludeSkill}
              disabled={isIncluding || !includeSkillId.trim()}
            >
              {isIncluding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exclude Skill Confirmation */}
      <AlertDialog
        open={excludeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setExcludeTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Skill</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-semibold">
                {excludeTarget?.name ?? "this skill"}
              </span>{" "}
              from this learning space?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isExcluding}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcludeSkill}
              disabled={isExcluding}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isExcluding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Learn from Session Dialog */}
      <Dialog open={learnDialogOpen} onOpenChange={setLearnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Learn from Session</DialogTitle>
            <DialogDescription>
              Enter the session ID to trigger learning. The learning process will
              run asynchronously.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="text"
              placeholder="Session ID (UUID)"
              value={learnSessionId}
              onChange={(e) => setLearnSessionId(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLearnDialogOpen(false)}
              disabled={isLearning}
            >
              Cancel
            </Button>
            <Button
              onClick={handleLearnFromSession}
              disabled={isLearning || !learnSessionId.trim()}
            >
              {isLearning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Learning...
                </>
              ) : (
                "Start Learning"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LearningSpaceContext.Provider>
  );
}
