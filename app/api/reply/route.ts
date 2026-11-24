import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { clientIp, deviceId } from "@/lib/session";
import { claim, status } from "@/lib/usage";
import { LANGUAGES, RefusedError, TONES } from "@/lib/claude";
import { generateReplies } from "@/lib/ai";
import { BusyError, QuotaError } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const Body = z.object({
  images: z
    .array(
      z.object({
        mediaType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
        data: z.string().max(Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 8),
      }),
    )
    .max(3)
    .default([]),
  chatText: z.string().max(6000).default(""),
  tone: z.enum(TONES),
  language: z.enum(LANGUAGES),
  goal: z.string().max(200).default(""),
  match: z
    .object({
      name: z.string().trim().min(1).max(40),
      memory: z.string().max(1200).default(""),
      scores: z.array(z.number().min(0).max(100)).max(10).default([]),
    })
    .nullable()
    .default(null),
});

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request. Images must be under 4 MB." }, { status: 400 });
  }
  if (!body.images.length && !body.chatText.trim()) {
    return NextResponse.json({ error: "Add a screenshot or paste the chat first." }, { status: 400 });
  }

  if (!process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Rizz isn't set up yet: the AI key is missing on the server." }, { status: 503 });
  }

  const id = await deviceId();
  const c = await claim(id, await clientIp());
  if (!c.ok) {
    return NextResponse.json(
      { error: "You've used all your replies for today. Come back tomorrow! 💜", code: "limit", status: await status(id) },
      { status: 429 },
    );
  }

  try {
    const result = await generateReplies({ ...body, chatText: body.chatText.trim(), goal: body.goal.trim() });
    return NextResponse.json({ result, status: await status(id) });
  } catch (err) {
    await c.release();
    if (err instanceof RefusedError) {
      return NextResponse.json({ error: "Couldn't help with that chat. Try a different one." }, { status: 422 });
    }
    if (err instanceof BusyError) {
      return NextResponse.json({ error: "The AI is a bit overloaded right now. Wait a few seconds and tap again 🙏 (this one didn't count)" }, { status: 503 });
    }
    if (err instanceof QuotaError) {
      return NextResponse.json({ error: "Rizz hit its free daily AI limit. It resets at 1:30 PM IST. Sorry! 🙏" }, { status: 503 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Too busy right now, try again in a moment." }, { status: 503 });
    }
    if (err instanceof Anthropic.BadRequestError) {
      console.error("Claude bad request", err.message);
      return NextResponse.json({ error: "Couldn't read that image. Try a PNG or JPG screenshot." }, { status: 400 });
    }
    console.error("reply failed", err);
    return NextResponse.json({ error: "Something went wrong. That one didn't count, try again." }, { status: 500 });
  }
}
