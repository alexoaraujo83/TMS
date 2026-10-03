import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../common/auth.guard.js";
import { CurrentUser } from "../../common/current-user.decorator.js";
import { PermissionGuard } from "../../common/permission.guard.js";
import { RequirePermission } from "../../common/permission.decorator.js";
import type { RequestContext } from "../../common/request-context.js";
import { ProjectControlService } from "./project-control.service.js";

@Controller("project-control")
@UseGuards(AuthGuard, PermissionGuard)
export class ProjectControlController {
  constructor(private readonly service: ProjectControlService) {}

  @Get("dashboard")
  @RequirePermission("project:read")
  dashboard(@CurrentUser() context: RequestContext) {
    return this.service.dashboard(context);
  }
}
