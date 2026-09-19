import { NextResponse } from "next/server";
import { buildLoginUrl } from "../../../../lib/auth0";

export async function GET() {
  return NextResponse.redirect(await buildLoginUrl());
}
