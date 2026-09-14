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
      await this.pool.query("select 1");
    } catch {
      throw new ServiceUnavailableException("DATABASE_UNAVAILABLE");
    }

    return { status: "ready", service: "tms-api" };
  }
}
