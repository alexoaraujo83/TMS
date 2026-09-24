import { auth0 } from "../../../../lib/auth0";
import { NextResponse } from "next/server";

function classifyAccessTokenError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AccessTokenError") return "ACCESS_TOKEN_ERROR";
    if (error.name === "ConfigurationError") return "CONFIGURATION_ERROR";
    if (error.name === "MissingSessionError") return "MISSING_SESSION";
    if (error.name === "InvalidSessionError") return "INVALID_SESSION";
    return "SDK_ERROR";
  }
  return "UNKNOWN_ERROR";
}

export async function GET() {
  try {
    const accessToken = await auth0.getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { error: "Access token unavailable", code: "NO_ACCESS_TOKEN" },
        { status: 401 },
      );
    }

    const response = await fetch(
      `${process.env.TMS_API_BASE_URL}/freights/runtime-auth-claims`,
      {
        headers: {
          Authorization: `Bearer ${accessToken.token}`,
        },
        cache: "no-store",
      },
    );

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
        error: "Access token unavailable",
        code: classifyAccessTokenError(error),
      },
      { status: 503 },
    );
  }
}
