import { NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";

async function proxyJson(request: Request, path: string, init: RequestInit = {}) {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!apiBaseUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_API_BASE_URL is not configured" },
      { status: 500 },
    );
  }

  try {
    const fetcher = await auth0.createFetcher(request, { baseUrl: apiBaseUrl });
    const response = await fetcher.fetchWithAuth(path, {
      ...init,
      cache: "no-store",
    });
    const body = await response.text();

    return new NextResponse(body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication required";
    return NextResponse.json(
      { error: "Authentication required", detail: message },
      { status: 401 },
    );
  }
}

export async function GET(request: Request) {
  return proxyJson(request, "/freights");
}

export async function POST(request: Request) {
  return proxyJson(request, "/freights", {
    method: "POST",
    body: await request.text(),
    headers: { "content-type": "application/json" },
  });
}
