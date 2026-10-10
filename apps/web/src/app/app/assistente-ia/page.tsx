"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { consumeAssistantTextStream } from "../../../lib/assistant-stream";
import styles from "./assistant.module.css";

type GenerationStatus = "idle" | "streaming" | "complete" | "error";

export default function AssistenteIAPage() {
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [error, setError] = useState("");
  const abortController = useRef<AbortController | null>(null);
  const busy = status === "streaming";

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || busy) return;

    const controller = new AbortController();
    abortController.current = controller;
    setOutput("");
    setError("");
    setStatus("streaming");

    try {
      const response = await fetch("/api/ai/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: trimmedPrompt }),
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: unknown }
          | null;
        const message =
          body && typeof body.error === "string"
            ? body.error
            : "Não foi possível iniciar a geração de texto.";
        throw new Error(message);
      }

      if (!response.body) {
        throw new Error("A resposta de streaming não está disponível.");
      }

      await consumeAssistantTextStream(response.body, (delta) => {
        setOutput((previous) => previous + delta);
      });
      setStatus("complete");
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") {
        setStatus("idle");
      } else {
        setError(
          cause instanceof Error
            ? cause.message
            : "Ocorreu um erro ao gerar o texto.",
        );
        setStatus("error");
      }
    } finally {
      if (abortController.current === controller) abortController.current = null;
    }
  }

  function stopGeneration() {
    abortController.current?.abort();
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Link href="/app" className={styles.backLink}>
          ← Voltar ao dashboard
        </Link>

        <header className={styles.header}>
          <span className={styles.eyebrow}>TMS · FERRAMENTAS INTELIGENTES</span>
          <h1>Assistente IA</h1>
          <p>
            Gere textos e análises com resposta progressiva. O conteúdo aparece
            à medida que o modelo produz cada trecho.
          </p>
          <span className={styles.modelTag}>Gemini API · modelo gratuito</span>
        </header>

        <form className={styles.panel} onSubmit={generate}>
          <label className={styles.label} htmlFor="assistant-prompt">
            O que você quer gerar?
          </label>
          <textarea
            id="assistant-prompt"
            className={styles.textarea}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            maxLength={8000}
            placeholder="Ex.: Resuma os principais riscos operacionais de uma transportadora e proponha ações para reduzi-los."
            rows={6}
            required
            disabled={busy}
          />
          <div className={styles.formFooter}>
            <span className={styles.counter}>{prompt.length}/8000</span>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setPrompt("");
                  setOutput("");
                  setError("");
                  setStatus("idle");
                }}
                disabled={busy || (!prompt && !output && !error)}
              >
                Limpar
              </button>
              {busy ? (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={stopGeneration}
                >
                  Parar geração
                </button>
              ) : (
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={!prompt.trim()}
                >
                  Gerar texto
                </button>
              )}
            </div>
          </div>
        </form>

        <section
          className={styles.outputPanel}
          aria-labelledby="assistant-output-heading"
          aria-live="polite"
          aria-busy={busy}
        >
          <div className={styles.outputHeader}>
            <h2 id="assistant-output-heading">Resposta</h2>
            <span className={styles.status}>
              {status === "streaming"
                ? "Gerando…"
                : status === "complete"
                  ? "Concluído"
                  : status === "error"
                    ? "Falha"
                    : "Pronto"}
            </span>
          </div>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : output ? (
            <div className={styles.outputText}>{output}</div>
          ) : (
            <p className={styles.placeholder}>
              {busy
                ? "Aguardando os primeiros trechos de texto…"
                : "Sua resposta aparecerá aqui. A geração é transmitida em tempo real."}
            </p>
          )}
        </section>
        <p className={styles.securityNote}>
          Sua solicitação é enviada ao servidor do TMS. A chave de acesso fica
          no ambiente do servidor e não é enviada ao navegador.
        </p>
      </div>
    </main>
  );
}
