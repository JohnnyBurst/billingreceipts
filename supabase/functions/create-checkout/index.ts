// Shared helpers for the Stripe functions (Deno / Supabase Edge Functions).
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function stripe(path: string, params: Record<string, string>, method = "POST") {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  const res = await fetch("https://api.stripe.com/v1" + path, {
    method,
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "GET" ? undefined : new URLSearchParams(params).toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Stripe error " + res.status);
  return data;
}

// Identify the signed-in user from the request's bearer token.
async function currentUser(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  const r = await fetch(Deno.env.get("SUPABASE_URL") + "/auth/v1/user", {
    headers: { Authorization: auth, apikey: Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable_F7J1zBCig49ylQWYBrMmsg_GtZ4A1RT" },
  });
  if (!r.ok) return null;
  return await r.json(); // { id, email, ... }
}

// Service-role PostgREST call (bypasses RLS). Server-side only. Works with legacy or new-style secret keys.
function serviceKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try { const j = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"); return j.default || (Object.values(j)[0] as string) || ""; } catch { return ""; }
}
function admin(path: string, init: RequestInit = {}) {
  const key = serviceKey();
  const h: Record<string, string> = { apikey: key, "Content-Type": "application/json", ...((init.headers as Record<string, string>) || {}) };
  if (key.startsWith("eyJ")) h.Authorization = "Bearer " + key;
  return fetch(Deno.env.get("SUPABASE_URL") + "/rest/v1/" + path, { ...init, headers: h });
}

// POST { interval: "month" | "year" } with the user's bearer token -> { url } for Stripe Checkout.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const user = await currentUser(req);
    if (!user) return json({ error: "Sign in first." }, 401);
    const { interval } = await req.json().catch(() => ({ interval: "month" }));
    const price = Deno.env.get(interval === "year" ? "STRIPE_PRICE_YEAR" : "STRIPE_PRICE_MONTH");
    if (!price) return json({ error: "Pricing is not configured yet." }, 500);

    const site = Deno.env.get("SITE_URL") || "https://billingreceipts.com";
    const p = await (await admin("profiles?select=plan,stripe_customer_id&id=eq." + user.id)).json();
    if (p?.[0]?.plan === "pro") return json({ error: "You already have Pro." }, 400);

    const params: Record<string, string> = {
      mode: "subscription",
      "line_items[0][price]": price,
      "line_items[0][quantity]": "1",
      client_reference_id: user.id,
      "subscription_data[metadata][user_id]": user.id,
      allow_promotion_codes: "true",
      success_url: site + "/invoice-generator/?upgraded=1",
      cancel_url: site + "/#pricing",
    };
    if (p?.[0]?.stripe_customer_id) params.customer = p[0].stripe_customer_id;
    else params.customer_email = user.email;

    const s = await stripe("/checkout/sessions", params);
    return json({ url: s.url });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
