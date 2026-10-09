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

const moduleStatusLabel: Record<string, string> = {
  planned: "Planejado",
  in_progress: "Em andamento",
  blocked: "Bloqueado",
  completed: "Concluído",
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

  useEffect(() => {
    void load();
  }, [load]);

  const firstName = user.name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "Admin";
  const visibleStages = (data?.stages ?? []).filter((stage) => {
    const query = stageQuery.trim().toLocaleLowerCase();
    const moduleName = data?.modules.find((module) => module.id === stage.moduleId)?.name ?? "";
    const matchesQuery = !query || `${stage.stageKey} ${stage.name} ${moduleName} ${stage.phase}`.toLocaleLowerCase().includes(query);
    const matchesStatus = stageStatus === "all" || stage.status === stageStatus;
    const matchesModule = selectedModule === "all" || stage.moduleId === selectedModule;
    return matchesQuery && matchesStatus && matchesModule;
  });

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
            <button className="button button-ghost control-refresh" onClick={() => void load()} disabled={loading} aria-label="Atualizar dados do painel">
              {loading ? "Atualizando…" : "↻ Atualizar"}
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

            <section className="control-two-col">
              <div className="control-section" id="evidence">
                <div className="control-section-head"><div><span className="eyebrow">EVIDENCE LEDGER</span><h2>Evidências recentes</h2></div></div>
                <div className="control-list">
                  {data.recentEvidence.length ? data.recentEvidence.map((item) => (
                    <article key={item.id}>
                      <span className={`control-status-dot evidence-${item.status}`}>{item.status === "valid" ? "✓" : "!"}</span>
                      <div><strong>{item.evidenceCode} · {item.title}</strong><small>{item.source ?? "Fonte interna"} · {item.reference ?? "Sem referência"}</small></div>
                      <b>{item.status}</b>
                    </article>
                  )) : <div className="control-empty">Nenhuma evidência registrada.</div>}
                </div>
              </div>

              <div className="control-section" id="blockers">
                <div className="control-section-head"><div><span className="eyebrow">BLOCKER ROUTING</span><h2>Impedimentos ativos</h2></div></div>
                <div className="control-list">
                  {data.blockers.length ? data.blockers.map((item) => (
                    <article key={item.id}>
                      <span className="control-status-dot blocker">!</span>
                      <div><strong>{item.blockerCode} · {item.title}</strong><small>{item.moduleName ?? "Projeto"} · Próxima ação: {item.nextAction ?? "—"}</small></div>
                      <b className={`severity-${item.severity}`}>{item.severity}</b>
                    </article>
                  )) : <div className="control-empty">Nenhum blocker ativo.</div>}
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
