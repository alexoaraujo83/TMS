"use client";

import { useCallback, useEffect, useState } from "react";

type Module = {
  id: string;
  moduleKey: string;
  name: string;
  description: string | null;
  status: "planned" | "in_progress" | "blocked" | "completed";
  stageCount: number;
  completedStages: number;
  inProgressStages: number;
  blockedStages: number;
  evidenceCount: number;
  validEvidenceCount: number;
  openBlockers: number;
  progressPercent: number;
};

type Evidence = {
  id: string;
  evidenceCode: string;
  title: string;
  kind: string;
  status: string;
  source: string | null;
  reference: string | null;
  capturedAt: string | null;
};

type Blocker = {
  id: string;
  blockerCode: string;
  title: string;
  severity: string;
  status: string;
  description: string | null;
  nextAction: string | null;
  moduleName: string | null;
};

type Dashboard = {
  project: {
    name: string;
    repository: string;
    branch: string;
    currentGate: string;
  };
  summary: {
    progressPercent: number;
    moduleCount: number;
    completedModules: number;
    inProgressModules: number;
    blockedModules: number;
    stageCount: number;
    completedStages: number;
    evidenceCount: number;
    validEvidenceCount: number;
    openBlockers: number;
  };
  modules: Module[];
  stages: { id: string; moduleId: string; stageKey: string; name: string; phase: string; status: string; weight: number; evidenceRequired: boolean }[];
  recentEvidence: Evidence[];
  blockers: Blocker[];
};

type User = { name?: string; email?: string };

type HealthCheck = {
  id: string;
  label: string;
  status: "healthy" | "degraded" | "blocked" | "unknown";
  detail: string;
  checkedAt: string;
  latencyMs?: number;
};

type HealthSnapshot = {
  generatedAt: string;
  checks: HealthCheck[];
  note: string;
};

const moduleStatusLabel: Record<string, string> = {
  planned: "Planejado",
  in_progress: "Em andamento",
  blocked: "Bloqueado",
  completed: "Concluído",
};

const healthStatusLabel: Record<string, string> = {
  healthy: "Saudável",
  degraded: "Degradado",
  blocked: "Bloqueado",
  unknown: "Não verificado",
};

const stageStatusLabel: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  blocked: "Bloqueado",
  completed: "Concluído",
};

