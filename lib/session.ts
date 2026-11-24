import crypto from "node:crypto";
import { cookies, headers } from "next/headers";

const COOKIE = "rizz_id";

let warned = false;
function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s !== "change-me") return s;
  // The cookie only guards daily limits, so rather than take the app down, derive a
  // stable secret from another server-only value and log a warning.
  if (!warned) {
    console.warn("SESSION_SECRET is not set; using a derived fallback. Set it in your environment variables.");
    warned = true;
  }
  const base = process.env.GEMINI_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? "dev-only-secret";
  return crypto.createHash("sha256").update(`rizz-session:${base}`).digest("hex");
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
