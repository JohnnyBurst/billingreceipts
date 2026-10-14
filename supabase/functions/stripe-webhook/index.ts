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

// Stripe -> Supabase. Verifies the signature, then sets profiles.plan to 'pro' or 'free'.
// Deploy with "Verify JWT" OFF (Stripe does not send a Supabase token).

const enc = new TextEncoder();
async function verify(payload: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const t = parts["t"], sig = header.split(",").filter((x) => x.startsWith("v1=")).map((x) => x.slice(3));
  if (!t || !sig.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // reject replays older than 5 min
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(t + "." + payload));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return sig.some((s) => s.length === hex.length && s === hex);
}

const setByUser = (id: string, patch: Record<string, unknown>) =>
  admin("profiles?id=eq." + id, { method: "PATCH", body: JSON.stringify(patch) });
const setByCustomer = (c: string, patch: Record<string, unknown>) =>
  admin("profiles?stripe_customer_id=eq." + encodeURIComponent(c), { method: "PATCH", body: JSON.stringify(patch) });

Deno.serve(async (req) => {
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const body = await req.text();
  if (!secret || !(await verify(body, req.headers.get("stripe-signature") || "", secret))) {
    return new Response("bad signature", { status: 400 });
  }
  const ev = JSON.parse(body), o = ev.data.object;
  try {
    if (ev.type === "checkout.session.completed" && o.mode === "subscription" && o.client_reference_id) {
      await setByUser(o.client_reference_id, { plan: "pro", stripe_customer_id: o.customer, stripe_subscription_id: o.subscription });
    } else if (ev.type === "customer.subscription.updated" || ev.type === "customer.subscription.deleted") {
      const active = ev.type !== "customer.subscription.deleted" && ["active", "trialing", "past_due"].includes(o.status);
      await setByCustomer(o.customer, { plan: active ? "pro" : "free", stripe_subscription_id: o.id });
    }
  } catch (e) {
    return new Response("handler error: " + (e as Error).message, { status: 500 }); // Stripe will retry
  }
  return new Response("ok");
});
