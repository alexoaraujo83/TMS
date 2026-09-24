import { auth0 } from "@/lib/auth0";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const accessToken = await auth0.getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const response = await fetch(
      `${process.env.TMS_API_BASE_URL}/freights/runtime-auth-claims`,
      {
        headers: {
          Authorization: `Bearer ${accessToken.token}`,
        },
        cache: "no-store",
      },
    );

    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
}
