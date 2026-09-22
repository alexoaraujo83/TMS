"use client";

import { useEffect, useState } from "react";
import { fetchApiHealth, type ApiHealth } from "../lib/api";

type Session = { authenticated: boolean; user?: { name?: string; email?: string } | null };
type Freight = { id: string; status: string; originCity: string; originState: string; destinationCity: string; destinationState: string };

const initial = { freightType:"dedicated", originCity:"Santos", originState:"SP", destinationCity:"Campinas", destinationState:"SP", cargoDescription:"Carga de teste TMS", quantity:"1", weightKg:"100" };

export default function HomePage() {
  const [health,setHealth]=useState<ApiHealth|null>(null);
  const [session,setSession]=useState<Session|null>(null);
  const [freights,setFreights]=useState<Freight[]>([]);
  const [form,setForm]=useState(initial);
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [updating,setUpdating]=useState<string|null>(null);

  async function loadFreights() {
    const r=await fetch("/api/tms/freights",{cache:"no-store"});
    if(!r.ok) throw new Error((await r.text())||`GET /freights: HTTP ${r.status}`);
    setFreights(await r.json());
  }

  async function createFreight(e:React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const r=await fetch("/api/tms/freights",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...form,quantity:Number(form.quantity),weightKg:Number(form.weightKg)})});
      if(!r.ok) throw new Error((await r.text())||`POST /freights: HTTP ${r.status}`);
      await loadFreights();
    } catch(e) { setError(e instanceof Error?e.message:"Freight creation failed"); }
    finally { setBusy(false); }
  }

  async function openFreight(id:string) {
    setUpdating(id); setError(null);
    try {
      const r=await fetch(`/api/tms/freights/${encodeURIComponent(id)}/status`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({status:"open"})});
      if(!r.ok) throw new Error((await r.text())||`PATCH /freights/:id/status: HTTP ${r.status}`);
      await loadFreights();
    } catch(e) { setError(e instanceof Error?e.message:"Status update failed"); }
    finally { setUpdating(null); }
  }

  useEffect(()=>{ void Promise.all([
    fetchApiHealth().then(setHealth).catch(()=>setHealth(null)),
    fetch("/auth/profile",{cache:"no-store"}).then(async r=>setSession(r.ok?{authenticated:true,user:await r.json()}:{authenticated:false})).catch(()=>setSession({authenticated:false}))
  ]); },[]);

  useEffect(()=>{ if(session?.authenticated) void loadFreights().catch(e=>setError(e instanceof Error?e.message:"Freight list failed")); },[session?.authenticated]);

  return <main>
    <h1>TMS</h1>
    <p>Frontend foundation with Auth0 session and live freight API integration.</p>
    {error && <p role="alert">{error}</p>}
    <section>
      <h2>Authentication</h2>
      {!session && <p>Checking session…</p>}
      {session?.authenticated ? <><p>Signed in as {session.user?.name ?? session.user?.email ?? "authenticated user"}.</p><a href="/auth/logout">Log out</a></> : session ? <><a href="/auth/login">Log in with Auth0</a><br/><a href="/auth/login?screen_hint=signup">Sign up</a></> : null}
    </section>
    {session?.authenticated && <section>
      <h2>Freight</h2>
      <form onSubmit={createFreight}>
        <label>Type <select value={form.freightType} onChange={e=>setForm({...form,freightType:e.target.value})}><option value="dedicated">dedicated</option><option value="shared">shared</option><option value="complement">complement</option><option value="urgent">urgent</option></select></label>{" "}
        <label>Origin <input value={form.originCity} onChange={e=>setForm({...form,originCity:e.target.value})}/></label>{" "}
        <label>UF <input value={form.originState} maxLength={2} onChange={e=>setForm({...form,originState:e.target.value})}/></label>{" "}
        <label>Destination <input value={form.destinationCity} onChange={e=>setForm({...form,destinationCity:e.target.value})}/></label>{" "}
        <label>UF <input value={form.destinationState} maxLength={2} onChange={e=>setForm({...form,destinationState:e.target.value})}/></label>{" "}
        <label>Cargo <input value={form.cargoDescription} onChange={e=>setForm({...form,cargoDescription:e.target.value})}/></label>{" "}
        <label>Qty <input type="number" min="1" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})}/></label>{" "}
        <label>kg <input type="number" min="1" value={form.weightKg} onChange={e=>setForm({...form,weightKg:e.target.value})}/></label>{" "}
        <button disabled={busy}>{busy?"Creating…":"Create freight"}</button>
      </form>
      <h3>Current freights</h3>
      <ul>{freights.map(f=><li key={f.id}>{f.originCity}/{f.originState} → {f.destinationCity}/{f.destinationState} — {f.status} {f.status==="draft" && <button type="button" disabled={updating===f.id} onClick={()=>void openFreight(f.id)}>{updating===f.id?"Updating…":"Open freight"}</button>}</li>)}</ul>
    </section>}
    <section><h2>API status</h2><p>{health?health.service+": "+health.status:"Checking API…"}</p></section>
  </main>;
}