import {
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from "class-validator";
import type {
  CreateFinancialEntryInput,
  FinancialEntryType,
  FinancialDirection,
} from "@tms/database";

export class CreateFinancialEntryDto
  implements Omit<CreateFinancialEntryInput, "tenantId" | "dueAt">
{
  @IsUUID()
  freightId!: string;

  @IsOptional()
  @IsUUID()
  assignmentId?: string;

  @IsOptional()
  @IsUUID()
  tripId?: string;

  @IsIn(["receivable", "payable"])
  direction!: FinancialDirection;

  @IsIn(["freight", "carrier", "driver", "fee", "commission", "adjustment"])
  entryType!: FinancialEntryType;

  @IsString()
  description!: string;

  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ListFinancialEntriesQueryDto {
  @IsUUID()
  freightId!: string;
}
