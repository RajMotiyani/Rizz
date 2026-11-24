import { NextResponse } from "next/server";
import { deviceId } from "@/lib/session";
import { status } from "@/lib/usage";
import { config } from "@/lib/config";
import { razorpayKeyId } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

export async function GET() {
  const id = await deviceId();
  return NextResponse.json({
    ...(await status(id)),
    pricePaise: config.passPricePaise,
    passDays: config.passDays,
    razorpayKeyId: razorpayKeyId(),
  });
}
