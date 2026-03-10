"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash2 } from "lucide-react";
import { useTopNavStore } from "@/stores/top-nav";
import type { OrganizationMember } from "@/lib/supabase/operations/organizations";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { inviteMember, removeMember } from "./actions";
import { toast } from "sonner";

interface TeamPageClientProps {
  organizationId: string;
  organizationName: string;
  members: OrganizationMember[];
  role: "owner" | "member";
  currentUserId: string;
}

export function TeamPageClient({
  organizationId,
  organizationName,
  members,
  role,
  currentUserId,
}: TeamPageClientProps) {
  const { initialize, setHasSidebar } = useTopNavStore();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"owner" | "member">("member");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<OrganizationMember | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Initialize top-nav state when page loads
    initialize({
      title: "",
      organization: {
        id: organizationId,
        name: organizationName,
        plan: "free",
        is_default: false,
      },
      project: null,
      organizations: [],
      projects: [],
      hasSidebar: true,
    });

    // Cleanup: reset hasSidebar when leaving this page
    return () => {
      setHasSidebar(false);
    };
  }, [organizationId, organizationName, initialize, setHasSidebar]);

  const handleInvite = () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Email is required");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Invalid email format");
      return;
    }

    startTransition(async () => {
      setError(null);
      const result = await inviteMember(
        organizationId,
        trimmedEmail,
        memberRole
      );
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setEmail("");
        setMemberRole("member");
        setInviteDialogOpen(false);
        toast.success("Member invited successfully");
        router.refresh();
      }
    });
  };

  const isOwner = role === "owner";

  const getInitials = (email?: string) => {
    if (email) {
      return email[0].toUpperCase();
    }
    return "?";
  };

  const handleDeleteClick = (member: OrganizationMember) => {
    setMemberToDelete(member);
    setDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (!memberToDelete) return;

    setIsDeleting(true);
    startTransition(async () => {
      const result = await removeMember(organizationId, memberToDelete.user_id);
      if (result.error) {
        toast.error(result.error);
        setIsDeleting(false);
      } else {
        toast.success("Member removed successfully");
        setDeleteDialogOpen(false);
        setMemberToDelete(null);
        setIsDeleting(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Team</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Manage your organization members
              </p>
            </div>
            {isOwner && (
              <Button onClick={() => setInviteDialogOpen(true)}>
                <UserPlus className="h-4 w-4" />
                Invite Member
              </Button>
            )}
          </div>

          {/* Members List */}
          <Card className="p-0">
            <CardContent className="p-1">
              {members.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No members found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      {isOwner && <TableHead className="w-[100px]">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.user_id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              {member.avatar_url && (
                                <AvatarImage
                                  src={member.avatar_url}
                                  alt={member.email || "User"}
                                />
                              )}
                              <AvatarFallback>
                                {getInitials(member.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">
                                {member.email || "Unknown User"}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              member.role === "owner" ? "default" : "secondary"
                            }
                          >
                            {member.role === "owner" ? "Owner" : "Member"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(member.created_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })}
                        </TableCell>
                        {isOwner && (
                          <TableCell>
                            {member.user_id !== currentUserId && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteClick(member)}
                                className="h-8 w-8 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Invite Member Dialog */}
      <Dialog
        open={inviteDialogOpen}
        onOpenChange={(open) => {
          setInviteDialogOpen(open);
          if (!open) {
            setEmail("");
            setMemberRole("member");
            setError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>
              Add a new member to your organization by email address
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && email.trim()) {
                    handleInvite();
                  }
                }}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select
                value={memberRole}
                onValueChange={(value) => {
                  setMemberRole(value as "owner" | "member");
                  setError(null);
                }}
                disabled={isPending}
              >
                <SelectTrigger id="invite-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setInviteDialogOpen(false);
                setEmail("");
                setMemberRole("member");
                setError(null);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={isPending || !email.trim()}
            >
              {isPending ? "Inviting..." : "Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Member Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-semibold">{memberToDelete?.email}</span> from
              this organization? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
