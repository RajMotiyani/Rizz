import { NextResponse } from "next/server";
import { deviceId } from "@/lib/session";
import { status } from "@/lib/usage";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await status(await deviceId()));
}
