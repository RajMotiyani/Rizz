import { NextResponse } from "next/server";

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
  return NextResponse.json({
    gemini,
    provider: process.env.AI_PROVIDER ?? (key ? "gemini" : "claude"),
    sessionSecret: process.env.SESSION_SECRET ? "set" : "missing",
    redis: process.env.UPSTASH_REDIS_REST_URL ? "set" : "not set",
    // Names only (never values), to spot typos like a trailing space.
    relatedNames: Object.keys(process.env).filter((k) => /gemini|session|secret/i.test(k)).map((k) => JSON.stringify(k)),
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    env: process.env.VERCEL_ENV ?? null,
  });
}
