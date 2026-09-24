import { auth0 } from "../../../../lib/auth0";
import { NextResponse } from "next/server";

function classifyUrl(value: string | undefined, expectedProtocol?: string): Record<string, string | boolean | null> {
  if (!value) {
    return { present: false, valid: false, protocol: null, hostname: null };
  }

  try {
    const url = new URL(value);
    return {
      present: true,
      valid: expectedProtocol ? url.protocol === expectedProtocol : true,
      protocol: url.protocol,
      hostname: url.hostname,
    };
  } catch {
    return { present: true, valid: false, protocol: null, hostname: null };
  }
}

function getRuntimeConfigDiagnostics() {
  const appBaseUrl = classifyUrl(process.env.APP_BASE_URL, "https:");
  const auth0IssuerBaseUrl = classifyUrl(process.env.AUTH0_ISSUER_BASE_URL, "https:");
  const auth0Domain = process.env.AUTH0_DOMAIN;

  return {
    appBaseUrl,
    auth0IssuerBaseUrl,
    auth0Domain: {
      present: Boolean(auth0Domain),
      hasScheme: Boolean(auth0Domain?.includes("://")),
      validHost: Boolean(
        auth0Domain &&
          !auth0Domain.includes("://") &&
          /^[A-Za-z0-9.-]+$/.test(auth0Domain),
      ),
    },
  };
}

function classifyAccessTokenError(error: unknown): Record<string, string> {
  if (!(error instanceof Error)) {
    return { errorType: "UNKNOWN_ERROR" };
  }

  const result: Record<string, string> = { errorType: error.name };

  const errorCode = "code" in error && typeof error.code === "string" ? error.code : undefined;
  if (errorCode) result.errorCode = errorCode;

  const cause = "cause" in error && error.cause instanceof Error ? error.cause : undefined;
  if (cause) {
    result.causeType = cause.name;
    const causeCode = "code" in cause && typeof cause.code === "string" ? cause.code : undefined;
    if (causeCode) result.causeCode = causeCode;
    const causeError = "error" in cause && typeof cause.error === "string" ? cause.error : undefined;
    if (causeError) result.causeError = causeError;
  }

  return result;
}

export async function GET() {
  let sessionTokenPresent = false;
  let sessionTokenExpiresAt: number | undefined;
  let sessionTokenAudience: string | undefined;

  try {
    const session = await auth0.getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Authentication required", session: "MISSING_SESSION" },
        { status: 401 },
      );
    }

    sessionTokenPresent = Boolean(session.tokenSet?.accessToken);
    sessionTokenExpiresAt = session.tokenSet?.expiresAt;
    sessionTokenAudience = session.tokenSet?.audience;

    const accessToken = await auth0.getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        {
          error: "Access token unavailable",
          code: "NO_ACCESS_TOKEN",
          sessionTokenPresent,
          sessionTokenExpiresAt,
          sessionTokenAudience,
        },
        { status: 401 },
      );
    }

    const response = await fetch(
      `${process.env.TMS_API_BASE_URL}/freights/runtime-auth-claims`,
      {
        headers: { Authorization: `Bearer ${accessToken.token}` },
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
        ...classifyAccessTokenError(error),
        runtimeConfig: getRuntimeConfigDiagnostics(),
        sessionTokenPresent,
        sessionTokenExpiresAt,
        sessionTokenAudience,
      },
      { status: 503 },
    );
  }
}
