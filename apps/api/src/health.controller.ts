import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Pool } from "pg";
import { DATABASE_POOL } from "./common/database.provider.js";

@Controller()
export class HealthController {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  @Get("/health")
  health() {
    return { status: "ok", service: "tms-api" };
  }

  @Get("/ready")
  async ready() {
    try {
      const result = await this.pool.query<{ current_user: string }>(
        "select current_user",
      );

      if (result.rows[0]?.current_user !== "tms_app") {
        throw new Error("DATABASE_RUNTIME_ROLE_INVALID");
      }
    } catch {
      throw new ServiceUnavailableException("DATABASE_UNAVAILABLE");
    }

    return { status: "ready", service: "tms-api" };
  }
}
