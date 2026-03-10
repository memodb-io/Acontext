import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { User } from "@supabase/supabase-js";

interface UserState {
  user: User | null;
  setUser: (user: User | null) => void;
  signOut: () => Promise<void>;
}

// Lazy initialization of Supabase client to avoid SSR issues
let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient();
  }
  return supabaseClient;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  signOut: async () => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      set({ user: null });
    } catch (error) {
      console.error(error);
    }
  },
}));
