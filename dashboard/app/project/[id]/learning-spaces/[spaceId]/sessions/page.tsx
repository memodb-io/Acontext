"use client";

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
import { LearningSpaceSession } from "@/types";
import { useLearningSpaceContext } from "../learning-space-layout-client";

const statusVariant = (status: LearningSpaceSession["status"]) => {
  switch (status) {
    case "completed":
      return "default" as const;
    case "distilling":
      return "secondary" as const;
    case "failed":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
};

export default function SessionsPage() {
  const { projectId, sessions, returnTo, refreshSessions } =
    useLearningSpaceContext();

  if (sessions.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1">
        <p className="text-sm text-muted-foreground">
          No learning sessions yet. Trigger learning from a session to get
          started.
        </p>
      </div>
    );
  }

  return (
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
                {session.session_id}
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
                <SessionActions
                  projectId={projectId}
                  sessionId={session.session_id}
                  returnTo={returnTo}
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
