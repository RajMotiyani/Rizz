import { NextResponse } from "next/server";
import { authEnabled } from "@/lib/auth";
import { db, dbConfigured } from "@/lib/db";

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
      database = "working";
    } catch (e) {
      database = `error: ${(e as Error).message.slice(0, 120)}`;
    }
  }
  return NextResponse.json({
    login: authEnabled() ? "on" : "off (add BREVO_API_KEY and EMAIL_FROM)",
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
