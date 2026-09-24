import { NextResponse } from "next/server";
import { auth0 } from "../../../../../../lib/auth0";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!apiBaseUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_API_BASE_URL is not configured" },
      { status: 500 },
    );
  }

  const { id } = await params;

  try {
    const fetcher = await auth0.createFetcher(request, { baseUrl: apiBaseUrl });
    const body = await request.text();
    const response = await fetcher.fetchWithAuth(
      "/freights/" + encodeURIComponent(id) + "/status",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body,
        cache: "no-store",
      },
    );

    const responseBody = await response.text();
    return new NextResponse(responseBody, {
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
