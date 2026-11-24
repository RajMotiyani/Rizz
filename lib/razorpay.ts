import crypto from "node:crypto";

const API = "https://api.razorpay.com/v1";

function keys() {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw new Error("Razorpay keys are not configured");
  return { id, secret };
}

export function razorpayKeyId(): string | null {
  return process.env.RAZORPAY_KEY_ID ?? null;
}

async function rzp<T>(pathname: string, init?: RequestInit): Promise<T> {
  const { id, secret } = keys();
  const res = await fetch(`${API}${pathname}`, {
    ...init,
    headers: {
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Razorpay ${res.status}: ${body?.error?.description ?? "error"}`);
  return body as T;
}

export type Order = { id: string; amount: number; currency: string };
export type Payment = {
  id: string;
  order_id: string | null;
  amount: number;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  created_at: number;
  notes: Record<string, string> | [];
};

export function createOrder(amountPaise: number, device: string): Promise<Order> {
  return rzp<Order>("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt: `rizz_${Date.now()}`,
      notes: { device, product: "weekly_pass" },
    }),
  });
}

export function fetchOrder(orderId: string): Promise<Order & { notes: Record<string, string> }> {
  return rzp(`/orders/${encodeURIComponent(orderId)}`);
}

export function fetchPayment(paymentId: string): Promise<Payment> {
  return rzp<Payment>(`/payments/${encodeURIComponent(paymentId)}`);
}

/** Checkout signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifySignature(orderId: string, paymentId: string, signature: string): boolean {
  const expected = crypto
    .createHmac("sha256", keys().secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature ?? "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
