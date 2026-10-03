import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../common/database.module.js";
import { AuthGuard } from "../../common/auth.guard.js";
import { PermissionGuard } from "../../common/permission.guard.js";
import { ProjectControlController } from "./project-control.controller.js";
import { ProjectControlService } from "./project-control.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [ProjectControlController],
  providers: [ProjectControlService, AuthGuard, PermissionGuard],
})
export class ProjectControlModule {}
