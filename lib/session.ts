import crypto from "node:crypto";
import { cookies, headers } from "next/headers";

const COOKIE = "rizz_id";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s === "change-me") {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is not set");
    return "dev-only-secret";
  }
  return s;
}

function sign(id: string) {
  return crypto.createHmac("sha256", secret()).update(id).digest("base64url").slice(0, 32);
}

/**
 * Anonymous device identity. No login needed: a signed, httpOnly cookie holds a random id.
 * Free usage and the paid pass hang off this id.
 */
export async function deviceId(): Promise<string> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (raw) {
    const [id, sig] = raw.split(".");
    if (id && sig && crypto.timingSafeEqual(Buffer.from(sign(id)), Buffer.from(sig.padEnd(32).slice(0, 32)))) {
      return id;
    }
  }
  const id = crypto.randomUUID();
  jar.set(COOKIE, `${id}.${sign(id)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return id;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}
