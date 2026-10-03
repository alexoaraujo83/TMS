import { NextResponse } from "next/server";
import { auth0 } from "../../../../../lib/auth0";

async function proxy(request: Request, path: string, method = "GET") {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!apiBaseUrl) return NextResponse.json({ error: "NEXT_PUBLIC_API_BASE_URL is not configured" }, { status: 500 });
  try {
    const fetcher = await auth0.createFetcher(request, { baseUrl: apiBaseUrl });
    const response = await fetcher.fetchWithAuth(path, { method, cache: "no-store" });
    const body = await response.text();
    return new NextResponse(body, { status: response.status, headers: { "content-type": response.headers.get("content-type") ?? "application/json" } });
  } catch (error) {
    return NextResponse.json({ error: "Authentication required", detail: error instanceof Error ? error.message : "Authentication required" }, { status: 401 });
  }
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Freight id is required" }, { status: 400 });
  return proxy(request, `/freights/${encodeURIComponent(id)}/status-events`);
}
