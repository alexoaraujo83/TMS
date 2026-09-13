import {
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { occurrenceSeverities, occurrenceTypes } from "@tms/database";

export class CreateOccurrenceDto {
  @IsIn(occurrenceTypes)
  type!: (typeof occurrenceTypes)[number];

  @IsIn(occurrenceSeverities)
  severity!: (typeof occurrenceSeverities)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description!: string;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreatePodDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  recipientName!: string;

  @IsISO8601()
  receivedAt!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  documentRef!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
