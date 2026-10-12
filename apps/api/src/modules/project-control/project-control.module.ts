import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../common/database.module.js";
import { AuthGuard } from "../../common/auth.guard.js";
import { PermissionGuard } from "../../common/permission.guard.js";
import { DiagnosticsController } from "./diagnostics.controller.js";
import { DiagnosticsService } from "./diagnostics.service.js";
import { ProjectControlController } from "./project-control.controller.js";
import { ProjectControlService } from "./project-control.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [ProjectControlController, DiagnosticsController],
  providers: [ProjectControlService, DiagnosticsService, AuthGuard, PermissionGuard],
})
export class ProjectControlModule {}
