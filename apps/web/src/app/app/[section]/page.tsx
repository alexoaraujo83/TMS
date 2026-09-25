import Link from "next/link";

const modules:Record<string,{title:string;eyebrow:string;description:string;items:string[]}> = {
 transportes:{title:"Transportes",eyebrow:"OPERAÇÃO",description:"Crie, acompanhe e atualize seus transportes.",items:["Novo transporte","Em aberto","Em trânsito","Entregues"]},
 veiculos:{title:"Veículos",eyebrow:"FROTA",description:"Controle veículos, disponibilidade e documentação.",items:["Frota ativa","Disponíveis","Em manutenção","Documentação"]},
 motoristas:{title:"Motoristas",eyebrow:"PESSOAS",description:"Gerencie motoristas e sua disponibilidade operacional.",items:["Motoristas ativos","Disponibilidade","Documentos","Histórico"]},
 clientes:{title:"Clientes",eyebrow:"RELACIONAMENTO",description:"Centralize embarcadores, contatos e operações.",items:["Clientes ativos","Contatos","Contratos","Histórico"]},
 rotas:{title:"Rotas",eyebrow:"PLANEJAMENTO",description:"Organize rotas, origens, destinos e planejamento.",items:["Rotas salvas","Origens","Destinos","Planejamento"]},
 documentos:{title:"Documentos",eyebrow:"COMPLIANCE",description:"Tenha documentos operacionais organizados e rastreáveis.",items:["Documentos recentes","Pendências","Validades","Arquivo"]},
 financeiro:{title:"Financeiro",eyebrow:"GESTÃO",description:"Acompanhe valores, pagamentos e indicadores financeiros.",items:["Contas a receber","Contas a pagar","Fluxo de caixa","Conciliação"]},
 relatorios:{title:"Relatórios",eyebrow:"ANÁLISE",description:"Transforme a operação em indicadores para decisão.",items:["Operação","Frota","Financeiro","Performance"]},
 auditoria:{title:"Auditoria",eyebrow:"GOVERNANÇA",description:"Rastreie ações e eventos relevantes da plataforma.",items:["Eventos","Usuários","Alterações","Logs"]},
 configuracoes:{title:"Configurações",eyebrow:"PLATAFORMA",description:"Configure sua operação, usuários e preferências.",items:["Organização","Usuários e acessos","Preferências","Integrações"]},
};
export default async function ModulePage({params}:{params:Promise<{section:string}>}){const {section}=await params;const m=modules[section]??{title:"Módulo",eyebrow:"TMS",description:"Área operacional do TMS.",items:[]};return <main className="module-page"><Link href="/app" className="back-link">← Voltar ao dashboard</Link><span className="eyebrow">{m.eyebrow}</span><h1>{m.title}</h1><p>{m.description}</p><div className="module-grid">{m.items.map((x,i)=><article key={x}><span>0{i+1}</span><h2>{x}</h2><small>Área preparada para a próxima etapa operacional.</small></article>)}</div></main>}
