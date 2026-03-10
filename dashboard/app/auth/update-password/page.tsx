"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updatePassword } from "@/app/auth/update-password/actions";

function SubmitButton({
  label,
  loadingLabel,
}: {
  label: string;
  loadingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? loadingLabel : label}
    </Button>
  );
}

export default function UpdatePasswordPage() {
  const [state, formAction] = useActionState(updatePassword, null);

  return (
    <div className="flex flex-col gap-6">
      {state?.success ? (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold">
              Password Updated Successfully
            </h1>
            <p className="text-sm text-muted-foreground">
              Your password has been changed
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            You&apos;ve successfully updated your password. You can now sign in
            with your new password.
          </p>
          <Button asChild className="w-full">
            <Link href="/">Go Home</Link>
          </Button>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-2xl font-semibold">Reset Your Password</h1>
            <p className="text-sm text-muted-foreground">
              Please enter your new password below.
            </p>
          </div>
          <form action={formAction}>
            <div className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                />
              </div>
              {state?.error && (
                <p className="text-sm text-red-500">{state.error}</p>
              )}
              <SubmitButton
                label="Save new password"
                loadingLabel="Saving..."
              />
            </div>
          </form>
        </>
      )}
    </div>
  );
}
