import { NextResponse } from "next/server";

import { auth0 } from "../../../../../../lib/auth0";

function jsonResponse(response: Response) {
  return response.text().then((body) =>
    new NextResponse(body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
      },
    }),
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { token } = await auth0.getAccessToken();
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
    if (!apiBaseUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_API_BASE_URL is not configured" },
        { status: 500 },
      );
    }

    const { id } = await context.params;
    const response = await fetch(
      apiBaseUrl + "/freights/" + encodeURIComponent(id) + "/status",
      {
        method: "PATCH",
        headers: {
          authorization: "Bearer " + token,
          "content-type": "application/json",
        },
        body: await request.text(),
        cache: "no-store",
      },
    );

    return jsonResponse(response);
  } catch {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
}
