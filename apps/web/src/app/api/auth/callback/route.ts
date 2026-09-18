import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "../../../../../../lib/auth0";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(new URL("/?auth=failed", request.url));
  }

  try {
    await exchangeCode(code, state);
    return NextResponse.redirect(new URL("/", request.url));
  } catch {
    return NextResponse.redirect(new URL("/?auth=failed", request.url));
  }
}
