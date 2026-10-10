export async function consumeGeminiStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (delta: string) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const consumeFrame = (frame: string) => {
    const data = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");

    if (!data || data === "[DONE]") return;

    let event: unknown;
    try {
      event = JSON.parse(data);
    } catch {
      throw new Error("Gemini API returned an invalid streaming event.");
    }

    if (!event || typeof event !== "object") return;

    const typedEvent = event as {
      error?: unknown;
      candidates?: Array<{
        content?: { parts?: Array<{ text?: unknown }> };
      }>;
    };

    if (typedEvent.error) {
      throw new Error("Gemini API reported a generation error.");
    }

    for (const candidate of typedEvent.candidates ?? []) {
      for (const part of candidate.content?.parts ?? []) {
        if (typeof part.text === "string" && part.text.length > 0) {
          onDelta(part.text);
        }
      }
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });

      while (true) {
        const separator = /\r?\n\r?\n/.exec(buffer);
        if (!separator || separator.index === undefined) break;

        const frame = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);
        consumeFrame(frame);
      }

      if (done) break;
    }

    if (buffer.trim()) consumeFrame(buffer);
  } finally {
    reader.releaseLock();
  }
}
