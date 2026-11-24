import { NextResponse } from "next/server";
import { deviceId } from "@/lib/session";
import { createOrder, razorpayKeyId } from "@/lib/razorpay";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function POST() {
  const id = await deviceId();
  try {
    const order = await createOrder(config.passPricePaise, id);
    return NextResponse.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: razorpayKeyId() });
  } catch (err) {
    console.error("order failed", err);
    return NextResponse.json({ error: "Payments are unavailable right now." }, { status: 500 });
  }
}
