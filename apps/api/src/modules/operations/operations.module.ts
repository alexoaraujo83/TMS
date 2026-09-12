import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../common/database.module.js";
import { AuthGuard } from "../../common/auth.guard.js";
import { PermissionGuard } from "../../common/permission.guard.js";
import { OperationsController } from "./operations.controller.js";
import { OperationsService } from "./operations.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [OperationsController],
  providers: [OperationsService, AuthGuard, PermissionGuard],
})
export class OperationsModule {}