export default function ProjectControlDashboard({ user }: { user: User }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [stageQuery, setStageQuery] = useState("");
  const [stageStatus, setStageStatus] = useState("all");
  const [selectedModule, setSelectedModule] = useState("all");
  const [evidenceQuery, setEvidenceQuery] = useState("");
  const [blockerQuery, setBlockerQuery] = useState("");
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [healthError, setHealthError] = useState("");
  const [healthLoading, setHealthLoading] = useState(false);
  const [traceQuery, setTraceQuery] = useState("");
  const [traceKind, setTraceKind] = useState("correlationId");
  const [traceNotice, setTraceNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/tms/project-control", { cache: "no-store" });
      const body = (await response.json()) as Dashboard & { error?: string };
      if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
      setError("");
      setData(body);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o Control Center.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError("");
    try {
      const response = await fetch("/api/tms/admin/health", { cache: "no-store" });
      const body = (await response.json()) as HealthSnapshot & { error?: string };
      if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
      setHealth(body);
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : "Não foi possível consultar a saúde operacional.");
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadHealth();
  }, [load, loadHealth]);

  const firstName = user.name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "Admin";
  const visibleStages = (data?.stages ?? []).filter((stage) => {
    const query = stageQuery.trim().toLocaleLowerCase();
    const moduleName = data?.modules.find((module) => module.id === stage.moduleId)?.name ?? "";
    const matchesQuery = !query || `${stage.stageKey} ${stage.name} ${moduleName} ${stage.phase}`.toLocaleLowerCase().includes(query);
    const matchesStatus = stageStatus === "all" || stage.status === stageStatus;
    const matchesModule = selectedModule === "all" || stage.moduleId === selectedModule;
    return matchesQuery && matchesStatus && matchesModule;
  });

  const visibleEvidence = (data?.recentEvidence ?? []).filter((item) => {
    const query = evidenceQuery.trim().toLocaleLowerCase();
    return !query || `${item.evidenceCode} ${item.title} ${item.kind} ${item.status} ${item.source ?? ""} ${item.reference ?? ""}`.toLocaleLowerCase().includes(query);
  });
  const visibleBlockers = (data?.blockers ?? []).filter((item) => {
    const query = blockerQuery.trim().toLocaleLowerCase();
    return !query || `${item.blockerCode} ${item.title} ${item.severity} ${item.status} ${item.description ?? ""} ${item.nextAction ?? ""} ${item.moduleName ?? ""}`.toLocaleLowerCase().includes(query);
  });
  const healthCounts = (health?.checks ?? []).reduce(
    (counts, check) => ({ ...counts, [check.status]: counts[check.status] + 1 }),
    { healthy: 0, degraded: 0, blocked: 0, unknown: 0 },
  );

  const refreshAll = useCallback(() => {
    void load();
    void loadHealth();
  }, [load, loadHealth]);

  return (
    <div className="control-shell">
      <aside className="control-sidebar">
        <div className="control-brand">
          <span className="brand-mark">T</span>
          <div><strong>TMS</strong><small>Project Control Center</small></div>
        </div>
        <nav className="control-nav">
          <a className="active" href="#overview">⌂ <span>Dashboard</span></a>
          <a href="#modules">▦ <span>Módulos</span></a>
          <a href="#stages">◫ <span>Etapas</span></a>
          <a href="#evidence">✓ <span>Evidências</span></a>
          <a href="#blockers">! <span>Blockers</span></a>
          <a href="#health">◉ <span>Saúde operacional</span></a>
          <a href="#diagnostics">⌕ <span>Diagnóstico</span></a>
          <a href="#administration">⚙ <span>Administração</span></a>
          <a href="/app">↩ <span>Operação TMS</span></a>
        </nav>
        <div className="control-sidebar-footer">
          <small>Usuário</small>
          <strong>{firstName}</strong>
          <a href="/auth/logout">Sair</a>
        </div>
      </aside>

      <main className="control-main">
        <header className="control-header">
          <div>
            <span className="eyebrow">ADMINISTRAÇÃO · GOVERNANÇA</span>
            <h1>TMS Project Control Center</h1>
            <p>Fonte única para progresso, etapas, evidências e impedimentos do projeto.</p>
          </div>
          <div className="control-header-actions">
            {lastUpdated && <span className="control-updated" aria-live="polite">Atualizado às {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>}
            <button className="button button-ghost control-refresh" onClick={refreshAll} disabled={loading || healthLoading} aria-label="Atualizar dados do painel e saúde operacional">
              {loading || healthLoading ? "Atualizando…" : "↻ Atualizar tudo"}
            </button>
          </div>
        </header>

        {error && <div className="ops-alert" role="alert"><strong>Não foi possível atualizar o painel.</strong><span>{error}</span><button className="button button-ghost" onClick={() => void load()} disabled={loading}>Tentar novamente</button></div>}

        {!data && loading && <div className="control-loading" role="status" aria-live="polite">Carregando dados do TMS…</div>}

        {!data && !loading && !error && <div className="control-loading">Nenhum dado disponível. Atualize para tentar novamente.</div>}

        {data && (
          <>
            <section className="control-hero" id="overview">
              <div>
                <span className="control-label">STATUS DO PROJETO</span>
                <div className="control-progress-line">
                  <strong>{data.summary.progressPercent}%</strong>
                  <div><i style={{ width: `${data.summary.progressPercent}%` }} /></div>
                </div>
                <p>Progresso derivado das etapas registradas. Percentuais não são armazenados manualmente.</p>
              </div>
              <div className="control-project-meta">
                <div><span>Repositório</span><strong>{data.project.repository}</strong></div>
                <div><span>Branch</span><strong>{data.project.branch}</strong></div>
                <div><span>Gate atual</span><strong>{data.project.currentGate}</strong></div>
              </div>
            </section>

            <section className="control-section" id="health">
              <div className="control-section-head">
                <div><span className="eyebrow">OBSERVABILIDADE</span><h2>Saúde operacional</h2></div>
                <div className="control-header-actions">
                  {health?.generatedAt && <span className="control-updated">Snapshot: {new Date(health.generatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>}
                  <button className="button button-ghost" onClick={() => void loadHealth()} disabled={healthLoading}>
                    {healthLoading ? "Verificando…" : "↻ Verificar"}
                  </button>
                </div>
              </div>
              {healthError && <div className="ops-alert" role="alert"><strong>Falha na consulta de saúde.</strong><span>{healthError}</span></div>}
              {!health && healthLoading && <div className="control-loading" role="status">Verificando endpoints operacionais…</div>}
              {health && <>
                <div className="control-health-summary" aria-label="Resumo dos estados operacionais">
                  <span className="health-healthy">{healthCounts.healthy} saudáveis</span>
                  <span className="health-degraded">{healthCounts.degraded} degradados</span>
                  <span className="health-blocked">{healthCounts.blocked} bloqueados</span>
                  <span className="health-unknown">{healthCounts.unknown} não verificados</span>
                </div>
                {healthError && <p className="control-health-note" role="status">A última verificação falhou; os estados abaixo são do snapshot anterior e não representam uma verificação atual.</p>}
                <div className="control-health-grid">
                  {health.checks.map((check) => (
                    <article className="control-health-card" key={check.id}>
                      <div className="control-health-top">
                        <strong>{check.label}</strong>
                        <span className={`control-health-status health-${check.status}`}>{healthStatusLabel[check.status]}</span>
                      </div>
                      <p>{check.detail}</p>
                      <small>{check.latencyMs !== undefined ? `${check.latencyMs} ms · ` : ""}{new Date(check.checkedAt).toLocaleTimeString("pt-BR")}</small>
                    </article>
                  ))}
                </div>
                <p className="control-health-note">{health.note}</p>
              </>}
            </section>

            <section className="control-metrics">
              <Metric label="Módulos" value={data.summary.moduleCount} note={`${data.summary.completedModules} concluídos · ${data.summary.blockedModules} bloqueados`} />
              <Metric label="Etapas" value={data.summary.stageCount} note={`${data.summary.completedStages} concluídas`} />
              <Metric label="Evidências" value={data.summary.evidenceCount} note={`${data.summary.validEvidenceCount} válidas`} />
              <Metric label="Blockers" value={data.summary.openBlockers} note="não resolvidos" danger={data.summary.openBlockers > 0} />
            </section>

            <section className="control-section" id="modules">
              <div className="control-section-head">
                <div><span className="eyebrow">EXECUÇÃO</span><h2>Módulos do projeto</h2></div>
                <span>{data.modules.length} módulos</span>
              </div>
              <div className="control-module-grid">
                {data.modules.map((module) => (
                  <article className={`control-module-card status-${module.status}`} key={module.id}>
                    <div className="control-card-top">
                      <span>{moduleStatusLabel[module.status]}</span>
                      <strong>{module.progressPercent}%</strong>
                    </div>
                    <h3>{module.name}</h3>
                    <p>{module.description}</p>
                    <div className="control-bar"><i style={{ width: `${module.progressPercent}%` }} /></div>
                    <div className="control-card-stats">
                      <span>{module.completedStages}/{module.stageCount} etapas</span>
                      <span>{module.validEvidenceCount}/{module.evidenceCount} evidências</span>
                      {module.openBlockers > 0 && <b>{module.openBlockers} blocker{module.openBlockers > 1 ? "s" : ""}</b>}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="control-section" id="stages">
              <div className="control-section-head">
                <div><span className="eyebrow">MASTER CONTROLLER</span><h2>DISCOVER → ANALYZE → CLASSIFY → CORRECT → TEST → EVIDENCE → NEXT</h2></div>
              </div>
              <div className="control-phase-strip">
                {["discover","analyze","classify","correct","test","evidence","next"].map((phase) => {
                  const phaseStages = data.stages.filter((stage) => stage.phase === phase);
                  const completed = phaseStages.filter((stage) => stage.status === "completed").length;
                  return <span key={phase}><b>{phase}</b><small>{phaseStages.length ? `${completed}/${phaseStages.length} concluídas` : "Sem etapas"}</small></span>;
                })}
              </div>
              <div className="control-stage-toolbar">
                <label className="control-filter">
                  <span>Buscar etapa</span>
                  <input value={stageQuery} onChange={(event) => setStageQuery(event.target.value)} placeholder="Nome, código, módulo ou fase" />
                </label>
                <label className="control-filter">
                  <span>Módulo</span>
                  <select value={selectedModule} onChange={(event) => setSelectedModule(event.target.value)}>
                    <option value="all">Todos os módulos</option>
                    {data.modules.map((module) => <option key={module.id} value={module.id}>{module.name}</option>)}
                  </select>
                </label>
                <label className="control-filter">
                  <span>Status</span>
                  <select value={stageStatus} onChange={(event) => setStageStatus(event.target.value)}>
                    <option value="all">Todos os status</option>
                    {Object.entries(stageStatusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <span className="control-stage-count">{visibleStages.length} de {data.stages.length} etapas</span>
              </div>
              <div className="control-stage-table-wrap">
                <table className="control-stage-table">
                  <thead><tr><th>Etapa</th><th>Módulo</th><th>Fase</th><th>Status</th><th>Peso</th><th>Evidência</th></tr></thead>
                  <tbody>
                    {visibleStages.map((stage) => {
                      const moduleName = data.modules.find((module) => module.id === stage.moduleId)?.name ?? "Módulo não identificado";
                      return <tr key={stage.id}>
                        <td><strong>{stage.name}</strong><small>{stage.stageKey}</small></td>
                        <td>{moduleName}</td>
                        <td><span className="control-phase-tag">{stage.phase}</span></td>
                        <td><span className={`control-stage-status status-${stage.status}`}>{stageStatusLabel[stage.status] ?? stage.status}</span></td>
                        <td>{stage.weight}</td>
                        <td>{stage.evidenceRequired ? <span className="control-evidence-required">Obrigatória</span> : "Opcional"}</td>
                      </tr>;
                    })}
                    {!visibleStages.length && <tr><td className="control-stage-empty" colSpan={6}>Nenhuma etapa corresponde aos filtros selecionados.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="control-section" id="diagnostics">
              <div className="control-section-head">
                <div><span className="eyebrow">CORRELATED DIAGNOSTICS</span><h2>Preparar consulta de rastreabilidade</h2></div>
              </div>
              <p className="control-section-description">Informe um identificador já obtido nos logs. Este painel não consulta nem expõe logs por conta própria; a pesquisa central exige integração server-side autorizada com API, worker e provedores de logs.</p>
              <form className="control-trace-form" onSubmit={(event) => {
                event.preventDefault();
                const value = traceQuery.trim();
                if (!value) { setTraceNotice("Informe um identificador antes de preparar a consulta."); return; }
                setTraceNotice(`Consulta preparada: ${traceKind} = ${value}. Nenhum log foi consultado ou alterado.`);
              }}>
                <label className="control-filter">
                  <span>Tipo de identificador</span>
                  <select value={traceKind} onChange={(event) => setTraceKind(event.target.value)}>
                    <option value="requestId">requestId</option>
                    <option value="correlationId">correlationId</option>
                    <option value="event_id">event_id</option>
                    <option value="idempotency_key">idempotency_key</option>
                    <option value="freightId">freightId</option>
                    <option value="jobId">jobId</option>
                  </select>
                </label>
                <label className="control-filter">
                  <span>Valor</span>
                  <input value={traceQuery} onChange={(event) => { setTraceQuery(event.target.value); setTraceNotice(""); }} placeholder="Cole um ID não secreto" maxLength={200} />
                </label>
                <button className="button button-ghost" type="submit">Preparar consulta</button>
              </form>
              {traceNotice && <p className="control-inline-notice" role="status">{traceNotice}</p>}
              <div className="control-trace-chain" aria-label="Cadeia de rastreabilidade esperada">
                <span>Web / BFF</span><b>→</b><span>Core API</span><b>→</b><span>PostgreSQL</span><b>→</b><span>Outbox</span><b>→</b><span>Durable Job</span><b>→</b><span>Handler / Auditoria</span>
              </div>
            </section>

            <section className="control-section" id="administration">
              <div className="control-section-head"><div><span className="eyebrow">ADMINISTRAÇÃO SEGURA</span><h2>Controles e trilhas administrativas</h2></div></div>
              <div className="control-admin-grid">
                <article><strong>Identidade e permissões</strong><p>O painel exige sessão Auth0; a autorização administrativa por role/permission ainda precisa ser validada no servidor antes de habilitar operações de escrita.</p><span className="control-health-status health-unknown">Validação pendente</span></article>
                <article><strong>Auditoria</strong><p>O ledger atual exibe evidências registradas. Trilha imutável de ações administrativas exige endpoint de auditoria com ator, tenant, ação, alvo e timestamp.</p><span className="control-health-status health-unknown">Integração pendente</span></article>
                <article><strong>Deploys e ações operacionais</strong><p>Histórico de deploy, rollback e replay só devem ser conectados a provedores autenticados, com autorização explícita, confirmação e registro de auditoria.</p><span className="control-health-status health-unknown">Integração pendente</span></article>
              </div>
            </section>

            <section className="control-two-col">
              <div className="control-section" id="evidence">
                <div className="control-section-head"><div><span className="eyebrow">EVIDENCE LEDGER</span><h2>Evidências recentes</h2></div><span>{visibleEvidence.length} de {data.recentEvidence.length}</span></div>
                <label className="control-filter">
                  <span>Buscar evidência</span>
                  <input value={evidenceQuery} onChange={(event) => setEvidenceQuery(event.target.value)} placeholder="Código, título, status ou referência" />
                </label>
                <div className="control-list">
                  {visibleEvidence.length ? visibleEvidence.map((item) => (
                    <article key={item.id}>
                      <span className={`control-status-dot evidence-${item.status}`}>{item.status === "valid" ? "✓" : "!"}</span>
                      <div><strong>{item.evidenceCode} · {item.title}</strong><small>{item.source ?? "Fonte interna"} · {item.reference ?? "Sem referência"}</small></div>
                      <b>{item.status}</b>
                    </article>
                  )) : <div className="control-empty">Nenhuma evidência corresponde à busca.</div>}
                </div>
              </div>

              <div className="control-section" id="blockers">
                <div className="control-section-head"><div><span className="eyebrow">BLOCKER ROUTING</span><h2>Impedimentos ativos</h2></div><span>{visibleBlockers.length} de {data.blockers.length}</span></div>
                <label className="control-filter">
                  <span>Buscar impedimento</span>
                  <input value={blockerQuery} onChange={(event) => setBlockerQuery(event.target.value)} placeholder="Código, título, severidade ou ação" />
                </label>
                <div className="control-list">
                  {visibleBlockers.length ? visibleBlockers.map((item) => (
                    <article key={item.id}>
                      <span className="control-status-dot blocker">!</span>
                      <div><strong>{item.blockerCode} · {item.title}</strong><small>{item.moduleName ?? "Projeto"} · Próxima ação: {item.nextAction ?? "—"}</small></div>
                      <b className={`severity-${item.severity}`}>{item.severity}</b>
                    </article>
                  )) : <div className="control-empty">Nenhum impedimento corresponde à busca.</div>}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Metric({ label, value, note, danger = false }: { label: string; value: string | number; note: string; danger?: boolean }) {
  return <article className={`control-metric${danger ? " is-danger" : ""}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}
