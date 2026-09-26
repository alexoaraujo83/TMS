"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Freight={
 id:string; status:string; freightType:string; originCity:string; originState:string;
 destinationCity:string; destinationState:string; cargoDescription:string;
 quantity:number; weightKg:string|number; customerPriceCents:string|number|null;
 driverPriceCents:string|number|null;
};
type FormState={
 freightType:string; originCity:string; originState:string; destinationCity:string;
 destinationState:string; cargoDescription:string; quantity:string; weightKg:string;
 customerPriceCents:string; driverPriceCents:string;
};

const labels:Record<string,string>={draft:"Rascunho",open:"Aberto",matching:"Matching",negotiating:"Negociando",assigned:"Atribuído",in_transit:"Em trânsito",delivered:"Entregue",cancelled:"Cancelado"};
const freightTypes=[["dedicated","Dedicado"],["shared","Fracionado"],["complement","Complemento"],["urgent","Urgente"]];

const emptyForm:FormState={freightType:"dedicated",originCity:"",originState:"",destinationCity:"",destinationState:"",cargoDescription:"",quantity:"1",weightKg:"",customerPriceCents:"",driverPriceCents:""};

function formFrom(f:Freight):FormState{return{
 freightType:f.freightType,originCity:f.originCity,originState:f.originState,destinationCity:f.destinationCity,
 destinationState:f.destinationState,cargoDescription:f.cargoDescription||"",quantity:String(f.quantity??1),weightKg:String(f.weightKg??""),
 customerPriceCents:f.customerPriceCents==null?"":String(f.customerPriceCents),driverPriceCents:f.driverPriceCents==null?"":String(f.driverPriceCents)
};}

