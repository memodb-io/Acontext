"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Trash2,
  FolderOpen,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  getLearningSpace,
  listSpaceSkills,
  listSpaceSessions,
  includeSkill,
  excludeSkill,
  learnFromSession,
} from "@/app/learning_spaces/actions";
import { getUsers } from "@/app/users/actions";
import { LearningSpace, LearningSpaceSession, AgentSkill } from "@/types";

export default function LearningSpaceDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const t = useTranslations("learningSpaces");

  const [space, setSpace] = useState<LearningSpace | null>(null);
  const [userIdentifier, setUserIdentifier] = useState<string | null>(null);
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [sessions, setSessions] = useState<LearningSpaceSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [includeDialogOpen, setIncludeDialogOpen] = useState(false);
  const [includeSkillId, setIncludeSkillId] = useState("");
  const [isIncluding, setIsIncluding] = useState(false);

  const [excludeTarget, setExcludeTarget] = useState<AgentSkill | null>(null);
  const [isExcluding, setIsExcluding] = useState(false);

  const [learnDialogOpen, setLearnDialogOpen] = useState(false);
  const [learnSessionId, setLearnSessionId] = useState("");
  const [isLearning, setIsLearning] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setError(null);
      setSpace(null);
      setSkills([]);
      setSessions([]);
      setUserIdentifier(null);
      setIsLoading(true);
      try {
        const [spaceRes, skillsRes, sessionsRes] = await Promise.all([
          getLearningSpace(id),
          listSpaceSkills(id),
          listSpaceSessions(id),
        ]);

        if (spaceRes.code !== 0) {
          setError(spaceRes.message);
          return;
        }

        setSpace(spaceRes.data);
        setSkills(skillsRes.data ?? []);
        setSessions(sessionsRes.data ?? []);

        if (spaceRes.data?.user_id) {
          try {
            const usersRes = await getUsers(200);
            if (usersRes.code === 0 && usersRes.data?.items) {
              const found = usersRes.data.items.find(
                (u) => u.id === spaceRes.data!.user_id
              );
              if (found) {
                setUserIdentifier(found.identifier);
              }
            }
          } catch {
            // User resolution is non-critical
          }
        }
      } catch (err) {
        setError("Failed to load learning space");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [id]);

  const refreshSkills = async () => {
    try {
      const res = await listSpaceSkills(id);
      if (res.code === 0) {
        setSkills(res.data ?? []);
      } else {
        toast.error(t("fetchError"));
      }
    } catch {
      toast.error(t("fetchError"));
    }
  };

  const refreshSessions = async () => {
    try {
      const res = await listSpaceSessions(id);
      if (res.code === 0) {
        setSessions(res.data ?? []);
      } else {
        toast.error(t("fetchError"));
      }
    } catch {
      toast.error(t("fetchError"));
    }
  };

  const handleIncludeSkill = async () => {
    if (!includeSkillId.trim()) return;
    setIsIncluding(true);
    try {
      const res = await includeSkill(id, includeSkillId.trim());
      if (res.code !== 0) {
        toast.error(res.message);
        return;
      }
      toast.success(t("includeSuccess"));
      setIncludeDialogOpen(false);
      setIncludeSkillId("");
      await refreshSkills();
    } catch (err) {
      toast.error(t("includeError"));
      console.error(err);
    } finally {
      setIsIncluding(false);
    }
  };

  const handleExcludeSkill = async () => {
    if (!excludeTarget) return;
    setIsExcluding(true);
    try {
      const res = await excludeSkill(id, excludeTarget.id);
      if (res.code !== 0) {
        toast.error(res.message);
        return;
      }
      toast.success(t("excludeSuccess"));
      setExcludeTarget(null);
      await refreshSkills();
    } catch (err) {
      toast.error(t("excludeError"));
      console.error(err);
    } finally {
      setIsExcluding(false);
    }
  };

  const handleLearnFromSession = async () => {
    if (!learnSessionId.trim()) return;
    setIsLearning(true);
    try {
      const res = await learnFromSession(id, learnSessionId.trim());
      if (res.code !== 0) {
        toast.error(res.message);
        return;
      }
      toast.success(t("learnSuccess"));
      setLearnDialogOpen(false);
      setLearnSessionId("");
      await refreshSessions();
    } catch (err) {
      toast.error(t("learnError"));
      console.error(err);
    } finally {
      setIsLearning(false);
    }
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
        <Button
          variant="outline"
          onClick={() => router.push("/learning_spaces")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("backToList")}
        </Button>
      </div>
    );
  }

  if (!space) return null;

  const displayUser =
    space.user_id === null
      ? "—"
      : userIdentifier ?? `${space.user_id.slice(0, 8)}…`;

  return (
    <div className="h-full bg-background p-6 flex flex-col overflow-hidden space-y-4">
      {/* Back button */}
      <div className="shrink-0">
        <Button
          variant="ghost"
          onClick={() => router.push("/learning_spaces")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("backToList")}
        </Button>
      </div>

      {/* Header */}
      <div className="shrink-0 space-y-2">
        <h1 className="text-2xl font-bold">
          {t("spaceId")}: {space.id.slice(0, 8)}&hellip;
        </h1>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span>
            <span className="font-medium">{t("userId")}:</span> {displayUser}
          </span>
          <span>
            <span className="font-medium">{t("createdAt")}:</span>{" "}
            {new Date(space.created_at).toLocaleString()}
          </span>
          <span>
            <span className="font-medium">{t("updatedAt")}:</span>{" "}
            {new Date(space.updated_at).toLocaleString()}
          </span>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">
            {t("metaLabel")}:
          </p>
          {space.meta !== null ? (
            <pre className="text-xs bg-muted px-3 py-2 rounded overflow-auto max-h-[150px]">
              {JSON.stringify(space.meta, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="skills" className="flex-1 flex flex-col min-h-0">
        <TabsList className="shrink-0">
          <TabsTrigger value="skills">{t("skillsTab")}</TabsTrigger>
          <TabsTrigger value="sessions">{t("sessionsTab")}</TabsTrigger>
        </TabsList>

        {/* Skills Tab */}
        <TabsContent value="skills" className="flex-1 flex flex-col min-h-0">
          <div className="flex justify-end mb-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIncludeSkillId("");
                setIncludeDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t("includeSkill")}
            </Button>
          </div>

          {skills.length === 0 ? (
            <div className="flex items-center justify-center flex-1">
              <p className="text-sm text-muted-foreground">{t("noSkills")}</p>
            </div>
          ) : (
            <div className="overflow-auto flex-1 space-y-3">
              {skills.map((skill) => (
                <div
                  key={skill.id}
                  className="rounded-md border bg-card p-4 space-y-3"
                >
                  {/* Skill header: name + badge + remove */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm">{skill.name}</h3>
                      <Badge variant="secondary">
                        {skill.file_index?.length || 0}{" "}
                        {t("files")}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/agent_skills/${skill.id}`)}
                      >
                        <FolderOpen className="h-4 w-4" />
                        {t("viewFiles")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setExcludeTarget(skill)}
                      >
                        <Trash2 className="h-4 w-4" />
                        {t("remove")}
                      </Button>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {skill.description || t("noDescription")}
                  </p>

                  {/* Meta */}
                  {skill.meta &&
                    Object.keys(skill.meta).length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          {t("metaLabel")}
                        </p>
                        <pre className="text-xs bg-muted px-3 py-2 rounded overflow-auto max-h-[150px]">
                          {JSON.stringify(skill.meta, null, 2)}
                        </pre>
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="flex-1 flex flex-col min-h-0">
          <div className="flex justify-end mb-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLearnSessionId("");
                setLearnDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t("learnFromSession")}
            </Button>
          </div>

          {sessions.length === 0 ? (
            <div className="flex items-center justify-center flex-1">
              <p className="text-sm text-muted-foreground">
                {t("noSessions")}
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-auto flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("sessionId")}</TableHead>
                    <TableHead>{t("createdAt")}</TableHead>
                    <TableHead>{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-mono text-sm">
                        {session.session_id.slice(0, 8)}&hellip;
                      </TableCell>
                      <TableCell>
                        {new Date(session.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            router.push(
                              `/session/${session.session_id}/messages`
                            )
                          }
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          {t("viewSession")}
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
            <DialogTitle>{t("includeSkillTitle")}</DialogTitle>
            <DialogDescription>
              {t("includeSkillDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="text"
              placeholder={t("skillIdPlaceholder")}
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
              {t("cancel")}
            </Button>
            <Button
              onClick={handleIncludeSkill}
              disabled={isIncluding || !includeSkillId.trim()}
            >
              {isIncluding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("loading")}
                </>
              ) : (
                t("confirm")
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
            <AlertDialogTitle>
              {t("excludeSkillConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("excludeSkillConfirmDescription", {
                name: excludeTarget?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isExcluding}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcludeSkill}
              disabled={isExcluding}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isExcluding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("loading")}
                </>
              ) : (
                t("remove")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Learn from Session Dialog */}
      <Dialog open={learnDialogOpen} onOpenChange={setLearnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("learnTitle")}</DialogTitle>
            <DialogDescription>{t("learnDescription")}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="text"
              placeholder={t("sessionIdPlaceholder")}
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
              {t("cancel")}
            </Button>
            <Button
              onClick={handleLearnFromSession}
              disabled={isLearning || !learnSessionId.trim()}
            >
              {isLearning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("loading")}
                </>
              ) : (
                t("confirm")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
