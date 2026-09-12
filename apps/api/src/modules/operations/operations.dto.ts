import { Transform, Type } from "class-transformer";
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  Matches,
} from "class-validator";

const statuses = ["active", "inactive", "blocked"] as const;
const anttStatuses = ["pending", "approved", "rejected", "expired"] as const;
const vehicleStatuses = [
  "available",
  "unavailable",
  "maintenance",
  "blocked",
] as const;
const vehicleTypes = [
  "fiorino",
  "3_4",
  "toco",
  "truck",
  "bitruck",
  "carreta",
  "ls",
  "vanderleia",
  "bitrem",
  "rodotrem",
] as const;
const bodyTypes = [
  "bau",
  "sider",
  "grade_baixa",
  "graneleiro",
  "prancha",
  "aberto",
  "outro",
] as const;

const normalizeText = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

const normalizePlate = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.replace(/[-\s]/g, "").toUpperCase() : value;

export class CreateCarrierDto {
  @Transform(normalizeText)
  @IsString()
  @Length(2, 200)
  legalName!: string;

  @Transform(normalizeText)
  @IsOptional()
  @IsString()
  @Length(5, 30)
  documentNumber?: string;

  @IsOptional()
  @IsIn(statuses)
  status?: string;
}

export class CreateDriverDto {
  @IsOptional()
  @IsUUID()
  carrierId?: string;

  @Transform(normalizeText)
  @IsString()
  @Length(2, 160)
  name!: string;

  @Transform(normalizeText)
  @IsOptional()
  @IsString()
  @Length(5, 30)
  documentNumber?: string;

  @Transform(normalizeText)
  @IsOptional()
  @IsString()
  @Length(8, 30)
  phone?: string;

  @Transform(normalizeText)
  @IsOptional()
  @IsString()
  @Length(3, 30)
  rntrc?: string;

  @IsOptional()
  @IsIn(anttStatuses)
  anttStatus?: string;

  @IsOptional()
  @IsIn(statuses)
  status?: string;
}

export class CreateVehicleDto {
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @Transform(normalizePlate)
  @IsString()
  @Length(7, 7)
  @Matches(/^[A-Z0-9]{7}$/)
  plate!: string;

  @IsString()
  @IsIn(vehicleTypes)
  vehicleType!: string;

  @IsString()
  @IsIn(bodyTypes)
  bodyType!: string;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  capacityKg!: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  freeMeters?: number;

  @IsOptional()
  @IsIn(vehicleStatuses)
  status?: string;
}
