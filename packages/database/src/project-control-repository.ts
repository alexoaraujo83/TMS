import type { Pool, PoolClient } from "pg";
import { withTenantContext } from "./tenant-transaction.js";

export type ProjectControlModuleStatus = "planned" | "in_progress" | "blocked" | "completed";
export type ProjectControlStageStatus = "pending" | "in_progress" | "blocked" | "completed";
export type ProjectControlEvidenceStatus = "pending" | "valid" | "invalid" | "expired";
export type ProjectControlBlockerStatus = "open" | "investigating" | "fixing" | "testing" | "resolved";

export interface ProjectControlModule {
  id: string;
  moduleKey: string;
  name: string;
  description: string | null;
  status: ProjectControlModuleStatus;
  sortOrder: number;
  stageCount: number;
  completedStages: number;
  inProgressStages: number;
  blockedStages: number;
  evidenceCount: number;
  validEvidenceCount: number;
  openBlockers: number;
  progressPercent: number;
}

export interface ProjectControlStage {
  id: string;
  moduleId: string;
  stageKey: string;
  name: string;
  phase: string;
  status: ProjectControlStageStatus;
  weight: number;
  evidenceRequired: boolean;
}

export interface ProjectControlEvidence {
  id: string;
  evidenceCode: string;
  title: string;
  kind: string;
  status: ProjectControlEvidenceStatus;
  source: string | null;
  reference: string | null;
  capturedAt: string | null;
}

export interface ProjectControlBlocker {
  id: string;
  blockerCode: string;
  title: string;
  severity: string;
  status: ProjectControlBlockerStatus;
  description: string | null;
  nextAction: string | null;
  moduleName: string | null;
}

export interface ProjectControlDashboard {
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
  modules: ProjectControlModule[];
  stages: ProjectControlStage[];
  recentEvidence: ProjectControlEvidence[];
  blockers: ProjectControlBlocker[];
}

export class ProjectControlRepository {
  constructor(private readonly pool: Pool) {}

