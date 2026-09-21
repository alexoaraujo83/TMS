import { NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";

async function getApiToken() {
  const { token } = await auth0.getAccessToken();
  if (!token) throw new Error("Access token unavailable");
  return token;
}

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

export async function GET() {
  try {
    const token = await getApiToken();
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
    if (!apiBaseUrl) {
      return NextResponse.json({ error: "NEXT_PUBLIC_API_BASE_URL is not configured" }, { status: 500 });
    }
    const response = await fetch(apiBaseUrl + "/freights", {
      headers: { authorization: "Bearer " + token },
      cache: "no-store",
    });
    return jsonResponse(response);
  } catch {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const token = await getApiToken();
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
    if (!apiBaseUrl) {
      return NextResponse.json({ error: "NEXT_PUBLIC_API_BASE_URL is not configured" }, { status: 500 });
    }
    const response = await fetch(apiBaseUrl + "/freights", {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: await request.text(),
      cache: "no-store",
    });
    return jsonResponse(response);
  } catch {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
}
