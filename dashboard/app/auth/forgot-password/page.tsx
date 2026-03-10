"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { forgotPassword } from "@/app/auth/forgot-password/actions";

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

export default function ForgotPasswordPage() {
  const [state, formAction] = useActionState(forgotPassword, null);

  return (
    <div className="flex flex-col gap-6">
      {state?.success ? (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold">Check Your Email</h1>
            <p className="text-sm text-muted-foreground">
              Password reset instructions sent
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            If you registered using your email and password, you will receive a
            password reset email.
          </p>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-2xl font-semibold">Reset Your Password</h1>
            <p className="text-sm text-muted-foreground">
              Type in your email and we&apos;ll send you a link to reset your
              password
            </p>
          </div>
          <form action={formAction}>
            <div className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="example@email.com"
                  required
                />
              </div>
              {state?.error && (
                <p className="text-sm text-red-500">{state.error}</p>
              )}
              <SubmitButton label="Send reset email" loadingLabel="Sending..." />
            </div>
          </form>
          <div className="text-center text-sm">
            Already have an account?{" "}
            <Link href="/auth/login" className="underline underline-offset-4">
              Login
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
