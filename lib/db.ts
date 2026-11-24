/**
 * Minimal Supabase (PostgREST) client using the server-only secret key.
 * Tables and functions are created by supabase/schema.sql.
 */

export function dbConfigured(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const h: Record<string, string> = { apikey: key, "Content-Type": "application/json", ...extra };
  // Legacy JWT keys also go in the Authorization header; new sb_secret_ keys only need apikey.
  if (!key.startsWith("sb_")) h.Authorization = `Bearer ${key}`;
  return h;
}

export async function db<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; prefer?: string } = {},
): Promise<T> {
  const base = process.env.SUPABASE_URL!.replace(/\/$/, "");
  const res = await fetch(`${base}/rest/v1/${path}`, {
    method: init.method ?? "GET",
    headers: headers(init.prefer ? { Prefer: init.prefer } : {}),
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  return db<T>(`rpc/${fn}`, { method: "POST", body: args });
}

export type UserRow = {
  id: string;
  email: string;
  phone: string | null;
  created_at: string;
  last_login_at: string | null;
  login_count: number;
  replies_used: number;
};