  async dashboard(tenantId: string): Promise<ProjectControlDashboard> {
    return withTenantContext(this.pool, tenantId, async (client) => {
      const modulesResult = await client.query<{
        id: string;
        moduleKey: string;
        name: string;
        description: string | null;
        status: ProjectControlModuleStatus;
        sortOrder: number;
        stageCount: string;
        completedStages: string;
        inProgressStages: string;
        blockedStages: string;
        evidenceCount: string;
        validEvidenceCount: string;
        openBlockers: string;
        progressPercent: string;
      }>(`
        select
          m.id,
          m.module_key as "moduleKey",
          m.name,
          m.description,
          m.status,
          m.sort_order as "sortOrder",
          count(distinct s.id)::text as "stageCount",
          count(distinct s.id) filter (where s.status = 'completed')::text as "completedStages",
          count(distinct s.id) filter (where s.status = 'in_progress')::text as "inProgressStages",
          count(distinct s.id) filter (where s.status = 'blocked')::text as "blockedStages",
          count(distinct e.id)::text as "evidenceCount",
          count(distinct e.id) filter (where e.status = 'valid')::text as "validEvidenceCount",
          count(distinct b.id) filter (where b.status <> 'resolved')::text as "openBlockers",
          coalesce((
            select round(
              100.0 * sum(
                case
                  when ps.status = 'completed' then ps.weight
                  when ps.status = 'in_progress' then ps.weight * 0.5
                  else 0
                end
              ) / nullif(sum(ps.weight), 0)
            )::text
            from project_control_stages ps
            where ps.tenant_id = m.tenant_id and ps.module_id = m.id
          ), '0') as "progressPercent"
        from project_control_modules m
        left join project_control_stages s
          on s.tenant_id = m.tenant_id and s.module_id = m.id
        left join project_control_evidence e
          on e.tenant_id = m.tenant_id and e.module_id = m.id
        left join project_control_blockers b
          on b.tenant_id = m.tenant_id and b.module_id = m.id
        where m.tenant_id = $1
        group by m.id
        order by m.sort_order asc
      `, [tenantId]);

      const stagesResult = await client.query<{
        id: string;
        moduleId: string;
        stageKey: string;
        name: string;
        phase: string;
        status: ProjectControlStageStatus;
        weight: number;
        evidenceRequired: boolean;
      }>(`
        select id, module_id as "moduleId", stage_key as "stageKey",
               name, phase, status, weight, evidence_required as "evidenceRequired"
        from project_control_stages
        where tenant_id = $1
        order by module_id, case phase
          when 'discover' then 1
          when 'analyze' then 2
          when 'classify' then 3
          when 'correct' then 4
          when 'test' then 5
          when 'evidence' then 6
          when 'next' then 7
          else 99 end
      `, [tenantId]);

      const evidenceResult = await client.query<ProjectControlEvidence>(`
        select id,
               evidence_code as "evidenceCode",
               title,
               kind,
               status,
               source,
               reference,
               captured_at as "capturedAt"
        from project_control_evidence
        where tenant_id = $1
        order by captured_at desc nulls last, created_at desc
        limit 8
      `, [tenantId]);

      const blockersResult = await client.query<ProjectControlBlocker>(`
        select b.id,
               b.blocker_code as "blockerCode",
               b.title,
               b.severity,
               b.status,
               b.description,
               b.next_action as "nextAction",
               m.name as "moduleName"
        from project_control_blockers b
        left join project_control_modules m
          on m.tenant_id = b.tenant_id and m.id = b.module_id
        where b.tenant_id = $1 and b.status <> 'resolved'
        order by
          case b.severity when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,
          b.created_at asc
        limit 8
      `, [tenantId]);

      const modules = modulesResult.rows.map((row) => ({
        ...row,
        sortOrder: Number(row.sortOrder),
        stageCount: Number(row.stageCount),
        completedStages: Number(row.completedStages),
        inProgressStages: Number(row.inProgressStages),
        blockedStages: Number(row.blockedStages),
        evidenceCount: Number(row.evidenceCount),
        validEvidenceCount: Number(row.validEvidenceCount),
        openBlockers: Number(row.openBlockers),
        progressPercent: Number(row.progressPercent),
      }));

      const summaryStageCount = modules.reduce((n, m) => n + m.stageCount, 0);
      const completedStages = modules.reduce((n, m) => n + m.completedStages, 0);
      const evidenceCount = modules.reduce((n, m) => n + m.evidenceCount, 0);
      const validEvidenceCount = modules.reduce((n, m) => n + m.validEvidenceCount, 0);
      const moduleCount = modules.length;
      const progressPercent = moduleCount
        ? Math.round(modules.reduce((n, m) => n + m.progressPercent, 0) / moduleCount)
        : 0;

      const blockedModules = modules.filter((m) => m.status === "blocked").length;
      const completedModules = modules.filter((m) => m.status === "completed").length;
      const inProgressModules = modules.filter((m) => m.status === "in_progress").length;

      const currentGate =
        modules.find((m) => m.status === "blocked")?.name ??
        modules.find((m) => m.status === "in_progress")?.name ??
        "Baseline";

      return {
        project: {
          name: "TMS Project Control Center",
          repository: "alexoaraujo83/TMS",
          branch: "main",
          currentGate,
        },
        summary: {
          progressPercent,
          moduleCount,
          completedModules,
          inProgressModules,
          blockedModules,
          stageCount: summaryStageCount,
          completedStages,
          evidenceCount,
          validEvidenceCount,
          openBlockers: modules.reduce((n, m) => n + m.openBlockers, 0),
        },
        modules,
        stages: stagesResult.rows,
        recentEvidence: evidenceResult.rows,
        blockers: blockersResult.rows,
      };
    });
  }

  async assertReadable(tenantId: string): Promise<void> {
    await withTenantContext(this.pool, tenantId, async (client: PoolClient) => {
      await client.query("select 1 from project_control_modules limit 1");
    });
  }
}
