"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchApiHealth, type ApiHealth } from "../../lib/api";

const nav=[["dashboard","Dashboard","⌂"],["transportes","Transportes","▣"],["veiculos","Veículos","◇"],["motoristas","Motoristas","◌"],["clientes","Clientes","◎"],["rotas","Rotas","↗"],["documentos","Documentos","◫"],["financeiro","Financeiro","R$"],["relatorios","Relatórios","▥"],["auditoria","Auditoria","◈"],["configuracoes","Configurações","⚙"]];

type Freight={id:string;status:string;originCity:string;originState:string;destinationCity:string;destinationState:string};
type Session={authenticated:boolean;user?:{name?:string;email?:string}|null};

export default function AppDashboard(){
 const [health,setHealth]=useState<ApiHealth|null>(null),[session,setSession]=useState<Session|null>(null),[freights,setFreights]=useState<Freight[]>([]),[open,setOpen]=useState(true);
 useEffect(()=>{void Promise.all([
  fetchApiHealth().then(setHealth).catch(()=>setHealth(null)),
  fetch("/auth/profile",{cache:"no-store"}).then(async r=>setSession(r.ok?{authenticated:true,user:await r.json()}:{authenticated:false})).catch(()=>setSession({authenticated:false})),
 ]);},[]);
 useEffect(()=>{if(session?.authenticated) void fetch("/api/tms/freights",{cache:"no-store"}).then(r=>r.ok?r.json():[]).then(setFreights).catch(()=>setFreights([]));},[session?.authenticated]);
 const stats=useMemo(()=>({total:freights.length,open:freights.filter(f=>f.status==="open").length,transit:freights.filter(f=>f.status==="in_transit").length,delivered:freights.filter(f=>f.status==="delivered").length}),[freights]);
 const user=session?.user?.name||session?.user?.email||"Operação";
 return <div className="ops-shell">
  <aside className={`sidebar ${open?"":"sidebar-collapsed"}`}>
   <div className="side-brand"><span className="brand-mark">T</span>{open&&<div><strong>TMS</strong><small>Operations Platform</small></div>}</div>
   <button className="side-toggle" onClick={()=>setOpen(!open)} aria-label="Alternar menu">{open?"‹":"›"}</button>
   <nav className="side-nav">{nav.map(([key,label,icon])=><Link key={key} href={key==="dashboard"?"/app":`/app/${key}`} className={key==="dashboard"?"active":""}><span>{icon}</span>{open&&<b>{label}</b>}</Link>)}</nav>
   {open&&<div className="side-status"><span className="status-dot online"/> Sistema operacional<div>{health?.status==="ok"?"API conectada":"API verificando"}</div></div>}
   <div className="side-user">{open&&<div><strong>{user}</strong><small>{session?.user?.email||"Sessão operacional"}</small></div>}<a href={session?.authenticated?"/auth/logout":"/auth/login"}>{session?.authenticated?"↪":"→"}</a></div>
  </aside>
  <main className="ops-main">
   <header className="ops-header"><div><span className="breadcrumb">TMS /</span><strong> Dashboard</strong></div><div className="ops-actions"><span className="live-dot"/> {health?.status==="ok"?"Operação online":"Conectando"}<Link href="/app/transportes" className="button button-primary">+ Novo transporte</Link></div></header>
   <div className="ops-content">
    <section className="ops-welcome"><div><span className="eyebrow">VISÃO GERAL</span><h1>Bom dia, {user.split(" ")[0]}.</h1><p>Acompanhe a operação e mantenha seus transportes sob controle.</p></div><div className="date-chip">25 SET 2026</div></section>
    <section className="metric-grid"><Metric label="Transportes" value={stats.total||"—"} note="total cadastrado"/><Metric label="Em aberto" value={stats.open||"—"} note="aguardando operação"/><Metric label="Em trânsito" value={stats.transit||"—"} note="em execução"/><Metric label="Entregues" value={stats.delivered||"—"} note="finalizados"/></section>
    <section className="ops-grid">
     <div className="ops-card"><div className="card-head"><div><span className="eyebrow">OPERAÇÃO</span><h2>Transportes recentes</h2></div><Link href="/app/transportes">Ver todos →</Link></div>
      {freights.length?<div className="transport-table">{freights.slice(0,6).map(f=><div className="transport-row" key={f.id}><span className="transport-id">{f.id.slice(0,8).toUpperCase()}</span><strong>{f.originCity} <i>{f.originState}</i></strong><span className="route-arrow">→</span><strong>{f.destinationCity} <i>{f.destinationState}</i></strong><Status status={f.status}/></div>)}</div>:<div className="ops-empty"><span>⌁</span><strong>Nenhum transporte encontrado</strong><p>Os transportes criados na operação aparecerão aqui.</p><Link href="/app/transportes" className="text-link">Criar transporte →</Link></div>}
     </div>
     <div className="ops-card activity"><div className="card-head"><div><span className="eyebrow">ATIVIDADE</span><h2>Centro de controle</h2></div></div><Activity title="API operacional" detail={health?.status==="ok"?"Conectada ao ambiente de produção":"Verificando conexão"} icon="✓"/><Activity title="Autenticação" detail={session?.authenticated?"Sessão Auth0 ativa":"Faça login para operar"} icon={session?.authenticated?"✓":"!"}/><Activity title="Tenant" detail={session?.authenticated?"Contexto da sessão carregado":"Aguardando sessão"} icon="•"/></div>
    </section>
   </div>
  </main>
 </div>
}
function Metric({label,value,note}:{label:string;value:string|number;note:string}){return <article className="metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>}
function Status({status}:{status:string}){const labels:Record<string,string>={open:"Aberto",draft:"Rascunho",in_transit:"Em trânsito",delivered:"Entregue",matched:"Matching",cancelled:"Cancelado"};return <span className={`status-pill ${status}`}>{labels[status]||status}</span>}
function Activity({title,detail,icon}:{title:string;detail:string;icon:string}){return <div className="activity-item"><span className="activity-icon">{icon}</span><div><strong>{title}</strong><small>{detail}</small></div></div>}
