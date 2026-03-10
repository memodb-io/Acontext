"use client";

import { useFormStatus } from "react-dom";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signup } from "@/app/auth/sign-up/actions";

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

export default function SignUpPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold">Create Account</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email below to create an account
        </p>
      </div>

      <form action={signup}>
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
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
            />
          </div>
          <SubmitButton label="Sign up" loadingLabel="Signing up..." />
        </div>
      </form>

      <div className="text-center text-sm">
        Already have an account?{" "}
        <Link href="/auth/login" className="underline underline-offset-4">
          Login
        </Link>
      </div>
    </div>
  );
}
