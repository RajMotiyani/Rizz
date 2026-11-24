import { NextResponse } from "next/server";
import { z } from "zod";
import { deviceId } from "@/lib/session";
import { fetchPayment } from "@/lib/razorpay";
import { status } from "@/lib/usage";
import { store } from "@/lib/store";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

const Body = z.object({ paymentId: z.string().regex(/^pay_[A-Za-z0-9]{6,30}$/) });

/**
 * Move a pass to this device using the Razorpay payment ID from the receipt.
 * Useful when someone clears cookies or switches phones. The pass moves, it isn't copied.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a payment ID like pay_XXXXXXXX." }, { status: 400 });
  const { paymentId } = parsed.data;

  let payment;
  try {
    payment = await fetchPayment(paymentId);
  } catch {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }
  const notes = Array.isArray(payment.notes) ? {} : payment.notes;
  if (!["captured", "authorized"].includes(payment.status) || payment.amount < config.passPricePaise) {
    return NextResponse.json({ error: "That payment isn't a completed pass purchase." }, { status: 400 });
  }
  if (notes.product && notes.product !== "weekly_pass") {
    return NextResponse.json({ error: "That payment isn't a pass purchase." }, { status: 400 });
  }
  const exp = payment.created_at * 1000 + config.passDays * 24 * 60 * 60 * 1000;
  if (exp <= Date.now()) return NextResponse.json({ error: "That pass has expired." }, { status: 410 });

  const id = await deviceId();
  const s = store();
  const prev = await s.get(`payment:${paymentId}`);
  if (prev && prev !== id) await s.del(`pass:${prev}`);
  const ttl = Math.ceil((exp - Date.now()) / 1000);
  const current = Number((await s.get(`pass:${id}`)) ?? 0);
  if (exp > current) await s.set(`pass:${id}`, String(exp), ttl);
  await s.set(`payment:${paymentId}`, id);
  return NextResponse.json({ ok: true, status: await status(id) });
}