export default function TransportesPage(){
 const [freights,setFreights]=useState<Freight[]>([]);
 const [selected,setSelected]=useState<Set<string>>(new Set());
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState<string|null>(null),[deleting,setDeleting]=useState<string|null>(null),[bulkDeleting,setBulkDeleting]=useState(false);
 const [editing,setEditing]=useState<string|null>(null),[form,setForm]=useState<FormState|null>(null),[creating,setCreating]=useState(false),[createSaving,setCreateSaving]=useState(false),[error,setError]=useState("");
 async function load(){setLoading(true);setError("");try{const r=await fetch("/api/tms/freights",{cache:"no-store"});const body=await r.json().catch(()=>[]);if(!r.ok)throw new Error(body?.detail||body?.error||"Não foi possível carregar os transportes.");setFreights(Array.isArray(body)?body:[]);setSelected(new Set());}catch(e){setError(e instanceof Error?e.message:"Não foi possível carregar os transportes.");}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 function startEdit(f:Freight){setEditing(f.id);setCreating(false);setForm(formFrom(f));setError("");}
 function startCreate(){setEditing(null);setCreating(true);setForm({...emptyForm});setError("");}
 function cancelEdit(){setEditing(null);setCreating(false);setForm(null);}
 function change(key:keyof FormState,value:string){setForm(v=>v?{...v,[key]:value}:v);}
 function toggleSelected(id:string){setSelected(prev=>{const next=new Set(prev);if(next.has(id))next.delete(id);else next.add(id);return next;});}
 function toggleAll(){setSelected(prev=>prev.size===freights.length?new Set():new Set(freights.map(f=>f.id)));}
 async function removeSelected(){const ids=Array.from(selected);if(!ids.length)return;if(!window.confirm(`Excluir ${ids.length} frete${ids.length===1?"":"s"} selecionado${ids.length===1?"":"s"}? Esta ação é permanente e será registrada na auditoria.`))return;setBulkDeleting(true);setError("");const results=await Promise.allSettled(ids.map(async id=>{const r=await fetch(`/api/tms/freights?id=${encodeURIComponent(id)}`,{method:"DELETE"});const body=await r.json().catch(()=>({}));if(!r.ok)throw new Error(body?.detail||body?.error||"Não foi possível excluir o frete.");return id;}));const ok=results.flatMap(r=>r.status==="fulfilled"?[r.value]:[]);setFreights(v=>v.filter(f=>!ok.includes(f.id)));setSelected(new Set());setBulkDeleting(false);const failed=results.length-ok.length;if(failed)setError(`Não foi possível excluir ${failed} frete${failed===1?"":"s"} selecionado${failed===1?"":"s"}.`);}
 async function createFreight(){
  if(!form)return;
  setCreateSaving(true);setError("");
  try{
   const payload={...form,originState:form.originState.toUpperCase(),destinationState:form.destinationState.toUpperCase(),quantity:Number(form.quantity),weightKg:Number(form.weightKg),
    customerPriceCents:form.customerPriceCents?Number(form.customerPriceCents):undefined,driverPriceCents:form.driverPriceCents?Number(form.driverPriceCents):undefined};
   const r=await fetch("/api/tms/freights",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
   const body=await r.json().catch(()=>({}));if(!r.ok)throw new Error(body?.detail||body?.error||"Não foi possível incluir o frete.");
   setFreights(v=>[body,...v]);cancelEdit();
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível incluir o frete.");}finally{setCreateSaving(false);}
 }
 async function save(id:string){
  if(!form)return;
  setSaving(id);setError("");
  try{
   const payload={...form,originState:form.originState.toUpperCase(),destinationState:form.destinationState.toUpperCase(),quantity:Number(form.quantity),weightKg:Number(form.weightKg),
    customerPriceCents:form.customerPriceCents?Number(form.customerPriceCents):undefined,driverPriceCents:form.driverPriceCents?Number(form.driverPriceCents):undefined};
   const r=await fetch(`/api/tms/freights?id=${encodeURIComponent(id)}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
   const body=await r.json().catch(()=>({}));if(!r.ok)throw new Error(body?.detail||body?.error||"Não foi possível alterar o frete.");
   setFreights(v=>v.map(f=>f.id===id?body:f));cancelEdit();
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível alterar o frete.");}finally{setSaving(null);}
 }
 async function remove(id:string){
  if(!window.confirm("Excluir este frete? Esta ação é permanente e será registrada na auditoria."))return;
  setDeleting(id);setError("");
  try{const r=await fetch(`/api/tms/freights?id=${encodeURIComponent(id)}`,{method:"DELETE"});const body=await r.json().catch(()=>({}));if(!r.ok)throw new Error(body?.detail||body?.error||"Não foi possível excluir o frete.");setFreights(v=>v.filter(f=>f.id!==id));if(editing===id)cancelEdit();}catch(e){setError(e instanceof Error?e.message:"Não foi possível excluir o frete.");}finally{setDeleting(null);}
 }
 return <main className="module-page transportes-page">
  <Link href="/app" className="back-link">← Voltar ao dashboard</Link>
  <div className="module-page-head"><div><span className="eyebrow">OPERAÇÃO</span><h1>Transportes</h1><p>Crie, acompanhe, altere e exclua fretes da operação.</p></div><button className="button button-primary" onClick={startCreate} disabled={loading||createSaving||!!saving||!!deleting}>+ Incluir frete</button></div>
  {error&&<div className="ops-alert">{error}</div>}
  {creating&&form&&<section className="ops-card freight-create-card">
   <div className="edit-form-head"><div><span className="eyebrow">NOVO FRETE</span><h2>Incluir frete</h2><p>Cadastre um novo transporte na operação.</p></div></div>
   <div className="edit-grid">
    <label>Tipo<select value={form.freightType} onChange={e=>change("freightType",e.target.value)}>{freightTypes.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
    <label>Origem<input value={form.originCity} onChange={e=>change("originCity",e.target.value)} placeholder="Cidade" /></label>
    <label>UF origem<input maxLength={2} value={form.originState} onChange={e=>change("originState",e.target.value)} placeholder="SP" /></label>
    <label>Destino<input value={form.destinationCity} onChange={e=>change("destinationCity",e.target.value)} placeholder="Cidade" /></label>
    <label>UF destino<input maxLength={2} value={form.destinationState} onChange={e=>change("destinationState",e.target.value)} placeholder="RJ" /></label>
    <label>Carga<input value={form.cargoDescription} onChange={e=>change("cargoDescription",e.target.value)} placeholder="Descrição da carga" /></label>
    <label>Quantidade<input type="number" min="1" value={form.quantity} onChange={e=>change("quantity",e.target.value)} /></label>
    <label>Peso (kg)<input type="number" min="0.01" step="0.01" value={form.weightKg} onChange={e=>change("weightKg",e.target.value)} /></label>
    <label>Preço cliente (centavos)<input type="number" min="1" value={form.customerPriceCents} onChange={e=>change("customerPriceCents",e.target.value)} placeholder="Opcional" /></label>
    <label>Preço motorista (centavos)<input type="number" min="1" value={form.driverPriceCents} onChange={e=>change("driverPriceCents",e.target.value)} placeholder="Opcional" /></label>
   </div>
   <div className="freight-actions"><button className="button button-secondary" onClick={cancelEdit} disabled={createSaving}>Cancelar</button><button className="button button-primary" onClick={()=>void createFreight()} disabled={createSaving}>{createSaving?"Incluindo…":"Incluir frete"}</button></div>
  </section>}
  <section className="ops-card freight-list-card">
   <div className="card-head"><div><span className="eyebrow">FRETES</span><h2>{freights.length} transporte{freights.length===1?"":"s"}</h2></div><div className="freight-bulk-actions"><button className="button button-secondary" onClick={()=>void load()} disabled={loading||createSaving||!!saving||!!deleting||bulkDeleting}>Atualizar</button><button className="button button-danger" onClick={()=>void removeSelected()} disabled={!selected.size||loading||createSaving||!!saving||!!deleting||bulkDeleting}>{bulkDeleting?"Excluindo…":`Excluir selecionados${selected.size?` (${selected.size})`:""}`}</button></div></div>
   {loading?<div className="ops-empty"><strong>Carregando transportes…</strong></div>:freights.length===0?<div className="ops-empty"><span>⌁</span><strong>Nenhum transporte encontrado</strong><p>Crie um transporte para iniciar a operação.</p></div>:
   <div className="freight-list"><div className="freight-select-all"><label><input type="checkbox" checked={freights.length>0&&selected.size===freights.length} onChange={toggleAll} disabled={loading||createSaving||!!saving||!!deleting||bulkDeleting}/><span>Selecionar todos</span></label>{selected.size>0&&<strong>{selected.size} selecionado{selected.size===1?"":"s"}</strong>}</div>{freights.map(f=><article className={`freight-item${selected.has(f.id)?" freight-item-selected":""}`} key={f.id}>
    {editing===f.id&&form?<div className="freight-edit-form">
      <div className="edit-form-head"><div><span className="eyebrow">EDIÇÃO</span><h3>Alterar transporte {f.id.slice(0,8).toUpperCase()}</h3></div><span className={`status-pill ${f.status}`}>{labels[f.status]||f.status}</span></div>
      <div className="edit-grid">
       <label>Tipo<select value={form.freightType} onChange={e=>change("freightType",e.target.value)}>{freightTypes.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
       <label>Origem<input value={form.originCity} onChange={e=>change("originCity",e.target.value)} /></label>
       <label>UF origem<input maxLength={2} value={form.originState} onChange={e=>change("originState",e.target.value)} /></label>
       <label>Destino<input value={form.destinationCity} onChange={e=>change("destinationCity",e.target.value)} /></label>
       <label>UF destino<input maxLength={2} value={form.destinationState} onChange={e=>change("destinationState",e.target.value)} /></label>
       <label>Carga<input value={form.cargoDescription} onChange={e=>change("cargoDescription",e.target.value)} /></label>
       <label>Quantidade<input type="number" min="1" value={form.quantity} onChange={e=>change("quantity",e.target.value)} /></label>
       <label>Peso (kg)<input type="number" min="0.01" step="0.01" value={form.weightKg} onChange={e=>change("weightKg",e.target.value)} /></label>
       <label>Preço cliente (centavos)<input type="number" min="1" value={form.customerPriceCents} onChange={e=>change("customerPriceCents",e.target.value)} /></label>
       <label>Preço motorista (centavos)<input type="number" min="1" value={form.driverPriceCents} onChange={e=>change("driverPriceCents",e.target.value)} /></label>
      </div>
      <div className="freight-actions"><button className="button button-secondary" onClick={cancelEdit} disabled={saving===f.id}>Cancelar</button><button className="button button-primary" onClick={()=>void save(f.id)} disabled={saving===f.id}>{saving===f.id?"Salvando…":"Salvar alterações"}</button></div>
    </div>:<>
      <div className="freight-main"><label className="freight-checkbox"><input type="checkbox" checked={selected.has(f.id)} onChange={()=>toggleSelected(f.id)} disabled={loading||createSaving||!!saving||!!deleting||bulkDeleting}/></label><span className="transport-id">{f.id.slice(0,8).toUpperCase()}</span><div><strong>{f.originCity} <i>{f.originState}</i> <span className="route-arrow">→</span> {f.destinationCity} <i>{f.destinationState}</i></strong><small>{f.freightType} · {labels[f.status]||f.status}</small></div></div>
      <div className="freight-actions"><span className={`status-pill ${f.status}`}>{labels[f.status]||f.status}</span><button className="button button-secondary" onClick={()=>startEdit(f)} disabled={!!deleting||!!saving}>Alterar</button><button className="button button-danger" onClick={()=>void remove(f.id)} disabled={deleting===f.id||!!saving}>{deleting===f.id?"Excluindo…":"Excluir"}</button></div>
    </>}
   </article>)}</div>}
  </section>
 </main>;
}
