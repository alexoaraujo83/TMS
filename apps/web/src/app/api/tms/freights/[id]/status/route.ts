import { NextResponse } from "next/server";
import { auth0 } from "../../../../../../lib/auth0";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  let token: string;
  try {
    ({ token } = await auth0.getAccessToken());
  } catch {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!apiBaseUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_API_BASE_URL is not configured" },
      { status: 500 },
    );
  }

  const { id } = await params;
  const body = await request.text();

  const response = await fetch(apiBaseUrl + "/freights/" + encodeURIComponent(id) + "/status", {
    method: "PATCH",
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
    },
    body,
    cache: "no-store",
  });

  const responseBody = await response.text();
  return new NextResponse(responseBody, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
    },
  });
}
