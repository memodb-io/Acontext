"use server";

import { redirect } from "next/navigation";
import { signUp } from "@/lib/supabase";

export async function signup(formData: FormData) {
  const { error, data } = await signUp(
    formData.get("email") as string,
    formData.get("password") as string
  );

  if (error) {
    redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
  }

  if (data.user?.identities?.length === 0) {
    redirect(
      `/auth/error?error=${encodeURIComponent("Email already registered")}`
    );
  }

  redirect(`/auth/sign-up-success`);
}
