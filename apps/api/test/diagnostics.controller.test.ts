import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { REQUIRED_PERMISSION } from "../src/common/permission.guard.ts";
import type { RequestContext } from "../src/common/request-context.ts";
import { DiagnosticsController } from "../src/modules/project-control/diagnostics.controller.ts";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VALID_UUID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function setup() {
  const calls: Array<{ tenantId: string; lookup: unknown; limit: number }> = [];
  const service = {
    async search(tenantId: string, lookup: unknown, limit: number) {
      calls.push({ tenantId, lookup, limit });
      return {
        status: "no_results" as const,
        sourceCoverage: { auditEvents: "queried" as const, outboxEvents: "not_applicable" as const, durableJobs: "not_applicable" as const },
        records: [],
      };
    },
  };
  return {
    controller: new DiagnosticsController(service as never),
    calls,
    context: { tenantId: TENANT_ID } as RequestContext,
  };
}

describe("DiagnosticsController", () => {
  it("requires ops:diagnostics on the protected route", () => {
    assert.equal(
      Reflect.getMetadata(REQUIRED_PERMISSION, DiagnosticsController.prototype.search),
      "ops:diagnostics",
    );
  });

  it("uses the authenticated tenant context and a bounded default limit", async () => {
    const { controller, calls, context } = setup();

    const result = await controller.search(context, "correlationId", " corr-123 ", undefined);

    assert.equal(result.status, "no_results");
    assert.equal(calls[0]?.tenantId, TENANT_ID);
    assert.deepEqual(calls[0]?.lookup, { kind: "correlationId", value: "corr-123" });
    assert.equal(calls[0]?.limit, 25);
  });

  it("normalizes all supported legacy snake_case kinds to the canonical camelCase contract", async () => {
    const { controller, calls, context } = setup();
    const aliases: Array<{ legacy: string; canonical: string; value: string }> = [
      { legacy: "request_id", canonical: "requestId", value: "req-123" },
      { legacy: "correlation_id", canonical: "correlationId", value: "corr-123" },
      { legacy: "outbox_event_id", canonical: "outboxEventId", value: VALID_UUID },
      { legacy: "outbox_aggregate_id", canonical: "outboxAggregateId", value: VALID_UUID },
      { legacy: "durable_job_id", canonical: "durableJobId", value: VALID_UUID },
      { legacy: "idempotency_key", canonical: "idempotencyKey", value: "key-1" },
      { legacy: "freight_id", canonical: "freightId", value: VALID_UUID },
    ];

    for (const alias of aliases) {
      await controller.search(context, alias.legacy, alias.value, undefined);
    }

    assert.deepEqual(
      calls.map(({ tenantId, lookup, limit }) => ({ tenantId, lookup, limit })),
      aliases.map(({ canonical, value }) => ({
        tenantId: TENANT_ID,
        lookup: { kind: canonical, value },
        limit: 25,
      })),
    );
  });

  it("rejects unsupported kinds, empty values, malformed UUIDs, and invalid limits", async () => {
    const { controller, calls, context } = setup();

    await assert.rejects(
      async () => controller.search(context, "notSupported", "key-1", undefined),
      (error: unknown) => error instanceof BadRequestException && error.getStatus() === 400,
    );
    await assert.rejects(
      async () => controller.search(context, "requestId", "  ", undefined),
      (error: unknown) => error instanceof BadRequestException && error.getStatus() === 400,
    );
    await assert.rejects(
      async () => controller.search(context, "outboxEventId", "not-a-uuid", undefined),
      (error: unknown) => error instanceof BadRequestException && error.getStatus() === 400,
    );
    await assert.rejects(
      async () => controller.search(context, "requestId", "req-123", "51"),
      (error: unknown) => error instanceof BadRequestException && error.getStatus() === 400,
    );
    assert.deepEqual(calls, []);
  });
});
