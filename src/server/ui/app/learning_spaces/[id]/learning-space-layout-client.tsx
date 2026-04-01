"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, Plus } from "lucide-react";
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

// --- Context ---

interface LearningSpaceContextValue {
  id: string;
  space: LearningSpace | null;
  skills: AgentSkill[];
  sessions: LearningSpaceSession[];
  isLoading: boolean;
  refreshSkills: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  setExcludeTarget: (skill: AgentSkill | null) => void;
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

export function LearningSpaceLayoutClient({
  children,
}: {
  children: ReactNode;
}) {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("learningSpaces");

  const basePath = `/learning_spaces/${id}`;

  // Redirect to default tab if landing on bare path
  useEffect(() => {
    if (pathname === basePath || pathname === `${basePath}/`) {
      router.replace(`${basePath}/skills`);
    }
  }, [pathname, basePath, router]);

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

  const activeTab = pathname.endsWith("/sessions") ? "sessions" : "skills";

  const tabs = [
    { value: "skills", label: t("skillsTab"), href: `/learning_spaces/${id}/skills` },
    { value: "sessions", label: t("sessionsTab"), href: `/learning_spaces/${id}/sessions` },
  ];

  const ctxValue: LearningSpaceContextValue = {
    id,
    space,
    skills,
    sessions,
    isLoading,
    refreshSkills,
    refreshSessions,
    setExcludeTarget,
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
    <LearningSpaceContext.Provider value={ctxValue}>
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
          <h1 className="text-2xl font-bold">{t("detailTitle")}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-mono text-xs">
              {space.id}
            </Badge>
            {displayUser !== "—" && (
              <Badge variant="outline">{displayUser}</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>
              <span className="font-medium">{t("createdAt")}:</span>{" "}
              {new Date(space.created_at).toLocaleString()}
            </span>
            <span>
              <span className="font-medium">{t("updatedAt")}:</span>{" "}
              {new Date(space.updated_at).toLocaleString()}
            </span>
          </div>
          {space.meta !== null && Object.keys(space.meta).length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                {t("metaLabel")}:
              </p>
              <pre className="text-xs bg-muted px-3 py-2 rounded overflow-auto max-h-[150px]">
                {JSON.stringify(space.meta, null, 2)}
              </pre>
            </div>
          )}
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
                {t("includeSkill")}
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
                {t("learnFromSession")}
              </Button>
            )}
          </div>
        </div>

        {/* Tab content (child route) */}
        <div className="flex-1 flex flex-col min-h-0 rounded-md border-2 p-4">
          {children}
        </div>
      </div>

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
    </LearningSpaceContext.Provider>
  );
}
