"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchApiHealth, type ApiHealth } from "../lib/api";

type Session = { authenticated: boolean; user?: { name?: string; email?: string } | null };
type Freight = {
  id: string;
  status: string;
  originCity: string;
  originState: string;
  destinationCity: string;
  destinationState: string;
};

const initial = {
  freightType: "dedicated",
  originCity: "Santos",
  originState: "SP",
  destinationCity: "Campinas",
  destinationState: "SP",
  cargoDescription: "Carga de teste TMS",
  quantity: "1",
  weightKg: "100",
};

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  open: "Aberto",
  matched: "Em matching",
  in_transit: "Em trânsito",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export default function HomePage() {
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [freights, setFreights] = useState<Freight[]>([]);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  async function loadFreights() {
    const r = await fetch("/api/tms/freights", { cache: "no-store" });
    if (!r.ok) throw new Error((await r.text()) || `GET /freights: HTTP ${r.status}`);
    setFreights(await r.json());
  }

  async function createFreight(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/tms/freights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          quantity: Number(form.quantity),
          weightKg: Number(form.weightKg),
        }),
      });
      if (!r.ok) throw new Error((await r.text()) || `POST /freights: HTTP ${r.status}`);
      setForm(initial);
      await loadFreights();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível criar o frete.");
    } finally {
      setBusy(false);
    }
  }

  async function openFreight(id: string) {
    setUpdating(id);
    setError(null);
    try {
      const r = await fetch(`/api/tms/freights/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "open" }),
      });
      if (!r.ok) throw new Error((await r.text()) || `PATCH /freights/:id/status: HTTP ${r.status}`);
      await loadFreights();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível atualizar o frete.");
    } finally {
      setUpdating(null);
    }
  }

  useEffect(() => {
    void Promise.all([
      fetchApiHealth().then(setHealth).catch(() => setHealth(null)),
      fetch("/auth/profile", { cache: "no-store" })
        .then(async (r) => setSession(r.ok ? { authenticated: true, user: await r.json() } : { authenticated: false }))
        .catch(() => setSession({ authenticated: false })),
    ]);
  }, []);

  useEffect(() => {
    if (session?.authenticated) {
      void loadFreights().catch((e) => setError(e instanceof Error ? e.message : "Falha ao carregar fretes."));
    }
  }, [session?.authenticated]);

  const stats = useMemo(() => ({
    total: freights.length,
    open: freights.filter((f) => f.status === "open").length,
    draft: freights.filter((f) => f.status === "draft").length,
    transit: freights.filter((f) => f.status === "in_transit").length,
  }), [freights]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">T</div>
          <div>
            <strong>TMS</strong>
            <span>Transportation Management</span>
          </div>
        </div>
        {session?.authenticated ? (
          <div className="account">
            <div className="avatar">{(session.user?.name ?? session.user?.email ?? "U").slice(0, 1).toUpperCase()}</div>
            <div className="account-copy">
              <strong>{session.user?.name ?? "Usuário"}</strong>
              <span>{session.user?.email}</span>
            </div>
            <a className="button button-ghost" href="/auth/logout">Sair</a>
          </div>
        ) : (
          <div className="account-actions">
            <a className="button button-ghost" href="/auth/login">Entrar</a>
            <a className="button button-primary" href="/auth/login?screen_hint=signup">Criar conta</a>
          </div>
        )}
      </header>

      <main className="content">
        <section className="hero">
          <div>
            <p className="eyebrow">OPERAÇÃO LOGÍSTICA</p>
            <h1>Controle seus fretes em um só lugar.</h1>
            <p className="hero-copy">Crie, acompanhe e atualize cargas com uma visão operacional simples e preparada para crescer.</p>
          </div>
          <div className="hero-status">
            <span className={health ? "status-dot online" : "status-dot"} />
            API {health?.status === "ok" ? "operacional" : "verificando"}
          </div>
        </section>

        {error && <div className="alert" role="alert">{error}</div>}

        {!session && <section className="auth-card">
          <div>
            <p className="eyebrow">ACESSO SEGURO</p>
            <h2>Entre para acessar sua operação</h2>
            <p>O ambiente usa Auth0 para autenticação e mantém os dados da operação protegidos por tenant.</p>
          </div>
          <a className="button button-primary" href="/auth/login">Entrar com Auth0</a>
        </section>}

        {session?.authenticated && (
          <>
            <section className="stats-grid" aria-label="Resumo da operação">
              <div className="stat-card"><span>Total de fretes</span><strong>{stats.total}</strong></div>
              <div className="stat-card"><span>Abertos</span><strong>{stats.open}</strong></div>
              <div className="stat-card"><span>Rascunhos</span><strong>{stats.draft}</strong></div>
              <div className="stat-card"><span>Em trânsito</span><strong>{stats.transit}</strong></div>
            </section>

            <section className="workspace">
              <div className="panel">
                <div className="panel-heading">
                  <div><p className="eyebrow">NOVO FRETE</p><h2>Criar carga</h2></div>
                  <span className="panel-number">01</span>
                </div>
                <form className="freight-form" onSubmit={createFreight}>
                  <label>Tipo de frete<select value={form.freightType} onChange={(e) => setForm({ ...form, freightType: e.target.value })}><option value="dedicated">Dedicado</option><option value="shared">Fracionado</option><option value="complement">Complemento</option><option value="urgent">Urgente</option></select></label>
                  <div className="form-row"><label>Origem<input value={form.originCity} onChange={(e) => setForm({ ...form, originCity: e.target.value })} /></label><label>UF<input value={form.originState} maxLength={2} onChange={(e) => setForm({ ...form, originState: e.target.value.toUpperCase() })} /></label></div>
                  <div className="route-line" aria-hidden="true"><span /><b>→</b><span /></div>
                  <div className="form-row"><label>Destino<input value={form.destinationCity} onChange={(e) => setForm({ ...form, destinationCity: e.target.value })} /></label><label>UF<input value={form.destinationState} maxLength={2} onChange={(e) => setForm({ ...form, destinationState: e.target.value.toUpperCase() })} /></label></div>
                  <label>Descrição da carga<input value={form.cargoDescription} onChange={(e) => setForm({ ...form, cargoDescription: e.target.value })} /></label>
                  <div className="form-row"><label>Quantidade<input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label><label>Peso (kg)<input type="number" min="1" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} /></label></div>
                  <button className="button button-primary button-wide" disabled={busy}>{busy ? "Criando..." : "Criar frete"}</button>
                </form>
              </div>

              <div className="panel panel-list">
                <div className="panel-heading">
                  <div><p className="eyebrow">OPERAÇÃO</p><h2>Fretes atuais</h2></div>
                  <span className="count-badge">{freights.length}</span>
                </div>
                {freights.length === 0 ? <div className="empty-state"><span>⌁</span><strong>Nenhum frete ainda</strong><p>Crie a primeira carga usando o formulário ao lado.</p></div> : <div className="freight-list">{freights.map((f) => <article className="freight-item" key={f.id}><div className="freight-route"><strong>{f.originCity} <small>{f.originState}</small></strong><span>→</span><strong>{f.destinationCity} <small>{f.destinationState}</small></strong></div><div className="freight-meta"><span className={`pill pill-${f.status}`}>{statusLabel[f.status] ?? f.status}</span>{f.status === "draft" && <button className="text-button" disabled={updating === f.id} onClick={() => void openFreight(f.id)}>{updating === f.id ? "Atualizando..." : "Abrir frete →"}</button>}</div></article>)}</div>}
              </div>
            </section>
          </>
        )}
      </main>

      <footer><span>TMS Platform</span><span>API: {health?.status ?? "verificando"}</span></footer>
    </div>
  );
}
