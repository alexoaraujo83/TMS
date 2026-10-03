import { NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";

export async function GET(request: Request) {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!apiBaseUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_API_BASE_URL is not configured" },
      { status: 500 },
    );
  }

  try {
    const fetcher = await auth0.createFetcher(request, { baseUrl: apiBaseUrl });
    const response = await fetcher.fetchWithAuth("/project-control/dashboard", {
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
    return NextResponse.json(
      {
        error: "Authentication required",
        detail: error instanceof Error ? error.message : "Unable to reach TMS API",
      },
      { status: 401 },
    );
  }
}
