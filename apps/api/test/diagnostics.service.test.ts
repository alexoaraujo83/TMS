import assert from "node:assert/strict";
import { InternalServerErrorException, ServiceUnavailableException } from "@nestjs/common";
import { describe, it } from "node:test";
import type { Pool } from "pg";
import { DiagnosticsService } from "../src/modules/project-control/diagnostics.service.ts";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LOOKUP = { kind: "requestId" as const, value: "req-123" };

function serviceWithConnectionError(code: string): DiagnosticsService {
  const pool = {
    async connect() {
      throw Object.assign(new Error("database operation failed"), { code });
    },
  } as unknown as Pool;
  return new DiagnosticsService(pool);
}

describe("DiagnosticsService error classification", () => {
  it("returns source unavailable for connection and database-capacity failures", async () => {
    for (const code of ["ECONNREFUSED", "ECONNRESET", "08006", "53300", "57P01"]) {
      const service = serviceWithConnectionError(code);
      await assert.rejects(
        service.search(TENANT_ID, LOOKUP, 25),
        (error: unknown) => error instanceof ServiceUnavailableException && error.getStatus() === 503,
        code,
      );
    }
  });

  it("keeps schema and permission faults as internal query failures, not false outages", async () => {
    for (const code of ["42P01", "42703", "42501"]) {
      const service = serviceWithConnectionError(code);
      await assert.rejects(
        service.search(TENANT_ID, LOOKUP, 25),
        (error: unknown) => error instanceof InternalServerErrorException && error.getStatus() === 500,
        code,
      );
    }
  });
});
