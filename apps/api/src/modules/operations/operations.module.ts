import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../common/database.module.js";
import { AuthGuard } from "../../common/auth.guard.js";
import { PermissionGuard } from "../../common/permission.guard.js";
import { OperationsController } from "./operations.controller.js";
import { OperationsService } from "./operations.service.js";
import { TripExecutionController } from "./trip-execution.controller.js";
import { TripExecutionService } from "./trip-execution.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [OperationsController, TripExecutionController],
  providers: [OperationsService, TripExecutionService, AuthGuard, PermissionGuard],
})
export class OperationsModule {}
