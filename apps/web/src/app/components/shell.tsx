import Link from "next/link";
import type { ReactNode } from "react";

const nav = [["Visão geral","/app"],["Transportes","/app/transportes"],["Veículos","/app/veiculos"],["Motoristas","/app/motoristas"],["Clientes","/app/clientes"],["Rotas","/app/rotas"],["Documentos","/app/documentos"],["Financeiro","/app/financeiro"],["Relatórios","/app/relatorios"],["Auditoria","/app/auditoria"]];

export function AppShell({children}:{children:ReactNode}) {
  return <div className="app-shell"><aside className="sidebar"><Link href="/" className="brand"><span className="brand-mark">T</span><span>TMS</span></Link><div className="workspace"><span className="workspace-label">Workspace</span><strong>Operação principal</strong></div><nav className="side-nav">{nav.map(([label,href])=><Link key={href} href={href}>{label}</Link>)}</nav><div className="side-bottom"><Link href="/app/configuracoes">Configurações</Link><a href="/auth/logout">Sair</a></div></aside><div className="app-main"><header className="app-header"><div><span className="header-kicker">TMS / OPERAÇÃO</span><h1>Controle operacional</h1></div><div className="header-actions"><span className="live-badge">● Sistema operacional</span><a className="avatar" href="/auth/logout">A</a></div></header>{children}</div></div>;
}
