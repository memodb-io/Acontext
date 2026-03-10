import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BANNER_CONFIG = {
  id: "chat-pro-trial-v1",
  visible: true,
  start_at: "2025-01-01T00:00:00Z",
  end_at: "2026-12-31T23:59:59Z",
  icon: "party",
  color: "#f59e0b",
  url: "https://cal.com/acontext/30min",
  html: 'Book a <a>30-min chat</a> with us · Get <a>1 month of Acontext Pro</a> free!',
};

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return new Response(JSON.stringify(BANNER_CONFIG), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
