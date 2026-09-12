import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../common/database.module.js";
import { AuthGuard } from "../../common/auth.guard.js";
import { PermissionGuard } from "../../common/permission.guard.js";
import { ComplianceController } from "./compliance.controller.js";
import { ComplianceService } from "./compliance.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [ComplianceController],
  providers: [ComplianceService, AuthGuard, PermissionGuard],
})
export class ComplianceModule {}
