import { strict as assert } from "node:assert";
import { test } from "node:test";
import { consumeOpenResponsesStream } from "./ai-gateway-stream";

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

test("collects text deltas when SSE frames cross chunk boundaries", async () => {
  const output: string[] = [];
  const stream = streamFromChunks([
    'event: response.output_text.delta\ndata: {"type":"response.output_text.del',
    'ta","delta":"Olá"}\n\nevent: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":" mundo"}\n\ndata: [DONE]\n\n',
  ]);

  await consumeOpenResponsesStream(stream, (delta) => output.push(delta));

  assert.equal(output.join(""), "Olá mundo");
});

test("fails safely when the gateway reports a generation error", async () => {
  const stream = streamFromChunks([
    'event: response.failed\ndata: {"type":"response.failed","response":{}}\n\n',
  ]);

  await assert.rejects(
    () => consumeOpenResponsesStream(stream, () => undefined),
    /AI Gateway reported a generation error/,
  );
});
