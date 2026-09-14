import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../../common/auth.guard.js";
import { CurrentUser } from "../../common/current-user.decorator.js";
import { PermissionGuard } from "../../common/permission.guard.js";
import { RequirePermission } from "../../common/permission.decorator.js";
import type { RequestContext } from "../../common/request-context.js";
import { CreateFinancialEntryDto, ListFinancialEntriesQueryDto } from "./finance.dto.js";
import { FinanceService } from "./finance.service.js";

@Controller("finance")
@UseGuards(AuthGuard, PermissionGuard)
export class FinanceController {
  constructor(private readonly service: FinanceService) {}

  @Post("entries")
  @RequirePermission("finance:create")
  create(
    @CurrentUser() context: RequestContext,
    @Body() dto: CreateFinancialEntryDto,
  ) {
    return this.service.create(context, dto);
  }

  @Get("entries")
  @RequirePermission("finance:read")
  list(
    @CurrentUser() context: RequestContext,
    @Query() query: ListFinancialEntriesQueryDto,
  ) {
    return this.service.listByFreight(context, query.freightId);
  }

  @Patch("entries/:id/settle")
  @RequirePermission("finance:update")
  settle(
    @CurrentUser() context: RequestContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.service.settle(context, id);
  }
}
