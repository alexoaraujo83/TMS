import { Inject, Injectable } from "@nestjs/common";
import { ProjectControlRepository } from "@tms/database";
import type { Pool } from "pg";
import { DATABASE_POOL } from "../../common/database.provider.js";
import type { RequestContext } from "../../common/request-context.js";

@Injectable()
export class ProjectControlService {
  private readonly repository: ProjectControlRepository;

  constructor(@Inject(DATABASE_POOL) pool: Pool) {
    this.repository = new ProjectControlRepository(pool);
  }

  dashboard(context: RequestContext) {
    return this.repository.dashboard(context.tenantId);
  }
}
