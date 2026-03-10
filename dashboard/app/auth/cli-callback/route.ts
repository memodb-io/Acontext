import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * CLI login relay (polling-based).
 *
 * Two modes:
 *
 * 1. Direct (user already logged in to Dashboard):
 *    GET /auth/cli-callback?state=xxx
 *    → Read existing session → store tokens via Edge Function
 *
 * 2. OAuth callback (user just completed OAuth via Supabase):
 *    GET /auth/cli-callback?code=xxx&state=xxx
 *    → Exchange code for session → store tokens via Edge Function
 *
 * If user is not logged in and no code is present, redirect to
 * Dashboard login with a return URL back here.
 *
 * The CLI polls the claim-cli-session Edge Function to retrieve tokens.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const state = searchParams.get("state");
  const code = searchParams.get("code");

  if (!state) {
    return NextResponse.redirect(
      `${origin}/auth/error?error=Missing state parameter`
    );
  }

  const supabase = await createClient();

  // Mode 2: OAuth callback with authorization code
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.session) {
      return NextResponse.redirect(
        `${origin}/auth/error?error=${encodeURIComponent(error?.message || "Failed to exchange code")}`
      );
    }
    return storeAndRespond(state, data.session, data.user);
  }

  // Mode 1: User already has a session in Dashboard
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return storeAndRespond(state, session, user);
  }

  // Not logged in — redirect to Dashboard login, then come back here
  const returnURL = new URL(`${origin}/auth/cli-callback`);
  returnURL.searchParams.set("state", state);

  const loginURL = new URL(`${origin}/auth/login`);
  loginURL.searchParams.set("next", returnURL.pathname + returnURL.search);

  return NextResponse.redirect(loginURL.toString());
}

async function storeAndRespond(
  state: string,
  session: {
    access_token: string;
    refresh_token: string;
    expires_at?: number | null;
  },
  user: { id: string; email?: string | null } | null
) {
  const adminSupabase = await createAdminClient();

  const { error } = await adminSupabase.functions.invoke("store-cli-session", {
    body: {
      state,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at ?? 0,
      user_id: user?.id ?? "",
      user_email: user?.email ?? "",
    },
  });

  if (error) {
    const html = buildHTML("Login Failed", `Could not store session: ${error.message}`);
    return new NextResponse(html, {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }

  const html = buildHTML(
    "Login Successful!",
    "You can close this tab and return to the terminal."
  );
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

function buildHTML(title: string, message: string) {
  return `<!DOCTYPE html>
<html><head><title>${title}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f8f9fa}div{text-align:center;padding:2rem;background:white;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.1)}</style>
</head><body><div><h2>${title}</h2><p>${message}</p></div></body></html>`;
}
