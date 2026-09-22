import { NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";

async function proxyJson(path: string, init: RequestInit = {}) {
  let token: string;
  try {
    ({ token } = await auth0.getAccessToken());
  } catch {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!apiBaseUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_API_BASE_URL is not configured" }, { status: 500 });
  }

  const response = await fetch(apiBaseUrl + path, {
    ...init,
    headers: {
      authorization: "Bearer " + token,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
  });
}

export async function GET() {
  return proxyJson("/freights");
}

export async function POST(request: Request) {
  return proxyJson("/freights", { method: "POST", body: await request.text() });
}
