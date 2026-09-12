import { SetMetadata } from "@nestjs/common";
import { REQUIRED_PERMISSION } from "./permission.guard.js";

export const RequirePermission = (
  permission: string,
): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_PERMISSION, permission);
