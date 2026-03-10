"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  signInWithPassword,
  signInWithOAuth,
  getSession,
  signOut,
} from "@/lib/supabase";

export async function login(formData: FormData) {
  const { error } = await signInWithPassword(
    formData.get("email") as string,
    formData.get("password") as string
  );

  if (error) {
    redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");

  const next = formData.get("next") as string;
  redirect(next || "/");
}

export async function signInWithGoogle(next?: string) {
  const { data, error } = await signInWithOAuth("google", next);

  if (error) {
    redirect("/error");
  }

  redirect(data.url);
}

export async function signInWithGithub(next?: string) {
  const { data, error } = await signInWithOAuth("github", next);

  if (error) {
    redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
  }

  redirect(data.url);
}

export async function handleGoogleCallback() {
  const { error } = await getSession();

  if (error) {
    redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function handleGithubCallback() {
  const { error } = await getSession();

  if (error) {
    redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logout() {
  await signOut();
  revalidatePath("/", "layout");
  redirect("/auth/login");
}
