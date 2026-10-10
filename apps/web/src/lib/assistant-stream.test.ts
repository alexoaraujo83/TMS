import { strict as assert } from "node:assert";
import { test } from "node:test";
import { consumeAssistantTextStream } from "./assistant-stream.ts";

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

test("collects assistant text deltas when SSE frames cross chunk boundaries", async () => {
  const output: string[] = [];
  const stream = streamFromChunks([
    'data: {"type":"response.output_text.del',
    'ta","delta":"Olá"}\n\ndata: {"type":"response.output_text.delta","delta":" mundo"}\n\ndata: [DONE]\n\n',
  ]);

  await consumeAssistantTextStream(stream, (delta) => output.push(delta));

  assert.equal(output.join(""), "Olá mundo");
});

test("fails safely when the server reports a generation error", async () => {
  const stream = streamFromChunks([
    'data: {"type":"error","message":"private upstream details"}\n\n',
  ]);

  await assert.rejects(
    () => consumeAssistantTextStream(stream, () => undefined),
    /assistente encontrou um erro/,
  );
});
