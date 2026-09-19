import { NextResponse } from "next/server";
import { clearSession, logoutUrl } from "../../../../lib/auth0";

export async function GET() {
  await clearSession();
  return NextResponse.redirect(logoutUrl());
}
