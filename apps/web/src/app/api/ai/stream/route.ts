import { NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";
import { consumeGeminiStream } from "../../../../lib/gemini-stream";

const MODEL = "gemini-3.7-flash";
const MAX_PROMPT_LENGTH = 8_000;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse`;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const appBaseUrl = process.env.APP_BASE_URL?.trim();
  const expectedOrigin = appBaseUrl ? new URL(appBaseUrl).origin : undefined;
  const origin = request.headers.get("origin");
  if (origin && expectedOrigin && origin !== expectedOrigin) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
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

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Gemini free-tier API is not configured. Add GEMINI_API_KEY from Google AI Studio to this environment.",
      },
      { status: 503 },
    );
  }

  let modelResponse: Response;
  try {
    modelResponse = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "content-type": "application/json",
        accept: "text/event-stream",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: "Responda em português brasileiro, a menos que o usuário peça outro idioma. Seja claro, objetivo e não invente fatos.",
            },
          ],
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1_200 },
      }),
      cache: "no-store",
      signal: request.signal,
    });
  } catch {
    return NextResponse.json(
      { error: "Gemini API is temporarily unavailable" },
      { status: 502 },
    );
  }

  if (!modelResponse.ok || !modelResponse.body) {
    const status =
      modelResponse.status === 429
        ? 429
        : modelResponse.status === 401 || modelResponse.status === 403
          ? 503
          : 502;
    const message =
      status === 429
        ? "A cota gratuita da Gemini API foi atingida; tente novamente após a renovação da cota."
        : status === 503
          ? "A chave Gemini API é inválida ou não tem acesso ao modelo gratuito selecionado."
          : "Gemini API could not start text generation";

    return NextResponse.json(
      { error: message },
      {
        status,
        headers:
          status === 429 && modelResponse.headers.has("retry-after")
            ? { "retry-after": modelResponse.headers.get("retry-after")! }
            : undefined,
      },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        await consumeGeminiStream(modelResponse.body!, (delta) => {
          send({ type: "response.output_text.delta", delta });
        });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch {
        try {
          send({ type: "error", message: "Gemini API failed while streaming." });
        } catch {
          // The client may have disconnected while the upstream stream was active.
        }
      } finally {
        try {
          controller.close();
        } catch {
          // The stream may already be canceled by the client.
        }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      "x-content-type-options": "nosniff",
    },
  });
}
