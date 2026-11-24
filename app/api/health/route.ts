import { NextResponse } from "next/server";
import { authEnabled } from "@/lib/auth";
import { db, dbConfigured, rpc } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Shows which settings are present (never their values), to debug deployments. */
export async function GET() {
  const key = process.env.GEMINI_API_KEY;
  let gemini: string = key ? "set" : "missing";
  if (key) {
    try {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", {
        headers: { "x-goog-api-key": key },
        cache: "no-store",
      });
      gemini = r.ok ? "working" : `rejected (${r.status})`;
    } catch {
      gemini = "unreachable";
    }
  }
  let database = dbConfigured() ? "set" : "not set";
  if (dbConfigured()) {
    try {
      await db("users?select=id&limit=1");
      await rpc("kv_incr", { k: "health:ping", ttl_seconds: 60, delta: 1 }); // checks the functions exist too
      database = "working";
    } catch (e) {
      database = `error: ${(e as Error).message.slice(0, 120)}`;
    }
  }
  // Email (Brevo): checks the key and that EMAIL_FROM is a verified sender. Never returns the key.
  let email = "not set";
  const bkey = process.env.BREVO_API_KEY ?? process.env.BREVO_KEY;
  if (bkey) {
    const kind = bkey.startsWith("xkeysib-") ? "api key" : bkey.startsWith("xsmtpsib-") ? "SMTP key (wrong type: need an API key starting xkeysib-)" : "unknown key format";
    try {
      const r = await fetch("https://api.brevo.com/v3/senders", { headers: { "api-key": bkey, accept: "application/json" }, cache: "no-store" });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        email = `error ${r.status} (${kind}): ${String(body?.message ?? body?.code ?? "").slice(0, 160)}`;
      } else {
        const from = (process.env.EMAIL_FROM ?? "").toLowerCase();
        const sender = (body.senders ?? []).find((x: { email: string }) => x.email.toLowerCase() === from);
        email = !sender ? `key ok, but EMAIL_FROM is not a sender in Brevo (${(body.senders ?? []).length} senders found)` : sender.active ? "working" : "key ok, but the sender is not verified yet";
      }
    } catch (e) {
      email = `unreachable: ${(e as Error).message}`;
    }
  }
  return NextResponse.json({
    email,
    login: authEnabled() ? "on" : `off (missing: ${[["BREVO_API_KEY", (process.env.BREVO_API_KEY ?? process.env.BREVO_KEY)], ["EMAIL_FROM", process.env.EMAIL_FROM], ["SUPABASE_URL", process.env.SUPABASE_URL], ["SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY]].filter(([, v]) => !v).map(([k]) => k).join(", ")})`,
    database,
    gemini,
    provider: process.env.AI_PROVIDER ?? (key ? "gemini" : "claude"),
    sessionSecret: process.env.SESSION_SECRET ? "set" : "missing",
    redis: process.env.UPSTASH_REDIS_REST_URL ? "set" : "not set",
    // Names only (never values), to spot typos like a trailing space.
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    env: process.env.VERCEL_ENV ?? null,
  });
}
