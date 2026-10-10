import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ProjectControlRepository } from "../src/project-control-repository.js";

const tenantId = "19d9a5a4-2d50-4b78-a910-1fdea96fd12e";

describe("ProjectControlRepository.dashboard", () => {
  it("scopes every dashboard query to the active tenant and reports totals beyond the preview limit", async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const client = {
      async query(sql: string, values: unknown[] = []) {
        calls.push({ sql, values });
        if (sql === "begin" || sql === "commit" || sql === "rollback" || sql.includes("set_config")) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes("from project_control_modules m")) {
          return {
            rows: [{
              id: "module-1",
              moduleKey: "governance",
              name: "Governança",
              description: null,
              status: "in_progress",
              sortOrder: "1",
              stageCount: "2",
              completedStages: "1",
              inProgressStages: "1",
              blockedStages: "0",
              evidenceCount: "10",
              validEvidenceCount: "8",
              openBlockers: "11",
              progressPercent: "75",
            }],
          };
        }
        if (sql.includes("from project_control_stages")) {
          return { rows: [{ id: "stage-1", moduleId: "module-1", stageKey: "G-01", name: "Tenant scope", phase: "test", status: "completed", weight: 1, evidenceRequired: true }] };
        }
        if (sql.includes("from project_control_evidence")) {
          return { rows: [] };
        }
        if (sql.includes("from project_control_blockers")) {
          return { rows: Array.from({ length: 8 }, (_, i) => ({ id: `blocker-${i}`, blockerCode: `B-${i}`, title: "Blocker", severity: "high", status: "open", description: null, nextAction: null, moduleName: "Governança" })) };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      },
      release() {},
    };
    const pool = { async connect() { return client; } } as never;
    const dashboard = await new ProjectControlRepository(pool).dashboard(tenantId);

    const scopedQueries = calls.filter(({ sql }) =>
      sql.includes("from project_control_modules m") ||
      sql.includes("from project_control_stages") ||
      sql.includes("from project_control_evidence") ||
      sql.includes("from project_control_blockers"),
    );
    assert.equal(scopedQueries.length, 4);
    for (const call of scopedQueries) {
      assert.deepEqual(call.values, [tenantId]);
      assert.match(call.sql, /tenant_id\s*=\s*\$1|tenant_id\s*=\s*m\.tenant_id/i);
    }

    assert.equal(dashboard.summary.openBlockers, 11);
    assert.equal(dashboard.blockers.length, 8, "blocker detail list remains a bounded preview");
    assert.equal(dashboard.modules[0]?.progressPercent, 75);
    assert.match(scopedQueries[0]?.sql ?? "", /select round\([\s\S]*from project_control_stages ps/i,
      "progress is aggregated independently of evidence/blocker joins to avoid fan-out inflation");
  });
});
