"use client";

import { useEffect, useState } from "react";
import { fetchApiHealth, type ApiHealth } from "../lib/api";

export default function HomePage() {
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadHealth(signal?: AbortSignal) {
    setLoading(true);
    setError(null);

    try {
      setHealth(await fetchApiHealth(signal));
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setHealth(null);
      setError(cause instanceof Error ? cause.message : "API request failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadHealth(controller.signal);
    return () => controller.abort();
  }, []);

  return (
    <main>
      <h1>TMS</h1>
      <p>Frontend foundation with live API integration.</p>

      <section aria-labelledby="api-status-heading">
        <h2 id="api-status-heading">API status</h2>
        {loading && <p role="status">Checking API…</p>}
        {!loading && health && (
          <p role="status">
            {health.service}: {health.status}
          </p>
        )}
        {!loading && error && <p role="alert">{error}</p>}
        <button type="button" onClick={() => void loadHealth()} disabled={loading}>
          Refresh API status
        </button>
      </section>
    </main>
  );
}
