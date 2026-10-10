import { NextResponse } from "next/server";
import { auth0 } from "../../../../../lib/auth0";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CheckStatus = "healthy" | "degraded" | "blocked" | "unknown";

type Check = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  checkedAt: string;
  latencyMs?: number;
};

async function probeApi(path: string, label: string): Promise<Check> {
  const checkedAt = new Date().toISOString();
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!baseUrl) {
    return { id: label, label, status: "blocked", detail: "NEXT_PUBLIC_API_BASE_URL não configurada", checkedAt };
  }

  const started = Date.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(4500),
      headers: { accept: "application/json" },
    });
    const latencyMs = Date.now() - started;
    return {
      id: label,
      label,
      status: response.ok ? "healthy" : "degraded",
      detail: response.ok ? `HTTP ${response.status}` : `Endpoint respondeu HTTP ${response.status}`,
      checkedAt,
      latencyMs,
    };
  } catch (error) {
    return {
      id: label,
      label,
      status: "degraded",
      detail: error instanceof Error && error.name === "TimeoutError" ? "Timeout após 4,5 s" : "Endpoint indisponível ou inacessível",
      checkedAt,
      latencyMs: Date.now() - started,
    };
  }
}

export async function GET(request: Request) {
  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!apiBaseUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_API_BASE_URL is not configured" }, { status: 503 });
  }

  // Reuse the canonical TMS API authorization model. The existing runtime
  // diagnostics endpoint requires ops:diagnostics, granted to tenant admins
  // by migration 0035; a valid Auth0 session alone is not sufficient.
  try {
    const fetcher = await auth0.createFetcher(request, { baseUrl: apiBaseUrl });
    const authorization = await fetcher.fetchWithAuth("/freights/runtime-context", {
      method: "GET",
      cache: "no-store",
    });
    if (authorization.status === 401) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (authorization.status === 403) {
      return NextResponse.json({ error: "Insufficient permission" }, { status: 403 });
    }
    if (!authorization.ok) {
      return NextResponse.json({ error: "Unable to verify operational diagnostics permission" }, { status: 503 });
    }
    await authorization.body?.cancel();
  } catch {
    return NextResponse.json({ error: "Unable to verify operational diagnostics permission" }, { status: 503 });
  }

  const checkedAt = new Date().toISOString();
  const [apiHealth, apiReadiness] = await Promise.all([
    probeApi("/health", "API liveness"),
    probeApi("/ready", "API readiness / dependências"),
  ]);

  // These systems are deliberately unknown until backed by an authenticated,
  // server-side integration that can provide runtime evidence.
  const checks: Check[] = [
    {
      id: "web-session",
      label: "Sessão Web",
      status: "healthy",
      detail: "Sessão Auth0 válida para acessar o painel",
      checkedAt,
    },
    apiHealth,
    apiReadiness,
    {
      id: "auth0-flow",
      label: "Fluxo OIDC / claims",
      status: "unknown",
      detail: "Requer validação de login real, access token, audience e tenant claim",
      checkedAt,
    },
    {
      id: "worker",
      label: "Railway Worker / durable jobs",
      status: "unknown",
      detail: "Sem fonte de telemetria autenticada integrada a este endpoint",
      checkedAt,
    },
    {
      id: "backups",
      label: "Backups / restore",
      status: "unknown",
      detail: "Requer evidência recente de backup e teste de restauração",
      checkedAt,
    },
  ];

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      checks,
      note: "Healthy confirma apenas o probe executado; unknown não significa saudável nem indisponível.",
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
