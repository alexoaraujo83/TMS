"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Check = { passed: boolean; detail: string };
type Evidence = {
  generatedAt: string;
  authenticated: boolean;
  tenantId: string;
  probeFreightId?: string | null;
  syntheticTenantB?: string;
  session: { currentUser: string | null; rolbypassrls: boolean | null; rolsuper: boolean | null };
  checks: Record<string, Check>;
  overall: boolean;
  safety?: { persistentWrite: boolean; note: string };
  error?: string;
};

const labels: Record<string, string> = {
  sessionIdentity: "Sessão runtime",
  ownTenantSelect: "SELECT do próprio tenant",
  crossTenantSelect: "SELECT cross-tenant",
  crossTenantInsert: "INSERT cross-tenant",
  crossTenantUpdate: "UPDATE / reatribuição A → B",
  rollbackGuard: "Savepoint + rollback",
};

const descriptions: Record<string, string> = {
  sessionIdentity: "Confirma tms_app, NOBYPASSRLS e não-superuser.",
  ownTenantSelect: "Confirma que a sessão enxerga um frete do tenant ativo.",
  crossTenantSelect: "Troca o contexto para um tenant sintético e verifica que o frete fica invisível.",
  crossTenantInsert: "Tenta escrever um frete com tenant diferente e exige SQLSTATE 42501.",
  crossTenantUpdate: "Tenta reatribuir o frete do tenant ativo para outro tenant e exige SQLSTATE 42501.",
  rollbackGuard: "Cada tentativa de mutação fica atrás de savepoint e é revertida antes do commit.",
};

export default function EvidencePage() {
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setRunning(true);
    setError("");
    try {
      const response = await fetch("/api/tms/db-04-evidence", { cache: "no-store" });
      const body = (await response.json()) as Evidence;
      if (!response.ok) throw new Error(body.error || "Não foi possível gerar a evidência.");
      setEvidence(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao executar a coleta.");
      setEvidence(null);
    } finally {
      setRunning(false);
    }
  }

  const passed = useMemo(
    () => evidence ? Object.values(evidence.checks).filter((check) => check.passed).length : 0,
    [evidence],
  );

  function download() {
    if (!evidence) return;
    const blob = new Blob([JSON.stringify(evidence, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tms-db-04-evidence-${new Date(evidence.generatedAt).toISOString().replace(/[:.]/g, "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    if (!evidence) return;
    const lines = [
      "TMS — DB-04 / E4 runtime evidence",
      `generatedAt=${evidence.generatedAt}`,
      `current_user=${evidence.session.currentUser}`,
      `rolbypassrls=${String(evidence.session.rolbypassrls)}`,
      `rolsuper=${String(evidence.session.rolsuper)}`,
      ...Object.entries(evidence.checks).map(([key, check]) => `${labels[key] ?? key}: ${check.passed ? "PASS" : "FAIL"} — ${check.detail}`),
      `overall=${evidence.overall ? "PASS" : "FAIL"}`,
      "No credentials, tokens or connection strings are included.",
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
  }

  return (
    <main className="evidence-page">
      <div className="evidence-head">
        <div>
          <Link href="/app" className="back-link">← Voltar ao dashboard</Link>
          <span className="eyebrow">GOVERNANÇA · E4</span>
          <h1>Gerador de evidências DB-04</h1>
          <p>Executa uma prova controlada usando a sessão autenticada do runtime, sem expor credenciais e sem aceitar mutações persistentes.</p>
        </div>
        <div className="evidence-actions">
          <button className="button button-primary" onClick={generate} disabled={running}>
            {running ? "Executando…" : "Gerar evidência"}
          </button>
          {evidence && <button className="button button-ghost" onClick={download}>Baixar JSON</button>}
          {evidence && <button className="button button-ghost" onClick={copy}>Copiar resumo</button>}
        </div>
      </div>

      <section className="evidence-banner">
        <div><strong>Execução segura</strong><span>As tentativas de INSERT/UPDATE cross-tenant são isoladas em savepoints e revertidas antes do commit.</span></div>
        <span className="evidence-badge">SEM CREDENCIAIS</span>
      </section>

      {error && <div className="ops-alert">{error}</div>}

      {!evidence && !error && (
        <section className="evidence-empty">
          <span>◈</span>
          <strong>Nenhuma coleta executada</strong>
          <p>Faça login com uma sessão autorizada para diagnósticos e execute a coleta. O resultado será composto apenas por metadados e resultados de segurança.</p>
        </section>
      )}

      {evidence && (
        <>
          <section className="evidence-summary">
            <article><span>Resultado</span><strong className={evidence.overall ? "pass" : "fail"}>{evidence.overall ? "PASS" : "PENDENTE"}</strong><small>{passed}/{Object.keys(evidence.checks).length} checks aprovados</small></article>
            <article><span>Runtime role</span><strong>{evidence.session.currentUser ?? "—"}</strong><small>rolbypassrls={String(evidence.session.rolbypassrls)}</small></article>
            <article><span>Probe freight</span><strong>{evidence.probeFreightId ? evidence.probeFreightId.slice(0, 8).toUpperCase() : "—"}</strong><small>fixture somente para leitura</small></article>
            <article><span>Persistência</span><strong className="pass">NÃO</strong><small>mutations rolled back</small></article>
          </section>

          <section className="evidence-grid">
            {Object.entries(evidence.checks).map(([key, check]) => (
              <article className={`evidence-check ${check.passed ? "is-pass" : "is-fail"}`} key={key}>
                <div className="evidence-check-top"><span className="check-icon">{check.passed ? "✓" : "!"}</span><strong>{labels[key] ?? key}</strong><span>{check.passed ? "PASS" : "FAIL"}</span></div>
                <p>{descriptions[key]}</p>
                <small>{check.detail}</small>
              </article>
            ))}
          </section>

          <section className="evidence-meta">
            <div><span>Gerado em</span><strong>{new Date(evidence.generatedAt).toLocaleString("pt-BR")}</strong></div>
            <div><span>Tenant da sessão</span><strong>{evidence.tenantId}</strong></div>
            <div><span>Tenant sintético</span><strong>{evidence.syntheticTenantB ?? "—"}</strong></div>
            <div><span>Contrato de segurança</span><strong>tms_app · NOBYPASSRLS</strong></div>
          </section>

          <details className="evidence-details">
            <summary>Ver JSON completo da evidência</summary>
            <pre>{JSON.stringify(evidence, null, 2)}</pre>
          </details>
        </>
      )}
    </main>
  );
}
