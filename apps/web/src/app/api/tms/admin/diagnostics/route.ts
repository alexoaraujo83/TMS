import { NextResponse } from "next/server";
import { auth0 } from "../../../../../lib/auth0";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!apiBaseUrl) {
    return NextResponse.json(
      { code: "DIAGNOSTIC_PROXY_NOT_CONFIGURED", message: "Diagnostics API is not configured" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }

  const incoming = new URL(request.url);
  const forwarded = new URLSearchParams();
  for (const key of ["kind", "value", "limit"]) {
    const value = incoming.searchParams.get(key);
    if (value !== null) forwarded.set(key, value);
  }

  try {
    const fetcher = await auth0.createFetcher(request, { baseUrl: apiBaseUrl });
    const response = await fetcher.fetchWithAuth("/admin/diagnostics?" + forwarded.toString(), {
      method: "GET",
      cache: "no-store",
    });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { code: "DIAGNOSTIC_SOURCE_UNAVAILABLE", message: "Diagnostics API is temporarily unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
