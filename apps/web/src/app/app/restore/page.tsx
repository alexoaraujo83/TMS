"use client";

import { useState } from "react";
import Link from "next/link";

type Result = {
  ok?: boolean;
  status?: string;
  runUrl?: string;
  message?: string;
  error?: string;
};

export default function RestoreVerifyPage() {
  const [confirmation, setConfirmation] = useState("");
  const [running, setRunning] = useState<"restore" | "backup" | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [backupConfirmation, setBackupConfirmation] = useState("");
  const [backupResult, setBackupResult] = useState<Result | null>(null);

  async function execute() {
    if (confirmation !== "RESTORE-VERIFY") return;
    setRunning("restore");
    setResult(null);
    try {
      const response = await fetch("/api/tms/restore-verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const body = (await response.json()) as Result;
      setResult(response.ok ? body : { error: body.error || body.message || "Falha ao solicitar o restore." });
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : "Falha de comunicação." });
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
      const body = (await response.json()) as Result;
      setBackupResult(response.ok ? body : { error: body.error || body.message || "Falha ao solicitar o backup." });
    } catch (error) {
      setBackupResult({ error: error instanceof Error ? error.message : "Falha de comunicação." });
    } finally {
      setRunning(null);
    }
  }

  return (
    <main className="evidence-page">
      <div className="evidence-head">
        <div>
          <Link href="/app" className="back-link">← Voltar ao dashboard</Link>
          <span className="eyebrow">GOVERNANÇA · DISASTER RECOVERY</span>
          <h1>Restore / Backup</h1>
          <p>
            Executa <code>restore-verify.sh</code> exclusivamente contra o destino
            de recuperação isolado configurado no executor. Produção não é um alvo
            permitido.
          </p>
        </div>
      </div>

      <section className="evidence-banner">
        <div>
          <strong>Barreira de segurança</strong>
          <span>
            O botão dispara somente o workflow de restore-verification. O destino,
            credenciais S3, chave de criptografia e objeto do backup ficam no
            ambiente protegido do executor.
          </span>
        </div>
        <span className="evidence-badge">ISOLADO</span>
      </section>

      <section className="ops-card" style={{ maxWidth: 860 }}>
        <div className="card-head">
          <div>
            <span className="eyebrow">OPERAÇÃO CONTROLADA</span>
            <h2>Executar backup</h2>
          </div>
          <span className="status-pill open">Produção</span>
        </div>
        <p style={{ marginTop: 12 }}>
          Gera um novo backup do banco de produção usando o executor protegido. O navegador nunca recebe banco, credenciais S3 ou chave de criptografia.
        </p>
        <div style={{ display: "grid", gap: 18, marginTop: 18 }}>
          <div>
            <strong>Executor</strong>
            <p><code>.github/workflows/backup-now.yml</code> → <code>infra/backup/backup.sh</code></p>
          </div>
          <div>
            <strong>Validações</strong>
            <p>PostgreSQL 17, TLS <code>verify-full</code>, checksum, manifesto e retenção.</p>
          </div>
          <label style={{ display: "grid", gap: 8 }}>
            <strong>Confirmação</strong>
            <input
              value={backupConfirmation}
              onChange={(event) => setBackupConfirmation(event.target.value)}
              placeholder="Digite BACKUP-NOW"
              autoComplete="off"
              spellCheck={false}
              style={{
                width: "100%",
                maxWidth: 420,
                padding: "12px 14px",
                border: "1px solid var(--border, #d8dde5)",
                borderRadius: 10,
                font: "inherit",
                background: "var(--surface, #fff)",
              }}
            />
          </label>
          <div className="evidence-actions">
            <button
              className="button button-primary"
              onClick={executeBackup}
              disabled={running !== null || backupConfirmation !== "BACKUP-NOW"}
            >
              {running === "backup" ? "Solicitando backup…" : "Executar backup agora"}
            </button>
            {backupResult?.runUrl && (
              <a className="button button-ghost" href={backupResult.runUrl} target="_blank" rel="noreferrer">
                Abrir execução
              </a>
            )}
          </div>
          {backupResult?.error && <div className="ops-alert">{backupResult.error}</div>}
          {backupResult?.message && !backupResult.error && (
            <div className="evidence-banner">
              <div><strong>{backupResult.status ?? "Solicitado"}</strong><span>{backupResult.message}</span></div>
            </div>
          )}
        </div>
      </section>

      <section className="ops-card" style={{ maxWidth: 860 }}>
        <div className="card-head">
          <div>
            <span className="eyebrow">EXECUÇÃO CONTROLADA</span>
            <h2>Iniciar restore drill</h2>
          </div>
          <span className="status-pill open">Aguardando</span>
        </div>

        <div style={{ display: "grid", gap: 18, marginTop: 18 }}>
          <div>
            <strong>Script</strong>
            <p><code>infra/backup/restore-verify.sh</code> → <code>/app/restore-verify.sh</code></p>
          </div>
          <div>
            <strong>Validações</strong>
            <p>download, SHA-256, descriptografia, pg_restore, schema público e schema_migrations.</p>
          </div>
          <div>
            <strong>Destino</strong>
            <p>RESTORE_DATABASE_URL isolada. O workflow não aceita uma URL de banco pelo navegador.</p>
          </div>

          <label style={{ display: "grid", gap: 8 }}>
            <strong>Confirmação</strong>
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="Digite RESTORE-VERIFY"
              autoComplete="off"
              spellCheck={false}
              style={{
                width: "100%",
                maxWidth: 420,
                padding: "12px 14px",
                border: "1px solid var(--border, #d8dde5)",
                borderRadius: 10,
                font: "inherit",
                background: "var(--surface, #fff)",
              }}
            />
          </label>

          <div className="evidence-actions">
            <button
              className="button button-primary"
              onClick={execute}
              disabled={running !== null || confirmation !== "RESTORE-VERIFY"}
            >
              {running === "restore" ? "Solicitando execução…" : "Executar restore-verify.sh"}
            </button>
            {result?.runUrl && (
              <a className="button button-ghost" href={result.runUrl} target="_blank" rel="noreferrer">
                Abrir execução
              </a>
            )}
          </div>

          {result?.error && <div className="ops-alert">{result.error}</div>}
          {result?.message && !result.error && (
            <div className="evidence-banner">
              <div><strong>{result.status ?? "Solicitado"}</strong><span>{result.message}</span></div>
            </div>
          )}
        </div>
      </section>

      <section className="evidence-grid">
        <article className="evidence-check is-pass">
          <div className="evidence-check-top"><span className="check-icon">✓</span><strong>Sem alvo informado pelo usuário</strong><span>PASS</span></div>
          <p>O navegador não envia RESTORE_DATABASE_URL nem credenciais.</p>
        </article>
        <article className="evidence-check is-pass">
          <div className="evidence-check-top"><span className="check-icon">✓</span><strong>Executor separado</strong><span>PASS</span></div>
          <p>A execução ocorre fora da função web, em workflow de infraestrutura.</p>
        </article>
        <article className="evidence-check is-pass">
          <div className="evidence-check-top"><span className="check-icon">✓</span><strong>Auditoria</strong><span>PASS</span></div>
          <p>A solicitação gera um workflow run rastreável no repositório.</p>
        </article>
      </section>
    </main>
  );
}
