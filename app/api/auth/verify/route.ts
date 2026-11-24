import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeEmail, startSession, verifyCode } from "@/lib/auth";

export const dynamic = "force-dynamic";

const Body = z.object({ email: z.string().max(254), code: z.string().regex(/^\d{6}$/) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  const email = parsed.success ? normalizeEmail(parsed.data.email) : null;
  if (!parsed.success || !email) return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
  try {
    const r = await verifyCode(email, parsed.data.code);
    if (!r.ok) {
      const msg = {
        expired: "That code has expired. Tap Resend to get a new one.",
        wrong: "Wrong code. Check your email and try again.",
        too_many: "Too many wrong tries. Tap Resend to get a new code.",
      }[r.reason];
      return NextResponse.json({ error: msg, reason: r.reason }, { status: 400 });
    }
    await startSession(r.user);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("verify failed", err);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
