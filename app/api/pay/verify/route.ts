import { NextResponse } from "next/server";
import { z } from "zod";
import { deviceId } from "@/lib/session";
import { fetchOrder, verifySignature } from "@/lib/razorpay";
import { grantPass, status } from "@/lib/usage";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

const Body = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payment response." }, { status: 400 });
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sig } = parsed.data;

  if (!verifySignature(orderId, paymentId, sig)) {
    return NextResponse.json({ error: "Payment could not be verified." }, { status: 400 });
  }
  const id = await deviceId();
  const order = await fetchOrder(orderId);
  if (order.notes?.device && order.notes.device !== id) {
    return NextResponse.json({ error: "This payment belongs to another device." }, { status: 403 });
  }
  // Idempotent: one pass per payment.
  const s = store();
  if (!(await s.get(`payment:${paymentId}`))) {
    await grantPass(id);
    await s.set(`payment:${paymentId}`, id);
  }
  return NextResponse.json({ ok: true, status: await status(id) });
}
