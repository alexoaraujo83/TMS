import { NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";

function classifyAccessTokenError(error: unknown): Record<string, string> {
  if (!(error instanceof Error)) {
    return { errorType: "UNKNOWN_ERROR" };
  }

  const result: Record<string, string> = {
    errorType: error.name,
  };

  const errorCode = "code" in error && typeof error.code === "string" ? error.code : undefined;
  if (errorCode) result.errorCode = errorCode;

  const cause = "cause" in error && error.cause instanceof Error ? error.cause : undefined;
  if (cause) {
    result.causeType = cause.name;
    const causeCode =
      "code" in cause && typeof cause.code === "string" ? cause.code : undefined;
    if (causeCode) result.causeCode = causeCode;
    const causeError =
      "error" in cause && typeof cause.error === "string" ? cause.error : undefined;
    if (causeError) result.causeError = causeError;
  }

  return result;
}

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
    const response = await fetcher.fetchWithAuth("/freights/runtime-auth-claims", {
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
        error: "Access token unavailable",
        ...classifyAccessTokenError(error),
      },
      { status: 503 },
    );
  }
}
