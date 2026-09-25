import Link from "next/link";

const highlights = [
  ["Operação", "Visibilidade de transportes, veículos, motoristas e rotas em um único fluxo."],
  ["Controle", "Dados tenant-scoped, autenticação Auth0 e trilhas de auditoria como parte da arquitetura."],
  ["Escala", "Next.js na web, API separada e PostgreSQL/Neon como persistência."],
];

export default function HomePage() {
  return (
    <main className="marketing-shell">
      <header className="marketing-nav">
        <Link href="/" className="brand"><span className="brand-mark">T</span> TMS</Link>
        <nav><Link href="#produto">Produto</Link><Link href="#modulos">Módulos</Link><Link href="/app">Acessar sistema</Link></nav>
      </header>
      <section className="hero">
        <div className="hero-copy"><p className="eyebrow">TRANSPORTATION MANAGEMENT SYSTEM</p><h1>Uma operação de transporte clara, conectada e auditável.</h1><p className="hero-lead">Centralize embarques, frota, motoristas, rotas, documentos, financeiro e indicadores em uma experiência operacional única.</p><div className="hero-actions"><Link className="button button-primary" href="/app">Abrir TMS</Link><Link className="button button-secondary" href="#produto">Conhecer módulos</Link></div></div>
        <div className="hero-panel"><div className="panel-top"><span>Visão operacional</span><span className="status-dot">● Online</span></div><div className="metric-grid"><div><strong>128</strong><span>Transportes ativos</span></div><div><strong>42</strong><span>Veículos em rota</span></div><div><strong>96%</strong><span>Entregas no prazo</span></div><div><strong>18</strong><span>Alertas abertos</span></div></div><div className="route-card"><span>Hoje</span><strong>Santos → Campinas</strong><small>Coleta 08:30 · Entrega 14:00 · Em trânsito</small></div></div>
      </section>
      <section id="produto" className="section"><div className="section-heading"><p className="eyebrow">BASE DO PRODUTO</p><h2>Feito para a operação real.</h2></div><div className="feature-grid">{highlights.map(([title,body],i)=><article className="feature-card" key={title}><span className="feature-index">0{i+1}</span><h3>{title}</h3><p>{body}</p></article>)}</div></section>
      <section id="modulos" className="section section-soft"><div className="section-heading"><p className="eyebrow">MÓDULOS</p><h2>O fluxo completo, por domínio.</h2></div><div className="module-grid">{["Transportes","Veículos","Motoristas","Clientes","Rotas","Documentos","Financeiro","Relatórios","Auditoria","Configurações"].map((item,i)=><Link href="/app" className="module-card" key={item}><span>0{i+1}</span><strong>{item}</strong><span>→</span></Link>)}</div></section>
      <footer className="marketing-footer"><span>© TMS</span><span>Arquitetura orientada a operação e evidências.</span></footer>
    </main>
  );
}
