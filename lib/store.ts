import fs from "node:fs";
import path from "node:path";
import { db, dbConfigured, rpc } from "./db";

/**
 * Tiny key-value store. Uses Upstash Redis (REST) when configured, which is what you
 * want on Vercel. Otherwise falls back to a JSON file, fine for local dev or one VPS.
 */
export interface Store {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  incr(key: string, ttlSeconds: number): Promise<number>;
  decr(key: string): Promise<number>;
  del(key: string): Promise<void>;
}

class UpstashStore implements Store {
  constructor(private url: string, private token: string) {}
  private async cmd(...args: (string | number)[]): Promise<unknown> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Upstash ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { result: unknown; error?: string };
    if (data.error) throw new Error(`Upstash: ${data.error}`);
    return data.result;
  }
  async get(key: string) {
    return (await this.cmd("GET", key)) as string | null;
  }
  async set(key: string, value: string, ttl?: number) {
    if (ttl) await this.cmd("SET", key, value, "EX", ttl);
    else await this.cmd("SET", key, value);
  }
  async incr(key: string, ttl: number) {
    const n = (await this.cmd("INCR", key)) as number;
    if (n === 1) await this.cmd("EXPIRE", key, ttl);
    return n;
  }
  async decr(key: string) {
    return (await this.cmd("DECR", key)) as number;
  }
  async del(key: string) {
    await this.cmd("DEL", key);
  }
}

type Entry = { v: string; exp?: number };

class FileStore implements Store {
  // On serverless hosts (Vercel) only /tmp is writable, and it's per-instance, so limits are approximate there.
  private file = process.env.VERCEL
    ? path.join("/tmp", "rizz-store.json")
    : path.join(process.cwd(), ".data", "store.json");
  private data: Record<string, Entry> = {};
  constructor() {
    try {
      this.data = JSON.parse(fs.readFileSync(this.file, "utf8"));
    } catch {
      this.data = {};
    }
  }
  private save() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data));
    } catch {
      // Read-only filesystem: keep data in memory only.
    }
  }
  private live(key: string): Entry | undefined {
    const e = this.data[key];
    if (e?.exp && e.exp < Date.now()) {
      delete this.data[key];
      return undefined;
    }
    return e;
  }
  async get(key: string) {
    return this.live(key)?.v ?? null;
  }
  async set(key: string, value: string, ttl?: number) {
    this.data[key] = { v: value, exp: ttl ? Date.now() + ttl * 1000 : undefined };
    this.save();
  }
  async incr(key: string, ttl: number) {
    const e = this.live(key);
    const n = Number(e?.v ?? 0) + 1;
    this.data[key] = { v: String(n), exp: e?.exp ?? Date.now() + ttl * 1000 };
    this.save();
    return n;
  }
  async decr(key: string) {
    const e = this.live(key);
    const n = Number(e?.v ?? 0) - 1;
    this.data[key] = { v: String(n), exp: e?.exp };
    this.save();
    return n;
  }
  async del(key: string) {
    delete this.data[key];
    this.save();
  }
}

/** Uses the Supabase kv table (see supabase/schema.sql), so limits are shared across servers. */
class SupabaseStore implements Store {
  async get(key: string) {
    const rows = await db<{ value: string; expires_at: string | null }[]>(
      `kv?key=eq.${encodeURIComponent(key)}&select=value,expires_at`,
    );
    const r = rows[0];
    if (!r || (r.expires_at && new Date(r.expires_at).getTime() < Date.now())) return null;
    return r.value;
  }
  async set(key: string, value: string, ttl?: number) {
    await db("kv", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: { key, value, expires_at: ttl ? new Date(Date.now() + ttl * 1000).toISOString() : null },
    });
  }
  async incr(key: string, ttl: number) {
    return Number(await rpc("kv_incr", { k: key, ttl_seconds: ttl, delta: 1 }));
  }
  async decr(key: string) {
    return Number(await rpc("kv_incr", { k: key, ttl_seconds: 172800, delta: -1 }));
  }
  async del(key: string) {
    await db(`kv?key=eq.${encodeURIComponent(key)}`, { method: "DELETE", prefer: "return=minimal" });
  }
}

const g = globalThis as unknown as { __rizzStore?: Store };

export function store(): Store {
  if (!g.__rizzStore) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    g.__rizzStore = url && token ? new UpstashStore(url, token) : dbConfigured() ? new SupabaseStore() : new FileStore();
  }
  return g.__rizzStore;
}
