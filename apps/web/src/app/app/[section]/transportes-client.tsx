"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Freight={id:string;status:string;freightType:string;originCity:string;originState:string;destinationCity:string;destinationState:string;createdAt?:string};

const labels:Record<string,string>={draft:"Rascunho",open:"Aberto",matching:"Matching",negotiating:"Negociando",assigned:"Atribuído",in_transit:"Em trânsito",delivered:"Entregue",cancelled:"Cancelado"};

export default function TransportesPage(){
 const [freights,setFreights]=useState<Freight[]>([]);
 const [loading,setLoading]=useState(true);
 const [deleting,setDeleting]=useState<string|null>(null);
 const [error,setError]=useState("");
 async function load(){setLoading(true);setError("");try{const r=await fetch("/api/tms/freights",{cache:"no-store"});const body=await r.json().catch(()=>[]);if(!r.ok)throw new Error(body?.detail||body?.error||"Não foi possível carregar os transportes.");setFreights(Array.isArray(body)?body:[]);}catch(e){setError(e instanceof Error?e.message:"Não foi possível carregar os transportes.");}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 async function remove(id:string){
  if(!window.confirm("Excluir este frete? Esta ação é permanente e será registrada na auditoria."))return;
  setDeleting(id);setError("");
  try{const r=await fetch(`/api/tms/freights?id=${encodeURIComponent(id)}`,{method:"DELETE"});const body=await r.json().catch(()=>({}));if(!r.ok)throw new Error(body?.detail||body?.error||"Não foi possível excluir o frete.");setFreights(v=>v.filter(f=>f.id!==id));}catch(e){setError(e instanceof Error?e.message:"Não foi possível excluir o frete.");}finally{setDeleting(null);}
 }
 return <main className="module-page transportes-page">
  <Link href="/app" className="back-link">← Voltar ao dashboard</Link>
  <div className="module-page-head"><div><span className="eyebrow">OPERAÇÃO</span><h1>Transportes</h1><p>Crie, acompanhe, atualize e exclua fretes da operação.</p></div><Link href="/app" className="button button-primary">+ Novo transporte</Link></div>
  {error&&<div className="ops-alert">{error}</div>}
  <section className="ops-card freight-list-card">
   <div className="card-head"><div><span className="eyebrow">FRETES</span><h2>{freights.length} transporte{freights.length===1?"":"s"}</h2></div><button className="button button-secondary" onClick={()=>void load()} disabled={loading}>Atualizar</button></div>
   {loading?<div className="ops-empty"><strong>Carregando transportes…</strong></div>:freights.length===0?<div className="ops-empty"><span>⌁</span><strong>Nenhum transporte encontrado</strong><p>Crie um transporte para iniciar a operação.</p></div>:
   <div className="freight-list">{freights.map(f=><article className="freight-item" key={f.id}><div className="freight-main"><span className="transport-id">{f.id.slice(0,8).toUpperCase()}</span><div><strong>{f.originCity} <i>{f.originState}</i> <span className="route-arrow">→</span> {f.destinationCity} <i>{f.destinationState}</i></strong><small>{f.freightType} · {labels[f.status]||f.status}</small></div></div><div className="freight-actions"><span className={`status-pill ${f.status}`}>{labels[f.status]||f.status}</span><button className="button button-danger" onClick={()=>void remove(f.id)} disabled={deleting===f.id}>{deleting===f.id?"Excluindo…":"Excluir"}</button></div></article>)}</div>}
  </section>
 </main>;
}