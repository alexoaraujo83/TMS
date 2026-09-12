import { IsIn, IsOptional, IsString, IsUUID } from "class-validator";

const complianceStatuses = ["pending", "approved", "rejected", "expired"] as const;
const grStatuses = [
  "pending",
  "submitted",
  "approved",
  "rejected",
  "expired",
  "cancelled",
] as const;

export class CreateComplianceCheckDto {
  @IsUUID()
  freightId!: string;

  @IsOptional()
  @IsUUID()
  assignmentId?: string;

  @IsString()
  checkType!: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  externalReference?: string;
}

export class TransitionComplianceDto {
  @IsIn(complianceStatuses)
  expectedStatus!: string;

  @IsIn(complianceStatuses)
  nextStatus!: string;
}

export class CreateGrRequestDto {
  @IsUUID()
  freightId!: string;

  @IsOptional()
  @IsUUID()
  assignmentId?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  protocol?: string;

  @IsOptional()
  @IsString()
  externalReference?: string;
}

export class TransitionGrDto {
  @IsIn(grStatuses)
  expectedStatus!: string;

  @IsIn(grStatuses)
  nextStatus!: string;
}
