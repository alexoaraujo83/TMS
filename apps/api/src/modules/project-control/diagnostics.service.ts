import {
  Inject,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { DiagnosticsRepository } from "@tms/database";
import type { DiagnosticLookup, DiagnosticQueryResult } from "@tms/database";
import type { Pool } from "pg";
import { DATABASE_POOL } from "../../common/database.provider.js";

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function isUnavailableSource(error: unknown): boolean {
  const code = errorCode(error);
  if (!code) return false;
  return (
    code.startsWith("08") ||
    ["ECONNREFUSED", "ECONNRESET", "ENETUNREACH", "ENOTFOUND", "ETIMEDOUT",
      "57P01", "53300"].includes(code)
  );
}

@Injectable()
export class DiagnosticsService {
  private readonly repository: DiagnosticsRepository;

  constructor(@Inject(DATABASE_POOL) pool: Pool) {
    this.repository = new DiagnosticsRepository(pool);
  }

  async search(
    tenantId: string,
    lookup: DiagnosticLookup,
    limit: number,
  ): Promise<DiagnosticQueryResult> {
    try {
      return await this.repository.search(tenantId, lookup, limit);
    } catch (error) {
      if (isUnavailableSource(error)) {
        throw new ServiceUnavailableException("Diagnostic source unavailable");
      }
      throw new InternalServerErrorException("Diagnostic query failed");
    }
  }
}
