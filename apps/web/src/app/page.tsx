"use client";

import { useEffect, useState } from "react";
import { fetchApiHealth, type ApiHealth } from "../lib/api";
import { logFrontendEvent } from "../lib/logger";

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
    const startedAt = performance.now();
    setLoading(true);
    setError(null);

    try {
      setHealth(await fetchApiHealth(signal));
      logFrontendEvent({
        event: "web.api.health.completed",
        level: "info",
        durationMs: Math.round(performance.now() - startedAt),
      });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;

      const message = cause instanceof Error ? cause.message : "API request failed";
      setHealth(null);
      setError(message);
      logFrontendEvent({
        event: "web.api.health.failed",
        level: "error",
        durationMs: Math.round(performance.now() - startedAt),
        context: { message },
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadSession() {
    try {
      const response = await fetch("/auth/profile", { cache: "no-store" });
      if (!response.ok) {
        setSession({ authenticated: false });
        logFrontendEvent({
          event: "web.auth.profile.failed",
          level: "warn",
          context: { statusCode: response.status },
        });
        return;
      }
      setSession({
        authenticated: true,
        user: (await response.json()) as SessionState["user"],
      });
      logFrontendEvent({
        event: "web.auth.profile.completed",
        level: "info",
        context: { statusCode: response.status },
      });
    } catch (cause) {
      setSession({ authenticated: false });
      logFrontendEvent({
        event: "web.auth.profile.exception",
        level: "error",
        context: {
          message: cause instanceof Error ? cause.message : "Session request failed",
        },
      });
    }
  }

  async function checkProtectedApi() {
    const startedAt = performance.now();
    setFreightsStatus(null);

    try {
      const response = await fetch("/api/tms/freights", { cache: "no-store" });
      setFreightsStatus(response.status);
      logFrontendEvent({
        event: "web.api.freights.completed",
        level: response.ok ? "info" : "warn",
        durationMs: Math.round(performance.now() - startedAt),
        context: { statusCode: response.status },
      });
    } catch (cause) {
      setFreightsStatus(null);
      logFrontendEvent({
        event: "web.api.freights.exception",
        level: "error",
        durationMs: Math.round(performance.now() - startedAt),
        context: {
          message: cause instanceof Error ? cause.message : "Protected API request failed",
        },
      });
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([loadHealth(controller.signal), loadSession()]);
    return () => controller.abort();
  }, []);

  const authFailed =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("auth") === "failed";

  useEffect(() => {
    if (authFailed) {
      logFrontendEvent({
        event: "web.auth.callback.failed",
        level: "warn",
      });
    }
  }, [authFailed]);

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
          <>
            <a href="/auth/login">Log in with Auth0</a>
            <br />
            <a href="/auth/login?screen_hint=signup">Sign up</a>
          </>
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
