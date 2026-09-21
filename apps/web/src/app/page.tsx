"use client";

import { useEffect, useState } from "react";
import { fetchApiHealth, type ApiHealth } from "../lib/api";
import { logFrontendEvent } from "../lib/logger";

interface SessionState {
  authenticated: boolean;
  user?: { name?: string; email?: string } | null;
}

interface FreightResult {
  id?: string;
  eventId?: string;
  event_id?: unknown;
  freightId?: string;
  message?: unknown;
  error?: unknown;
  [key: string]: unknown;
}

export default function HomePage() {
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [freightsStatus, setFreightsStatus] = useState<number | null>(null);
  const [freight, setFreight] = useState<FreightResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function loadHealth(signal?: AbortSignal) {
    const startedAt = performance.now();
    setLoading(true);
    setError(null);

    try {
      const result = await fetchApiHealth(signal);
      setHealth(result);
      logFrontendEvent("INFO", "web.api.health.completed", {
        requestId: result.requestId,
        correlationId: result.correlationId ?? result.requestId,
      }, {
        duration_ms: Math.round(performance.now() - startedAt),
        status: result.status,
        service: result.service,
      });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      const message = cause instanceof Error ? cause.message : "API request failed";
      setHealth(null);
      setError(message);
      logFrontendEvent("ERROR", "web.api.health.failed", {}, {
        duration_ms: Math.round(performance.now() - startedAt),
        message,
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadSession() {
    try {
      const response = await fetch("/auth/profile", { cache: "no-store" });
      const requestId = response.headers.get("x-request-id") ?? undefined;
      const correlationId = response.headers.get("x-correlation-id") ?? requestId;

      if (!response.ok) {
        setSession({ authenticated: false });
        logFrontendEvent("WARN", "web.auth.profile.failed", { requestId, correlationId }, {
          status_code: response.status,
        });
        return;
      }

      setSession({
        authenticated: true,
        user: (await response.json()) as SessionState["user"],
      });
      logFrontendEvent("INFO", "web.auth.profile.completed", { requestId, correlationId }, {
        status_code: response.status,
      });
    } catch (cause) {
      setSession({ authenticated: false });
      logFrontendEvent("ERROR", "web.auth.profile.exception", {}, {
        message: cause instanceof Error ? cause.message : "Session request failed",
      });
    }
  }

  async function checkProtectedApi() {
    const response = await fetch("/api/tms/freights", { cache: "no-store" });
    setFreightsStatus(response.status);
  }

  async function createRuntimeFreight() {
    setCreating(true);
    setError(null);
    setFreight(null);

    try {
      const createResponse = await fetch("/api/tms/freights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          freightType: "dedicated",
          originCity: "Santos",
          originState: "SP",
          destinationCity: "São Paulo",
          destinationState: "SP",
          cargoDescription: "E4 Runtime Smoke",
          quantity: 1,
          weightKg: 100,
        }),
        cache: "no-store",
      });

      const createBody = (await createResponse.json()) as FreightResult;
      if (!createResponse.ok) {
        throw new Error(
          String(createBody.message ?? createBody.error ?? "Freight creation failed"),
        );
      }

      const freightId = String(createBody.id ?? createBody.freightId ?? "");
      if (!freightId) throw new Error("Freight created but no freight id was returned");

      const statusResponse = await fetch(
        "/api/tms/freights/" + encodeURIComponent(freightId) + "/status",
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "open" }),
          cache: "no-store",
        },
      );

      const statusBody = (await statusResponse.json()) as FreightResult;
      if (!statusResponse.ok) {
        throw new Error(
          String(statusBody.message ?? statusBody.error ?? "Freight status update failed"),
        );
      }

      setFreight({
        ...statusBody,
        id: freightId,
        eventId:\n          statusBody.eventId ??\n          (typeof statusBody.event_id === "string" ? statusBody.event_id : undefined),
      });
      logFrontendEvent("INFO", "web.freight.runtime_smoke.completed", {}, {
        freight_id: freightId,
        status: "open",
        http_status: statusResponse.status,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Runtime smoke failed";
      setError(message);
      logFrontendEvent("ERROR", "web.freight.runtime_smoke.failed", {}, { message });
    } finally {
      setCreating(false);
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
    if (authFailed) logFrontendEvent("WARN", "web.auth.callback.failed");
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

      {session?.authenticated && (
        <section aria-labelledby="freight-heading">
          <h2 id="freight-heading">Freight Runtime Smoke</h2>
          <p>
            Creates one tenant-scoped Freight through the Auth0-backed Web BFF and immediately
            transitions it to <code>open</code>.
          </p>
          <button type="button" onClick={() => void createRuntimeFreight()} disabled={creating}>
            {creating ? "Creating Freight…" : "Create Freight and set OPEN"}
          </button>
          {freight?.id && <p role="status">freight_id: {freight.id}</p>}
          {freight?.eventId && <p role="status">event_id: {freight.eventId}</p>}
          {error && <p role="alert">{error}</p>}
        </section>
      )}

      <section aria-labelledby="api-status-heading">
        <h2 id="api-status-heading">API status</h2>
        {loading && <p role="status">Checking API…</p>}
        {!loading && health && <p role="status">{health.service}: {health.status}</p>}
        {!loading && error && <p role="alert">{error}</p>}
        <button type="button" onClick={() => void loadHealth()} disabled={loading}>
          Refresh API status
        </button>
      </section>
    </main>
  );
}
