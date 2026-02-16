"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2, RefreshCw, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  getLearningSpaces,
  createLearningSpace,
  deleteLearningSpace,
} from "@/app/learning_spaces/actions";
import { getUsers } from "@/app/users/actions";
import { LearningSpace } from "@/types";

function getValidMeta(meta: string, hasError: boolean): string | undefined {
  if (!meta || hasError) return undefined;
  return meta;
}

export default function LearningSpacesPage() {
  const t = useTranslations("learningSpaces");
  const router = useRouter();

  const [spaces, setSpaces] = useState<LearningSpace[]>([]);
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterUser, setFilterUser] = useState("");
  const [filterMeta, setFilterMeta] = useState("");
  const [metaJsonError, setMetaJsonError] = useState(false);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createUser, setCreateUser] = useState("");
  const [createMeta, setCreateMeta] = useState("");
  const [createMetaError, setCreateMetaError] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchSpaces = useCallback(
    async (userFilter?: string, metaFilter?: string) => {
      setIsLoading(true);
      try {
        const allSpaces: LearningSpace[] = [];
        let cursor: string | undefined = undefined;
        let hasMore = true;
        while (hasMore) {
          const res = await getLearningSpaces(
            50,
            cursor,
            userFilter || undefined,
            true,
            metaFilter || undefined
          );
          if (res.code !== 0) {
            console.error(res.message);
            break;
          }
          allSpaces.push(...(res.data?.items || []));
          cursor = res.data?.next_cursor;
          hasMore = res.data?.has_more || false;
        }
        setSpaces(allSpaces);

        const userIds = [
          ...new Set(allSpaces.map((s) => s.user_id).filter(Boolean)),
        ] as string[];
        if (userIds.length > 0) {
          const usersRes = await getUsers(200);
          if (usersRes.code === 0 && usersRes.data?.items) {
            const map = new Map<string, string>();
            for (const u of usersRes.data.items) {
              map.set(u.id, u.identifier);
            }
            setUserMap(map);
          }
        } else {
          setUserMap(new Map());
        }
      } catch (error) {
        console.error("Failed to load learning spaces:", error);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const isFirstRender = useRef(true);
  useEffect(() => {
    const validMeta = getValidMeta(filterMeta, metaJsonError);
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchSpaces(filterUser || undefined, validMeta);
      return;
    }
    if (filterMeta && metaJsonError) return;
    const timer = setTimeout(
      () => fetchSpaces(filterUser || undefined, validMeta),
      500
    );
    return () => clearTimeout(timer);
  }, [filterUser, filterMeta, metaJsonError, fetchSpaces]);

  const handleMetaFilterChange = (value: string) => {
    setFilterMeta(value);
    if (value === "") {
      setMetaJsonError(false);
      return;
    }
    try {
      JSON.parse(value);
      setMetaJsonError(false);
    } catch {
      setMetaJsonError(true);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchSpaces(
      filterUser || undefined,
      getValidMeta(filterMeta, metaJsonError)
    );
    setIsRefreshing(false);
  };

  const handleOpenCreate = () => {
    setCreateUser("");
    setCreateMeta("");
    setCreateMetaError(false);
    setCreateDialogOpen(true);
  };

  const handleCreateMetaChange = (value: string) => {
    setCreateMeta(value);
    if (value === "") {
      setCreateMetaError(false);
      return;
    }
    try {
      JSON.parse(value);
      setCreateMetaError(false);
    } catch {
      setCreateMetaError(true);
    }
  };

  const handleCreate = async () => {
    if (createMeta && createMetaError) return;
    setIsCreating(true);
    try {
      let parsedMeta: Record<string, unknown> | undefined = undefined;
      if (createMeta) {
        parsedMeta = JSON.parse(createMeta);
      }
      const res = await createLearningSpace(
        createUser || undefined,
        parsedMeta
      );
      if (res.code !== 0) {
        toast.error(res.message);
        return;
      }
      toast.success(t("createSuccess"));
      setCreateDialogOpen(false);
      setCreateUser("");
      setCreateMeta("");
      await fetchSpaces(
        filterUser || undefined,
        getValidMeta(filterMeta, metaJsonError)
      );
    } catch (error) {
      toast.error(t("createError"));
      console.error("Failed to create learning space:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      const res = await deleteLearningSpace(deleteTargetId);
      if (res.code !== 0) {
        toast.error(res.message);
        return;
      }
      toast.success(t("deleteSuccess"));
      setDeleteDialogOpen(false);
      setDeleteTargetId(null);
      await fetchSpaces(
        filterUser || undefined,
        getValidMeta(filterMeta, metaJsonError)
      );
    } catch (error) {
      toast.error(t("deleteError"));
      console.error("Failed to delete learning space:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const filtersActive = filterUser !== "" || filterMeta !== "";

  return (
    <div className="h-full bg-background p-6 flex flex-col overflow-hidden space-y-2">
      <div className="shrink-0 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("description")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleOpenCreate}>
              <Plus className="h-4 w-4" />
              {t("create")}
            </Button>
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("loading")}
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  {t("refresh")}
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            type="text"
            placeholder={t("filterByUser")}
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="max-w-sm"
          />
          <div className="flex flex-col">
            <Input
              type="text"
              placeholder={t("filterByMeta")}
              value={filterMeta}
              onChange={(e) => handleMetaFilterChange(e.target.value)}
              className="max-w-sm"
            />
            {metaJsonError && filterMeta !== "" && (
              <p className="text-destructive text-xs mt-1">
                {t("invalidJson")}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 rounded-md border overflow-hidden flex flex-col min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : spaces.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">
              {filtersActive ? t("noSpacesMatching") : t("noSpaces")}
            </p>
          </div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("id")}</TableHead>
                  <TableHead>{t("user")}</TableHead>
                  <TableHead>{t("meta")}</TableHead>
                  <TableHead>{t("createdAt")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spaces.map((space) => (
                  <TableRow
                    key={space.id}
                    className="cursor-pointer"
                    onClick={() =>
                      router.push(`/learning_spaces/${space.id}`)
                    }
                  >
                    <TableCell className="font-mono text-sm">
                      {space.id.slice(0, 8)}&hellip;
                    </TableCell>
                    <TableCell>
                      {space.user_id === null
                        ? "—"
                        : userMap.get(space.user_id) ??
                          `${space.user_id.slice(0, 8)}…`}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {(() => {
                        if (space.meta === null) return "—";
                        const metaStr = JSON.stringify(space.meta);
                        return metaStr.length > 50
                          ? metaStr.slice(0, 50) + "…"
                          : metaStr;
                      })()}
                    </TableCell>
                    <TableCell>
                      {new Date(space.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/learning_spaces/${space.id}`);
                          }}
                        >
                          {t("details")}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTargetId(space.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createTitle")}</DialogTitle>
            <DialogDescription>{t("createDescription")}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("user")}</label>
              <Input
                type="text"
                placeholder={t("userPlaceholder")}
                value={createUser}
                onChange={(e) => setCreateUser(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("metaLabel")}</label>
              <Textarea
                placeholder={t("metaPlaceholder")}
                value={createMeta}
                onChange={(e) => handleCreateMetaChange(e.target.value)}
                rows={4}
              />
              {createMetaError && createMeta !== "" && (
                <p className="text-destructive text-xs">{t("invalidJson")}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={isCreating}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isCreating || (createMeta !== "" && createMetaError)}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("loading")}
                </>
              ) : (
                t("create")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirmDescription", {
                id: deleteTargetId
                  ? deleteTargetId.slice(0, 8) + "…"
                  : "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("loading")}
                </>
              ) : (
                t("delete")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
