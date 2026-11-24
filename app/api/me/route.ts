import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { status } from "@/lib/usage";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ loggedIn: false }, { status: 401 });
  return NextResponse.json({ loggedIn: true, email: user.email ?? undefined, ...(await status(user.id)) });
}
