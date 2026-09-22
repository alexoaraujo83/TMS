import { NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";

async function getToken(): Promise<string | null> {
  try {
    const { token } = await auth0.getAccessToken();
    return token;
  } catch {
    return null;
  }
}

async function getApiBaseUrl(): Promise<string | null> {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  return value || null;
}

async function proxyJson(
  request: Request,
  path: string,
  init: RequestInit = {},
): Promise<NextResponse> {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const apiBaseUrl = await getApiBaseUrl();
  if (!apiBaseUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_API_BASE_URL is not configured" },
      { status: 500 },
    );
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
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
    },
  });
}

export async function GET() {
  return proxyJson(new Request("http://localhost"), "/freights");
}

export async function POST(request: Request) {
  const body = await request.text();
  return proxyJson(new Request("http://localhost"), "/freights", {
    method: "POST",
    body,
  });
}
