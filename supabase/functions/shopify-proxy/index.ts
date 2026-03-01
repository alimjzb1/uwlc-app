import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user is authenticated via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[shopify-proxy] No authorization header");
      return jsonResponse({ error: "No authorization header" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      console.error("[shopify-proxy] Auth error:", authError?.message || "No user found");
      return jsonResponse({ error: "Unauthorized: " + (authError?.message || "Invalid token") }, 401);
    }

    console.log(`[shopify-proxy] Authenticated user: ${user.email}`);

    // Parse request body
    const body = await req.json();
    const { action, endpoint, params, code, shop } = body;

    // Fetch settings using service role key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: settings, error: settingsError } = await adminClient
      .from("shopify_settings")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error("[shopify-proxy] Settings error:", settingsError.message);
      return jsonResponse({ error: "Failed to fetch Shopify settings: " + settingsError.message }, 500);
    }

    if (!settings) {
      return jsonResponse({ error: "No active Shopify integration found. Please configure your Shopify connection first." }, 404);
    }

    // ──── ACTION: OAuth Token Exchange ────
    if (action === "exchange_token") {
      if (!code) {
        return jsonResponse({ error: "Missing authorization code" }, 400);
      }

      const shopDomain = settings.myshopify_url.replace(/^https?:\/\//, "").replace(/\/$/, "");
      console.log(`[shopify-proxy] Exchanging code for access token on ${shopDomain}`);

      const tokenResponse = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: settings.client_id,
          client_secret: settings.client_secret,
          code: code,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error(`[shopify-proxy] Token exchange failed: ${tokenResponse.status} - ${errorText}`);
        return jsonResponse({ error: `Token exchange failed: ${errorText}` }, tokenResponse.status);
      }

      const tokenData = await tokenResponse.json();
      console.log(`[shopify-proxy] Token exchange successful, scope: ${tokenData.scope}`);

      // Save the access token to shopify_settings
      const { error: updateError } = await adminClient
        .from("shopify_settings")
        .update({
          access_token: tokenData.access_token,
          updated_at: new Date().toISOString(),
        })
        .eq("id", settings.id);

      if (updateError) {
        console.error("[shopify-proxy] Failed to save access token:", updateError.message);
        return jsonResponse({ error: "Failed to save access token: " + updateError.message }, 500);
      }

      return jsonResponse({
        success: true,
        scope: tokenData.scope,
        message: "Access token obtained and saved successfully",
      });
    }

    // ──── ACTION: Get OAuth URL ────
    if (action === "get_oauth_url") {
      const shopDomain = settings.myshopify_url.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const scopes = "read_products,write_products,read_orders,write_orders,read_customers,write_customers";
      // The redirect URI should point back to the app's Integrations page
      const redirectUri = body.redirect_uri || `${supabaseUrl}/functions/v1/shopify-proxy/callback`;
      const nonce = crypto.randomUUID();

      const oauthUrl = `https://${shopDomain}/admin/oauth/authorize?client_id=${settings.client_id}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${nonce}`;

      return jsonResponse({ oauth_url: oauthUrl, state: nonce });
    }

    // ──── ACTION: API Proxy ────
    if (!endpoint) {
      return jsonResponse({ error: "Missing endpoint" }, 400);
    }

    // Use the stored access token (obtained via OAuth)
    const accessToken = settings.access_token;
    if (!accessToken) {
      return jsonResponse({
        error: "No access token found. Please authorize the Shopify app first using the 'Authorize App' button on the Integrations page.",
      }, 401);
    }

    const shopifyDomain = settings.myshopify_url.replace(/^https?:\/\//, "").replace(/\/$/, "");

    // Build query string
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          queryParams.set(key, String(value));
        }
      });
    }

    const queryString = queryParams.toString();
    const shopifyUrl = `https://${shopifyDomain}/admin/api/2024-01/${endpoint}.json${queryString ? `?${queryString}` : ""}`;

    console.log(`[shopify-proxy] Fetching: ${shopifyUrl}`);

    const shopifyResponse = await fetch(shopifyUrl, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    if (!shopifyResponse.ok) {
      const errorText = await shopifyResponse.text();
      console.error(`[shopify-proxy] Shopify API error: ${shopifyResponse.status} - ${errorText}`);
      return jsonResponse({
        error: `Shopify API error: ${shopifyResponse.status}`,
        details: errorText,
      }, shopifyResponse.status);
    }

    const data = await shopifyResponse.json();
    const linkHeader = shopifyResponse.headers.get("Link");

    return jsonResponse({ data, pagination: linkHeader || null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[shopify-proxy] Error:", message);
    return jsonResponse({ error: message }, 500);
  }
});

// Handle OAuth callback (GET request from Shopify redirect)
// This is handled by Supabase's routing for the function

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
