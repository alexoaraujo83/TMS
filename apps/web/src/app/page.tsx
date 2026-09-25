import Link from "next/link";

const features = [
  ["01", "Operação", "Transporte, veículos, motoristas e rotas em uma única visão."],
  ["02", "Controle", "Documentos, clientes e financeiro conectados ao fluxo operacional."],
  ["03", "Governança", "Relatórios, auditoria e configurações com rastreabilidade."],
];

export default function LandingPage() {
  return (
    <main className="landing">
      <header className="landing-nav">
        <Link href="/" className="landing-brand"><span className="brand-mark">T</span><span><strong>TMS</strong><small>Transportation Management</small></span></Link>
        <nav className="landing-links"><a href="#produto">Produto</a><a href="#operacao">Operação</a><a href="#governanca">Governança</a></nav>
        <div className="landing-actions"><Link href="/auth/login" className="button button-ghost">Entrar</Link><Link href="/auth/login?screen_hint=signup" className="button button-primary">Começar agora</Link></div>
      </header>

      <section className="landing-hero" id="produto">
        <div className="landing-copy">
          <span className="eyebrow">TMS PLATFORM · OPERAÇÃO LOGÍSTICA</span>
          <h1>Uma operação de transporte mais <em>clara, conectada e controlada.</em></h1>
          <p>Centralize a gestão dos seus transportes em um ambiente operacional desenhado para acompanhar cada etapa do frete.</p>
          <div className="landing-cta"><Link href="/app" className="button button-primary button-large">Conhecer o dashboard →</Link><Link href="/auth/login" className="button button-ghost button-large">Entrar na plataforma</Link></div>
          <div className="landing-proof"><span>✓ Visão operacional</span><span>✓ Dados por tenant</span><span>✓ Auditoria integrada</span></div>
        </div>
        <div className="landing-preview" aria-label="Prévia do dashboard">
          <div className="preview-top"><span className="preview-dot"/><span className="preview-dot"/><span className="preview-dot"/><small>tms / operação</small></div>
          <div className="preview-body"><div className="preview-sidebar"><b>TMS</b><span className="active">⌂ Dashboard</span><span>▣ Transportes</span><span>◇ Veículos</span><span>◌ Motoristas</span><span>◫ Financeiro</span></div><div className="preview-main"><small>VISÃO GERAL</small><h3>Bom dia, operação.</h3><div className="preview-cards"><b><small>Transportes</small>128</b><b><small>Em trânsito</small>42</b><b><small>Entregues</small>76</b></div><div className="preview-chart"><i/><i/><i/><i/><i/><i/><i/></div></div></div>
        </div>
      </section>

      <section className="feature-strip" id="operacao">{features.map(([n,t,d]) => <article key={n}><span>{n}</span><h2>{t}</h2><p>{d}</p></article>)}</section>
      <section className="landing-bottom" id="governanca"><span className="eyebrow">DO OPERACIONAL AO ESTRATÉGICO</span><h2>Uma base única para crescer sem perder o controle.</h2><p>Arquitetura preparada para autenticação, multi-tenant, rastreabilidade e evolução contínua do produto.</p><Link href="/app" className="text-link">Abrir ambiente operacional →</Link></section>
      <footer className="landing-footer"><span>TMS Platform</span><span>Gestão de transportes · 2026</span></footer>
    </main>
  );
}
