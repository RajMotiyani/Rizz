import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { LANGUAGES, RefusedError } from "@/lib/claude";
import { translateReplies } from "@/lib/ai";
import { BusyError, QuotaError } from "@/lib/gemini";
import { istDay } from "@/lib/config";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  texts: z.array(z.string().trim().min(1).max(600)).min(1).max(4),
  language: z.enum(LANGUAGES),
});

/** Translating doesn't use up replies, but is capped per person per day to protect the free AI quota. */
const PER_DAY = 200;

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please log in again.", code: "auth" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Nothing to translate." }, { status: 400 });

  const key = `tr:${istDay()}:${user.id}`;
  const s = store();
  const n = await s.incr(key, 60 * 60 * 26);
  if (n > PER_DAY) {
    await s.decr(key).catch(() => {});
    return NextResponse.json({ error: "You've hit today's translation limit. Try again tomorrow 💜" }, { status: 429 });
  }

  try {
    const translations = await translateReplies(parsed.data.texts, parsed.data.language);
    return NextResponse.json({ translations });
  } catch (err) {
    await s.decr(key).catch(() => {});
    if (err instanceof RefusedError) return NextResponse.json({ error: "Couldn't translate that one." }, { status: 422 });
    if (err instanceof BusyError) return NextResponse.json({ error: "The AI is a bit overloaded. Tap translate again in a few seconds 🙏" }, { status: 503 });
    if (err instanceof QuotaError) return NextResponse.json({ error: "Rizz hit its free daily AI limit. It resets at 1:30 PM IST." }, { status: 503 });
    console.error("translate failed", err);
    return NextResponse.json({ error: "Couldn't translate right now. Try again." }, { status: 500 });
  }
}
