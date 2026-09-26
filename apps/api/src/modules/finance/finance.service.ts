import { Inject, Injectable } from "@nestjs/common";
import {
  FinanceRepository,
  type CreateFinancialEntryInput,
} from "@tms/database";
import type { Pool } from "pg";
import { DATABASE_POOL } from "../../common/database.provider.js";
import type { RequestContext } from "../../common/request-context.js";
import type { CreateFinancialEntryDto } from "./finance.dto.js";

@Injectable()
export class FinanceService {
  private readonly repository: FinanceRepository;

  constructor(@Inject(DATABASE_POOL) pool: Pool) {
    this.repository = new FinanceRepository(pool);
  }

  create(context: RequestContext, dto: CreateFinancialEntryDto) {
    const input: CreateFinancialEntryInput = {
      ...dto,
      tenantId: context.tenantId,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
    };
    return this.repository.create(input, {
      actorUserId: context.userId,
      action: "finance.entry_created",
      entityType: "financial_entry",
      requestId: context.requestId,
    });
  }

  listByFreight(context: RequestContext, freightId: string) {
    return this.repository.listByFreight(context.tenantId, freightId);
  }

  settle(context: RequestContext, id: string) {
    return this.repository.settle(context.tenantId, id, {
      actorUserId: context.userId,
      action: "finance.entry_settled",
      entityType: "financial_entry",
      requestId: context.requestId,
    });
  }
}
