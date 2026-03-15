"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { encodeId } from "@/lib/id-codec";
import { useTopNavStore } from "@/stores/top-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CodeEditor } from "@/components/code-editor";
import { SkillList, type SkillItem } from "@/components/skill-list";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Loader2,
  ArrowLeft,
  Plus,
  ExternalLink,
} from "lucide-react";
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

interface LearningSpaceDetailClientProps {
  project: Project;
  spaceId: string;
}

export function LearningSpaceDetailClient({
  project,
  spaceId,
}: LearningSpaceDetailClientProps) {
  const router = useRouter();
  const { initialize, setHasSidebar } = useTopNavStore();

  useEffect(() => {
    initialize({ hasSidebar: true });
    return () => {
      setHasSidebar(false);
    };
  }, [initialize, setHasSidebar]);

  const projectId = project.id;
  const encodedProjectId = encodeId(projectId);

  const [space, setSpace] = useState<LearningSpace | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [sessions, setSessions] = useState<LearningSpaceSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState("skills");

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

  const returnTo = `/project/${encodedProjectId}/learning-spaces/${encodeId(spaceId)}`;

  const navigateToAgentSkills = (skill: SkillItem) => {
    const encodedSkillId = encodeId(skill.id);
    router.push(
      `/project/${encodedProjectId}/agent-skills/${encodedSkillId}?returnTo=${encodeURIComponent(returnTo)}`
    );
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

  const statusVariant = (status: LearningSpaceSession["status"]) => {
    switch (status) {
      case "completed":
        return "default" as const;
      case "running":
        return "secondary" as const;
      case "failed":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  };

  return (
    <div className="h-full bg-background p-6 flex flex-col overflow-hidden space-y-4">
      {/* Header row with back button and title */}
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
              <span>Created {new Date(space.created_at).toLocaleString()}</span>
              <span className="text-border">|</span>
              <span>Updated {new Date(space.updated_at).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between shrink-0">
          <TabsList>
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
          </TabsList>
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

        {/* Metadata Tab */}
        <TabsContent
          value="metadata"
          className="flex-1 flex flex-col min-h-0 mt-2"
        >
          <CodeEditor
            value={metaValue}
            onChange={handleMetaChange}
            language="json"
            height="100%"
          />
          {metaError && (
            <p className="text-sm text-destructive mt-1">{metaError}</p>
          )}
        </TabsContent>

        {/* Skills Tab */}
        <TabsContent
          value="skills"
          className="flex-1 flex flex-col min-h-0 mt-2"
        >
          <SkillList
            skills={skills}
            onSkillClick={navigateToAgentSkills}
            onSkillDelete={(skill) => setExcludeTarget(skill as AgentSkill)}
            emptyMessage="No skills associated. Add a skill to get started."
            deleteLabel="Remove"
            className="overflow-auto flex-1"
          />
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent
          value="sessions"
          className="flex-1 flex flex-col min-h-0 mt-2"
        >
          {sessions.length === 0 ? (
            <div className="flex items-center justify-center flex-1">
              <p className="text-sm text-muted-foreground">
                No learning sessions yet. Trigger learning from a session to
                get started.
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-auto flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session ID</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-mono text-sm">
                        {session.session_id.slice(0, 8)}&hellip;
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={statusVariant(session.status)}>
                          {session.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(session.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            const encodedSessionId = encodeId(
                              session.session_id
                            );
                            router.push(
                              `/project/${encodedProjectId}/session/${encodedSessionId}/messages?returnTo=${encodeURIComponent(returnTo)}`
                            );
                          }}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View Session
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

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
              Enter the session ID to trigger learning. The learning process
              will run asynchronously.
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

    </div>
  );
}
