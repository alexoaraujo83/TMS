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
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function execute() {
    if (confirmation !== "RESTORE-VERIFY") return;
    setRunning(true);
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
      setRunning(false);
    }
  }

  return (
    <main className="evidence-page">
      <div className="evidence-head">
        <div>
          <Link href="/app" className="back-link">← Voltar ao dashboard</Link>
          <span className="eyebrow">GOVERNANÇA · DISASTER RECOVERY</span>
          <h1>Restore verification</h1>
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
              disabled={running || confirmation !== "RESTORE-VERIFY"}
            >
              {running ? "Solicitando execução…" : "Executar restore-verify.sh"}
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
