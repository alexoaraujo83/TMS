import { NextResponse } from "next/server";
import { getAccessToken } from "../../../../lib/auth0";

export async function GET() {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!apiBaseUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_API_BASE_URL is not configured" }, { status: 500 });
  }

  const response = await fetch(`${apiBaseUrl}/freights`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
    },
  });
}
