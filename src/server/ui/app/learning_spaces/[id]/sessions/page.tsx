"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SessionActions } from "@/components/session-actions";
import { useLearningSpaceContext } from "../learning-space-layout-client";

export default function SessionsPage() {
  const { id, sessions, refreshSessions } = useLearningSpaceContext();
  const t = useTranslations("learningSpaces");

  if (sessions.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1">
        <p className="text-sm text-muted-foreground">{t("noSessions")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-auto flex-1">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("sessionId")}</TableHead>
            <TableHead className="text-center">{t("status")}</TableHead>
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
              <TableCell className="text-center">
                <Badge
                  variant={
                    session.status === "completed"
                      ? "default"
                      : session.status === "distilling"
                        ? "secondary"
                        : session.status === "failed"
                          ? "destructive"
                          : "outline"
                  }
                >
                  {t(`statusValue.${session.status}`)}
                </Badge>
              </TableCell>
              <TableCell>
                {new Date(session.created_at).toLocaleString()}
              </TableCell>
              <TableCell>
                <SessionActions
                  sessionId={session.session_id}
                  returnTo={`/learning_spaces/${id}/sessions`}
                  onDelete={refreshSessions}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
