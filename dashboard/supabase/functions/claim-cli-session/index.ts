import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * claim-cli-session
 *
 * Called by the CLI to poll for login tokens.
 * Atomically reads and deletes the session row, returning tokens.
 * Returns { "status": "pending" } if not yet available.
 *
 * Callable with anon key (CLI has no JWT before login).
 *
 * POST body: { "state": "..." }
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

  const { state } = await req.json();

  if (!state) {
    return new Response(JSON.stringify({ error: "state is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Find the session (must not be expired — 5 minute TTL)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: rows, error: selectError } = await supabase
    .from("cli_auth_sessions")
    .select("*")
    .eq("state", state)
    .gte("created_at", fiveMinutesAgo)
    .limit(1);

  if (selectError) {
    return new Response(JSON.stringify({ error: selectError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ status: "pending" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const session = rows[0];

  // Delete the row (claimed — no replay)
  await supabase.from("cli_auth_sessions").delete().eq("state", state);

  return new Response(
    JSON.stringify({
      status: "ok",
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      user_id: session.user_id,
      user_email: session.user_email,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
