import crypto from "node:crypto";
import { cookies } from "next/headers";
import { db, dbConfigured, rpc, type UserRow } from "./db";
import { store } from "./store";
import { deviceId, secret } from "./session";
import { brevoKey } from "./email";

const COOKIE = "rizz_session";
const SESSION_DAYS = 30;
const CODE_TTL = 10 * 60;
const MAX_ATTEMPTS = 5;

export type User = { id: string; email: string; phone: string | null };

export function normalizeEmail(e: string): string | null {
  const v = e.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254 ? v : null;
}

/** Accepts 10-digit Indian numbers (adds +91) or international numbers with a leading +. */
export function normalizePhone(p: string): string | null {
  const digits = p.replace(/[\s\-()]/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^0[6-9]\d{9}$/.test(digits)) return `+91${digits.slice(1)}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  if (/^\+\d{8,15}$/.test(digits)) return digits;
  return null;
}

function hmac(v: string) {
  return crypto.createHmac("sha256", secret()).update(v).digest("base64url");
}

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Create a 6-digit code, store its hash, and return the code to email. */
export async function createCode(email: string, phone: string): Promise<string> {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await store().set(
    `code:${email}`,
    JSON.stringify({ h: hmac(`${email}:${code}`), phone, attempts: 0, exp: Date.now() + CODE_TTL * 1000 }),
    CODE_TTL,
  );
  return code;
}

export type VerifyResult = { ok: true; user: User } | { ok: false; reason: "expired" | "wrong" | "too_many" };

export async function verifyCode(email: string, code: string): Promise<VerifyResult> {
  const s = store();
  const raw = await s.get(`code:${email}`);
  if (!raw) return { ok: false, reason: "expired" };
  const rec = JSON.parse(raw) as { h: string; phone: string; attempts: number; exp: number };
  if (rec.exp < Date.now()) return { ok: false, reason: "expired" };
  if (rec.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many" };
  if (!same(rec.h, hmac(`${email}:${code}`))) {
    rec.attempts++;
    await s.set(`code:${email}`, JSON.stringify(rec), Math.max(1, Math.ceil((rec.exp - Date.now()) / 1000)));
    return { ok: false, reason: rec.attempts >= MAX_ATTEMPTS ? "too_many" : "wrong" };
  }
  await s.del(`code:${email}`);
  return { ok: true, user: await recordLogin(email, rec.phone) };
}

async function recordLogin(email: string, phone: string): Promise<User> {
  if (dbConfigured()) {
    const row = await rpc<UserRow>("record_login", { e: email, p: phone });
    return { id: row.id, email: row.email, phone: row.phone };
  }
  // Local dev without a database: keep users in the key-value store.
  const key = `user:${email}`;
  const existing = await store().get(key);
  const u: User = existing ? { ...JSON.parse(existing), phone } : { id: crypto.randomUUID(), email, phone };
  await store().set(key, JSON.stringify(u));
  await store().set(`userid:${u.id}`, JSON.stringify(u));
  return u;
}

export async function recordReply(userId: string): Promise<void> {
  if (dbConfigured()) await rpc("record_reply", { uid: userId }).catch((e) => console.error("record_reply", e));
}

export async function startSession(user: User) {
  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  const payload = Buffer.from(JSON.stringify({ id: user.id, e: user.email, exp })).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${hmac(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/**
 * Login is switched on once email sending is configured (or AUTH_DEV_LOG=1 for testing).
 * Until then the app keeps working anonymously, keyed on the device cookie.
 */
export function authEnabled(): boolean {
  // Needs email sending AND the user database, so accounts are never kept in temporary storage.
  return (!!(brevoKey() && process.env.EMAIL_FROM) && dbConfigured()) || process.env.AUTH_DEV_LOG === "1";
}

/** The logged-in user, or null. When login is off, an anonymous per-device user. */
export async function currentUser(): Promise<{ id: string; email: string | null } | null> {
  if (!authEnabled()) return { id: await deviceId(), email: null };
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig || !same(sig, hmac(payload))) return null;
  try {
    const { id, e, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof exp !== "number" || exp < Date.now()) return null;
    return { id, email: e };
  } catch {
    return null;
  }
}

export { db };
