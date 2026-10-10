export async function consumeAssistantTextStream(
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
      throw new Error("O assistente retornou um evento de streaming inválido.");
    }

    if (!event || typeof event !== "object" || !("type" in event)) return;

    const typedEvent = event as { type?: unknown; delta?: unknown };
    if (typedEvent.type === "response.output_text.delta") {
      if (typeof typedEvent.delta === "string") onDelta(typedEvent.delta);
      return;
    }

    if (typedEvent.type === "error" || typedEvent.type === "response.failed") {
      throw new Error("O assistente encontrou um erro durante a geração.");
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
