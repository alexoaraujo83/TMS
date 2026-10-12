import { strict as assert } from "node:assert";
import { test } from "node:test";
import { consumeGeminiStream } from "./gemini-stream.ts";

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

test("collects Gemini text deltas when SSE frames cross chunk boundaries", async () => {
  const output: string[] = [];
  const stream = streamFromChunks([
    'data: {"candidates":[{"content":{"parts":[{"text":"Ol',
    'á"}],"role":"model"}}]}\n\ndata: {"candidates":[{"content":{"parts":[{"text":" mundo"}],"role":"model"}}]}\n\ndata: [DONE]\n\n',
  ]);

  await consumeGeminiStream(stream, (delta) => output.push(delta));

  assert.equal(output.join(""), "Olá mundo");
});

test("fails safely when Gemini returns an error event", async () => {
  const stream = streamFromChunks([
    'data: {"error":{"code":403,"message":"private upstream details"}}\n\n',
  ]);

  await assert.rejects(
    () => consumeGeminiStream(stream, () => undefined),
    /Gemini API reported a generation error/,
  );
});
