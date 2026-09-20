"use client";

import { useEffect, useState } from "react";
import { fetchApiHealth, type ApiHealth } from "../lib/api";

interface SessionState {
  authenticated: boolean;
  user?: {
    name?: string;
    email?: string;
  } | null;
}

export default function HomePage() {
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [freightsStatus, setFreightsStatus] = useState<number | null>(null);
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

  async function loadSession() {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    if (!response.ok) {
      setSession({ authenticated: false });
      return;
    }
    setSession((await response.json()) as SessionState);
  }

  async function checkProtectedApi() {
    setFreightsStatus(null);
    const response = await fetch("/api/tms/freights", { cache: "no-store" });
    setFreightsStatus(response.status);
  }

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([loadHealth(controller.signal), loadSession()]);
    return () => controller.abort();
  }, []);

  const authFailed =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("auth") === "failed";

  return (
    <main>
      <h1>TMS</h1>
      <p>Frontend foundation with Auth0 session and live API integration.</p>

      {authFailed && (
        <p role="alert">Authentication failed. Check the Auth0 callback configuration.</p>
      )}

      <section aria-labelledby="auth-heading">
        <h2 id="auth-heading">Authentication</h2>
        {!session && <p role="status">Checking session…</p>}
        {session?.authenticated ? (
          <>
            <p role="status">
              Signed in as {session.user?.name ?? session.user?.email ?? "authenticated user"}.
            </p>
            <button type="button" onClick={() => void checkProtectedApi()}>
              Check protected API
            </button>
            <a href="/auth/logout">Log out</a>
            {freightsStatus !== null && (
              <p role="status">GET /freights via server session: HTTP {freightsStatus}</p>
            )}
          </>
        ) : (
          <a href="/auth/login">Log in with Auth0</a>
        )}
      </section>

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
