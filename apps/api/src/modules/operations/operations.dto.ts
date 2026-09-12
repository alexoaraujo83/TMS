import { Type } from "class-transformer";
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsPositive,
  Length,
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

export class CreateCarrierDto {
  @IsString() @Length(2, 200) legalName!: string;
  @IsOptional() @IsString() @Length(5, 30) documentNumber?: string;
  @IsOptional() @IsIn(statuses) status?: string;
}

export class CreateDriverDto {
  @IsOptional() @IsUUID() carrierId?: string;
  @IsString() @Length(2, 160) name!: string;
  @IsOptional() @IsString() @Length(5, 30) documentNumber?: string;
  @IsOptional() @IsString() @Length(8, 30) phone?: string;
  @IsOptional() @IsString() @Length(3, 30) rntrc?: string;
  @IsOptional() @IsIn(anttStatuses) anttStatus?: string;
  @IsOptional() @IsIn(statuses) status?: string;
}

export class CreateVehicleDto {
  @IsOptional() @IsUUID() driverId?: string;
  @IsString() @Length(7, 10) plate!: string;
  @IsString() @IsIn(vehicleTypes) vehicleType!: string;
  @IsString() @IsIn(bodyTypes) bodyType!: string;
  @Type(() => Number) @IsNumber() @IsPositive() capacityKg!: number;
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @IsPositive()
  freeMeters?: number;
  @IsOptional() @IsIn(vehicleStatuses) status?: string;
}
