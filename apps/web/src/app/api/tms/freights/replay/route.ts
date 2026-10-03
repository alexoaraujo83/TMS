import { NextResponse } from "next/server";
import { auth0 } from "../../../../../lib/auth0";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const freightId = typeof body.freightId === "string" ? body.freightId.trim() : "";
  const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!freightId || !eventId) return NextResponse.json({ error: "Freight id and event id are required" }, { status: 400 });
  if (!apiBaseUrl) return NextResponse.json({ error: "NEXT_PUBLIC_API_BASE_URL is not configured" }, { status: 500 });
  try {
    const fetcher = await auth0.createFetcher(request, { baseUrl: apiBaseUrl });
    const response = await fetcher.fetchWithAuth(`/freights/${encodeURIComponent(freightId)}/status-events/${encodeURIComponent(eventId)}/replay`, { method: "POST", cache: "no-store" });
    const text = await response.text();
    return new NextResponse(text, { status: response.status, headers: { "content-type": response.headers.get("content-type") ?? "application/json" } });
  } catch (error) {
    return NextResponse.json({ error: "Authentication required", detail: error instanceof Error ? error.message : "Authentication required" }, { status: 401 });
  }
}
