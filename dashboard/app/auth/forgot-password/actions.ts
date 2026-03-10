"use server";

import { resetPasswordForEmail } from "@/lib/supabase";

export async function forgotPassword(
  prevState: { error?: string; success?: boolean } | null,
  formData: FormData
) {
  const email = formData.get("email") as string;

  const { error } = await resetPasswordForEmail(email);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

