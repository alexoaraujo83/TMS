import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../common/database.module.js";
import { AuthGuard } from "../../common/auth.guard.js";
import { PermissionGuard } from "../../common/permission.guard.js";
import { FinanceController } from "./finance.controller.js";
import { FinanceService } from "./finance.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [FinanceController],
  providers: [FinanceService, AuthGuard, PermissionGuard],
})
export class FinanceModule {}
