import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../common/auth.guard.js";
import { PermissionGuard } from "../../common/permission.guard.js";
import { RequirePermission } from "../../common/permission.decorator.js";
import { BackupService } from "./backup.service.js";

@Controller("backups")
@UseGuards(AuthGuard, PermissionGuard)
export class BackupController {
  constructor(private readonly service: BackupService) {}

  @Get("manifests")
  @RequirePermission("iam:manage")
  listManifests() {
    return this.service.listManifests();
  }
}
