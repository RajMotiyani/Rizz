import { NextResponse } from "next/server";
import { z } from "zod";
import { createCode, normalizeEmail, normalizePhone } from "@/lib/auth";
import { sendLoginCode } from "@/lib/email";
import { clientIp } from "@/lib/session";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

const Body = z.object({ email: z.string().max(254), phone: z.string().max(20) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your email and mobile number." }, { status: 400 });
  const email = normalizeEmail(parsed.data.email);
  if (!email) return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return NextResponse.json({ error: "Enter a valid 10-digit mobile number." }, { status: 400 });

  // Rate limits: 5 codes per email per hour, 20 per network per hour. Failed sends don't count.
  const s = store();
  const emailKey = `rl:code2:${email}`;
  const ipKey = `rl:codeip2:${await clientIp()}`;
  let counted = false;
  try {
    const perEmail = await s.incr(emailKey, 3600);
    const perIp = await s.incr(ipKey, 3600);
    counted = true;
    if (perEmail > 5 || perIp > 20) {
      return NextResponse.json({ error: "Too many codes requested. Try again in an hour." }, { status: 429 });
    }

    const code = await createCode(email, phone);
    await sendLoginCode(email, code);
  } catch (err) {
    console.error("send code failed", err);
    if (counted) await Promise.all([s.decr(emailKey), s.decr(ipKey)]).catch(() => {});
    return NextResponse.json({ error: "Couldn't send the code right now. Try again in a minute." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, email });
}
