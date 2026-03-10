"use server";

import { updateUserPassword } from "@/lib/supabase";

export async function updatePassword(
  prevState: { error?: string; success?: boolean } | null,
  formData: FormData
) {
  const password = formData.get("password") as string;

  const { error } = await updateUserPassword(password);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

