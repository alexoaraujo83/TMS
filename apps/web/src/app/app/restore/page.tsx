"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Backup = {
  object: string;
  runId: number;
  runUrl: string;
  createdAt: string;
  bytes: number | null;
  sha256: string | null;
  postgresVersion: string | null;
  migrationTable: string | null;
  migrationCount: string | null;
  durationSeconds: number | null;
  integrity: "verified";
  origin: string;
};

type Result = {
  ok?: boolean;
  status?: string;
  runUrl?: string;
  message?: string;
  error?: string;
};

type RestoreStep = { name: string; status: string; conclusion: string | null };
type RestoreHistory = { runId: number; runUrl: string; createdAt: string; updatedAt: string; status: "queued" | "running" | "verified" | "failed" };
type RestoreStatus = {
  status?: "pending" | "queued" | "running" | "verified" | "failed";
  runId?: number;
  runUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  conclusion?: string | null;
  message?: string;
  error?: string;
  steps?: RestoreStep[];
  history?: RestoreHistory[];
};

function formatBytes(bytes: number | null) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function ageLabel(createdAt: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(createdAt)) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

function shortHash(value: string | null) {
  return value ? `${value.slice(0, 12)}…` : "—";
}

function statusLabel(status?: RestoreStatus["status"]) {
  return {
    pending: "Aguardando",
    queued: "Na fila",
    running: "Em execução",
    verified: "Verificado",
    failed: "Falhou",
  }[status ?? "pending"];
}

