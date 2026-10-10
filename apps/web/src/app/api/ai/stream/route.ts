import { NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";

const MODEL = "openai/gpt-6-astra";
const MAX_PROMPT_LENGTH = 8_000;
const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const appBaseUrl = process.env.APP_BASE_URL?.trim().replace(/\\/+$/, "");
  const origin = request.headers.get("origin");
  if (origin && appBaseUrl && origin !== appBaseUrl) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI Gateway is not configured on this environment" },
      { status: 503 },
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | { prompt?: unknown }
    | null;
  if (!payload || typeof payload.prompt !== "string" || !payload.prompt.trim()) {
    return NextResponse.json({ error: "A non-empty prompt is required" }, { status: 400 });
  }

  const prompt = payload.prompt.trim();
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { error: `Prompt must be ${MAX_PROMPT_LENGTH} characters or fewer` },
      { status: 413 },
    );
  }

  let gatewayResponse: Response;
  try {
    gatewayResponse = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        accept: "text/event-stream",
      },
      body: JSON.stringify({
        model: MODEL,
        instructions:
          "Responda em português brasileiro, a menos que o usuário peça outro idioma. Seja claro, objetivo e não invente fatos.",
        input: [{ type: "message", role: "user", content: prompt }],
        max_output_tokens: 1_200,
        stream: true,
        store: false,
      }),
      cache: "no-store",
      signal: request.signal,
    });
  } catch {
    return NextResponse.json({ error: "AI Gateway is temporarily unavailable" }, { status: 502 });
  }

  if (!gatewayResponse.ok || !gatewayResponse.body) {
    const status =
      gatewayResponse.status === 429
        ? 429
        : gatewayResponse.status === 402 || gatewayResponse.status === 403
          ? 503
          : 502;
    const message =
      status === 429
        ? "AI Gateway rate limit reached; try again shortly"
        : status === 503
          ? "AI Gateway billing or access needs attention"
          : "AI Gateway could not start text generation";

    return NextResponse.json(
      { error: message },
      {
        status,
        headers:
          status === 429 && gatewayResponse.headers.has("retry-after")
            ? { "retry-after": gatewayResponse.headers.get("retry-after")! }
            : undefined,
      },
    );
  }

  return new Response(gatewayResponse.body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      "x-content-type-options": "nosniff",
    },
  });
}
