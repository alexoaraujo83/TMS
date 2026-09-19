import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/auth0";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ authenticated: false });

  return NextResponse.json({
    authenticated: true,
    user: session.user ?? null,
    expiresAt: session.expiresAt,
  });
}