export default function RestoreVerifyPage() {
  const [confirmation, setConfirmation] = useState("");
  const [running, setRunning] = useState<"restore" | "backup" | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [backupConfirmation, setBackupConfirmation] = useState("");
  const [backupResult, setBackupResult] = useState<Result | null>(null);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [selectedBackup, setSelectedBackup] = useState("");
  const [loadingBackups, setLoadingBackups] = useState(true);
  const [backupCatalogError, setBackupCatalogError] = useState("");
  const [filter, setFilter] = useState("");
  const [restoreStatus, setRestoreStatus] = useState<RestoreStatus | null>(null);
  const [restoreRequestedAt, setRestoreRequestedAt] = useState("");

  async function loadBackups() {
    setLoadingBackups(true);
    setBackupCatalogError("");
    try {
      const response = await fetch("/api/tms/backups", { cache: "no-store" });
      const text = await response.text();
      const body = (text ? JSON.parse(text) : {}) as { backups?: Backup[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Falha ao carregar os backups.");
      const catalog = body.backups ?? [];
      setBackups(catalog);
      setSelectedBackup((current) =>
        current && catalog.some((item) => item.object === current) ? current : (catalog[0]?.object ?? ""),
      );
    } catch (error) {
      setBackupCatalogError(error instanceof Error ? error.message : "Falha ao carregar os backups.");
    } finally {
      setLoadingBackups(false);
    }
  }

  useEffect(() => { void loadBackups(); }, []);

  const visibleBackups = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return backups;
    return backups.filter((backup) =>
      [backup.object, backup.sha256 ?? "", backup.postgresVersion ?? "", backup.createdAt]
        .join(" ").toLowerCase().includes(query),
    );
  }, [backups, filter]);

  const selected = backups.find((backup) => backup.object === selectedBackup) ?? null;

  useEffect(() => {
    if (!restoreRequestedAt) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const response = await fetch(`/api/tms/restore-status?since=${encodeURIComponent(restoreRequestedAt)}`, { cache: "no-store" });
        const text = await response.text();
        const body = (text ? JSON.parse(text) : {}) as RestoreStatus;
        if (!cancelled) {
          setRestoreStatus(response.ok ? body : { error: body.error || "Falha ao consultar o status." });
          if (body.status === "verified" || body.status === "failed") return;
        }
      } catch (error) {
        if (!cancelled) setRestoreStatus({ error: error instanceof Error ? error.message : "Falha ao consultar o status." });
      }
      if (!cancelled) timer = setTimeout(poll, 5000);
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [restoreRequestedAt]);

  async function execute() {
    if (confirmation !== "RESTORE-VERIFY" || !selectedBackup) return;
    const requestedAt = new Date().toISOString();
    setRestoreRequestedAt(requestedAt);
    setRestoreStatus({ status: "pending", message: "Solicitação enviada; aguardando workflow." });
    setRunning("restore");
    setResult(null);
    try {
      const response = await fetch("/api/tms/restore-verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation, backupObject: selectedBackup }),
      });
      const text = await response.text();
      const body = (text ? JSON.parse(text) : {}) as Result;
      setResult(response.ok ? body : { error: body.error || body.message || "Falha ao solicitar o restore." });
      if (!response.ok) setRestoreStatus({ status: "failed", error: body.error || body.message });
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : "Falha de comunicação." });
      setRestoreStatus({ status: "failed", error: error instanceof Error ? error.message : "Falha de comunicação." });
    } finally {
      setRunning(null);
    }
  }

  async function executeBackup() {
    if (backupConfirmation !== "BACKUP-NOW") return;
    setRunning("backup");
    setBackupResult(null);
    try {
      const response = await fetch("/api/tms/backup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation: backupConfirmation }),
      });
      const text = await response.text();
      const body = (text ? JSON.parse(text) : {}) as Result;
      setBackupResult(response.ok ? body : { error: body.error || body.message || "Falha ao solicitar o backup." });
      if (response.ok) window.setTimeout(() => void loadBackups(), 8000);
    } catch (error) {
      setBackupResult({ error: error instanceof Error ? error.message : "Falha de comunicação." });
    } finally {
      setRunning(null);
    }
  }

  const restoreSteps = restoreStatus?.steps ?? [];
  const restoreHistory = restoreStatus?.history ?? [];
  const lastVerifiedRestore = restoreHistory.find((item) => item.status === "verified") ?? null;

  return (
    <main className="evidence-page">
      <div className="evidence-head">
        <div>
          <Link href="/app" className="back-link">← Voltar ao dashboard</Link>
          <span className="eyebrow">GOVERNANÇA · DISASTER RECOVERY</span>
          <h1>Restore / Backup</h1>
          <p>Console operacional de continuidade: backup de produção, catálogo verificado, seleção explícita e restore drill isolado.</p>
        </div>
      </div>

      <section className="evidence-banner">
        <div>
          <strong>Barreira de segurança</strong>
          <span>O navegador nunca recebe RESTORE_DATABASE_URL, credenciais S3 ou chave de criptografia. Produção não é um alvo de restore permitido.</span>
        </div>
        <span className="evidence-badge">ISOLADO</span>
      </section>

      <section className="evidence-grid">
        <article className="evidence-check is-pass">
          <div className="evidence-check-top"><span className="check-icon">✓</span><strong>Backup mais recente</strong><span>VERIFICADO</span></div>
          <p>{backups[0] ? `${ageLabel(backups[0].createdAt)} · ${formatBytes(backups[0].bytes)}` : "Aguardando catálogo."}</p>
        </article>
        <article className="evidence-check is-pass">
          <div className="evidence-check-top"><span className="check-icon">✓</span><strong>Restore drill</strong><span>{statusLabel(restoreStatus?.status)}</span></div>
          <p>{lastVerifiedRestore ? "Última execução desta sessão concluída com evidência." : "Nenhum restore concluído nesta sessão."}</p>
        </article>
        <article className="evidence-check is-pass">
          <div className="evidence-check-top"><span className="check-icon">✓</span><strong>Alvo</strong><span>ISOLADO</span></div>
          <p>Destino protegido pelo ambiente <code>restore-verification</code>.</p>
        </article>
      </section>

      <section className="ops-card" style={{ maxWidth: 980 }}>
        <div className="card-head">
          <div><span className="eyebrow">OPERAÇÃO CONTROLADA</span><h2>Backup de produção</h2></div>
          <span className="status-pill open">Produção</span>
        </div>
        <p style={{ marginTop: 12 }}>Executa o backup protegido com PostgreSQL 17, TLS <code>verify-full</code>, checksum, manifesto e retenção.</p>
        <div style={{ display: "grid", gap: 18, marginTop: 18 }}>
          <label style={{ display: "grid", gap: 8 }}><strong>Confirmação</strong>
            <input value={backupConfirmation} onChange={(event) => setBackupConfirmation(event.target.value)} placeholder="Digite BACKUP-NOW" autoComplete="off" spellCheck={false} style={{ width: "100%", maxWidth: 420, padding: "12px 14px", border: "1px solid var(--border, #d8dde5)", borderRadius: 10, font: "inherit", background: "var(--surface, #fff)" }} />
          </label>
          <div className="evidence-actions">
            <button className="button button-primary" onClick={executeBackup} disabled={running !== null || backupConfirmation !== "BACKUP-NOW"}>
              {running === "backup" ? "Solicitando backup…" : "Executar backup agora"}
            </button>
            {backupResult?.runUrl && <a className="button button-ghost" href={backupResult.runUrl} target="_blank" rel="noreferrer">Abrir execução</a>}
          </div>
          {backupResult?.error && <div className="ops-alert">{backupResult.error}</div>}
          {backupResult?.message && !backupResult.error && <div className="evidence-banner"><div><strong>{backupResult.status ?? "Solicitado"}</strong><span>{backupResult.message}</span></div></div>}
        </div>
      </section>

      <section className="ops-card" style={{ maxWidth: 980 }}>
        <div className="card-head">
          <div><span className="eyebrow">CATÁLOGO VERIFICADO</span><h2>Backups disponíveis</h2></div>
          <button className="button button-ghost" onClick={() => void loadBackups()} disabled={loadingBackups}>{loadingBackups ? "Atualizando…" : "Atualizar lista"}</button>
        </div>
        <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
          {loadingBackups && <p>Carregando backups verificados…</p>}
          {backupCatalogError && <div className="ops-alert">{backupCatalogError}</div>}
          {!loadingBackups && !backupCatalogError && backups.length === 0 && <div className="evidence-banner"><div><strong>Nenhum backup disponível</strong><span>O catálogo considera somente execuções bem-sucedidas do workflow Backup Now.</span></div></div>}
          {!loadingBackups && !backupCatalogError && backups.length > 0 && <>
            <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filtrar por arquivo, SHA-256, PostgreSQL ou data…" aria-label="Filtrar backups" style={{ width: "100%", padding: "12px 14px", border: "1px solid var(--border, #d8dde5)", borderRadius: 10, font: "inherit", background: "var(--surface, #fff)" }} />
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={{ textAlign: "left", padding: 10 }}>Data</th><th style={{ textAlign: "left", padding: 10 }}>Backup</th><th style={{ textAlign: "left", padding: 10 }}>Integridade</th><th style={{ textAlign: "left", padding: 10 }}>Origem</th><th style={{ textAlign: "left", padding: 10 }}>Tamanho</th><th style={{ textAlign: "left", padding: 10 }}>Ação</th></tr></thead>
                <tbody>
                  {visibleBackups.map((backup) => (
                    <tr key={backup.object}>
                      <td style={{ padding: 10, verticalAlign: "top" }}>{new Date(backup.createdAt).toLocaleString("pt-BR")}<br /><small>{ageLabel(backup.createdAt)}</small></td>
                      <td style={{ padding: 10, verticalAlign: "top" }}><code>{backup.object}</code><br /><small>SHA {shortHash(backup.sha256)}</small></td>
                      <td style={{ padding: 10, verticalAlign: "top" }}><strong>✓ VERIFIED</strong><br /><small>run #{backup.runId}</small></td>
                      <td style={{ padding: 10, verticalAlign: "top" }}>{backup.origin}</td>
                      <td style={{ padding: 10, verticalAlign: "top" }}>{formatBytes(backup.bytes)}<br /><small>PG {backup.postgresVersion ?? "—"}</small></td>
                      <td style={{ padding: 10, verticalAlign: "top" }}><button className="button button-ghost" onClick={() => setSelectedBackup(backup.object)}>{selectedBackup === backup.object ? "Selecionado" : "Selecionar"}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ margin: 0 }}>{visibleBackups.length} de {backups.length} backups verificados. O catálogo é derivado de execuções bem-sucedidas do Backup Now.</p>
          </>}
        </div>
      </section>

      <section className="ops-card" style={{ maxWidth: 980 }}>
        <div className="card-head"><div><span className="eyebrow">PRÉ-VISUALIZAÇÃO</span><h2>Backup selecionado</h2></div><span className="status-pill open">{selected ? "Pronto" : "Selecione"}</span></div>
        <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
          {selected ? <>
            <p><strong>Arquivo:</strong> <code>{selected.object}</code></p>
            <p><strong>Data:</strong> {new Date(selected.createdAt).toLocaleString("pt-BR")} · <strong>idade:</strong> {ageLabel(selected.createdAt)}</p>
            <p><strong>SHA-256:</strong> <code>{selected.sha256 ?? "não disponível"}</code></p>
            <p><strong>Tamanho:</strong> {formatBytes(selected.bytes)} · <strong>PostgreSQL:</strong> {selected.postgresVersion ?? "—"} · <strong>Migrações:</strong> {selected.migrationCount ?? "—"}</p>
            <p><strong>Integridade:</strong> VERIFIED · <a href={selected.runUrl} target="_blank" rel="noreferrer">evidência do workflow #{selected.runId}</a></p>
          </> : <p>Nenhum backup selecionado.</p>}
        </div>
      </section>

      <section className="ops-card" style={{ maxWidth: 980 }}>
        <div className="card-head"><div><span className="eyebrow">EXECUÇÃO CONTROLADA</span><h2>Restore drill</h2></div><span className="status-pill open">{statusLabel(restoreStatus?.status)}</span></div>
        <div style={{ display: "grid", gap: 18, marginTop: 18 }}>
          <p>O workflow restaura exclusivamente no alvo isolado e valida download, SHA-256, descriptografia, <code>pg_restore</code>, schema e migrações.</p>
          <label style={{ display: "grid", gap: 8 }}><strong>Confirmação explícita</strong>
            <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Digite RESTORE-VERIFY" autoComplete="off" spellCheck={false} style={{ width: "100%", maxWidth: 420, padding: "12px 14px", border: "1px solid var(--border, #d8dde5)", borderRadius: 10, font: "inherit", background: "var(--surface, #fff)" }} />
          </label>
          <div className="evidence-actions">
            <button className="button button-primary" onClick={execute} disabled={running !== null || confirmation !== "RESTORE-VERIFY" || !selectedBackup}>
              {running === "restore" ? "Solicitando execução…" : "Executar restore-verify.sh"}
            </button>
            {result?.runUrl && <a className="button button-ghost" href={result.runUrl} target="_blank" rel="noreferrer">Abrir execução</a>}
          </div>
          {result?.error && <div className="ops-alert">{result.error}</div>}
          {result?.message && !result.error && <div className="evidence-banner"><div><strong>{result.status ?? "Solicitado"}</strong><span>{result.message}</span></div></div>}
          {restoreStatus?.error && <div className="ops-alert">{restoreStatus.error}</div>}
        </div>
      </section>

      {restoreRequestedAt && <section className="ops-card" style={{ maxWidth: 980 }}>
        <div className="card-head"><div><span className="eyebrow">EVIDÊNCIA EM TEMPO REAL</span><h2>Status do workflow</h2></div><span className="status-pill open">{statusLabel(restoreStatus?.status)}</span></div>
        <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
          <p>{restoreStatus?.message ?? (restoreStatus?.runId ? `Workflow #${restoreStatus.runId}` : "Aguardando início…")}</p>
          {restoreStatus?.runUrl && <a href={restoreStatus.runUrl} target="_blank" rel="noreferrer">Abrir workflow #{restoreStatus.runId}</a>}
          {restoreSteps.length > 0 && <ol style={{ display: "grid", gap: 8, margin: 0, paddingLeft: 24 }}>
            {restoreSteps.map((step) => <li key={step.name}><strong>{step.name}</strong> — {step.conclusion ?? step.status}</li>)}
          </ol>}
          {restoreStatus?.status === "verified" && <div className="evidence-banner"><div><strong>PASS — restore verificado</strong><span>O workflow reportou conclusão bem-sucedida; use o run vinculado como evidência operacional.</span></div><span className="evidence-badge">PASS</span></div>}
          {restoreStatus?.status === "failed" && <div className="ops-alert">FAIL — o workflow não concluiu a verificação.</div>}
        </div>
      </section>}

      {restoreHistory.length > 0 && <section className="ops-card" style={{ maxWidth: 980 }}>
        <div className="card-head"><div><span className="eyebrow">HISTÓRICO</span><h2>Restore drills recentes</h2></div><span className="status-pill open">{restoreHistory.length} registros</span></div>
        <div style={{ overflowX: "auto", marginTop: 18 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={{ textAlign: "left", padding: 10 }}>Data</th><th style={{ textAlign: "left", padding: 10 }}>Run</th><th style={{ textAlign: "left", padding: 10 }}>Status</th><th style={{ textAlign: "left", padding: 10 }}>Evidência</th></tr></thead>
            <tbody>{restoreHistory.map((item) => <tr key={item.runId}><td style={{ padding: 10 }}>{new Date(item.createdAt).toLocaleString("pt-BR")}</td><td style={{ padding: 10 }}>#{item.runId}</td><td style={{ padding: 10 }}><strong>{statusLabel(item.status)}</strong></td><td style={{ padding: 10 }}><a href={item.runUrl} target="_blank" rel="noreferrer">Abrir workflow</a></td></tr>)}</tbody>
          </table>
        </div>
      </section>}

      <section className="evidence-grid">
        <article className="evidence-check is-pass"><div className="evidence-check-top"><span className="check-icon">✓</span><strong>Sem alvo informado pelo usuário</strong><span>PASS</span></div><p>RESTORE_DATABASE_URL e credenciais permanecem no executor.</p></article>
        <article className="evidence-check is-pass"><div className="evidence-check-top"><span className="check-icon">✓</span><strong>Executor separado</strong><span>PASS</span></div><p>A execução ocorre fora da função web, no workflow de infraestrutura.</p></article>
        <article className="evidence-check is-pass"><div className="evidence-check-top"><span className="check-icon">✓</span><strong>Auditoria</strong><span>PASS</span></div><p>Cada solicitação gera um workflow rastreável; o status é consultado diretamente no GitHub Actions.</p></article>
      </section>
    </main>
  );
}
