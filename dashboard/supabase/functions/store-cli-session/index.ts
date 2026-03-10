import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * store-cli-session
 *
 * Called by the Dashboard after a user completes OAuth for CLI login.
 * Stores tokens in cli_auth_sessions keyed by the CLI-generated state.
 *
 * Requires service_role key (called from Dashboard server-side).
 *
 * POST body:
 * {
 *   "state": "...",
 *   "access_token": "...",
 *   "refresh_token": "...",
 *   "expires_at": 123456,
 *   "user_id": "...",
 *   "user_email": "..."
 * }
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const {
    state,
    access_token,
    refresh_token,
    expires_at,
    user_id,
    user_email,
  } = await req.json();

  if (!state || !access_token) {
    return new Response(
      JSON.stringify({ error: "state and access_token are required" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { error } = await supabase.from("cli_auth_sessions").upsert(
    {
      state,
      access_token,
      refresh_token: refresh_token ?? "",
      expires_at: expires_at ?? 0,
      user_id: user_id ?? "",
      user_email: user_email ?? "",
      created_at: new Date().toISOString(),
    },
    { onConflict: "state" }
  );

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
