import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
} from "class-validator";
import type {
  BodyType,
  FreightStatus,
  FreightType,
  VehicleType,
} from "@tms/freight";

const freightTypes: FreightType[] = [
  "dedicated",
  "shared",
  "complement",
  "urgent",
];
const freightStatuses: FreightStatus[] = [
  "draft",
  "open",
  "matching",
  "negotiating",
  "assigned",
  "in_transit",
  "delivered",
  "cancelled",
];
const vehicleTypes: VehicleType[] = [
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
];
const bodyTypes: BodyType[] = [
  "bau",
  "sider",
  "grade_baixa",
  "graneleiro",
  "prancha",
  "aberto",
  "outro",
];

export class CreateFreightDto {
  @IsIn(freightTypes) freightType!: FreightType;
  @IsString() @Length(2, 120) originCity!: string;
  @IsString() @Length(2, 2) originState!: string;
  @IsString() @Length(2, 120) destinationCity!: string;
  @IsString() @Length(2, 2) destinationState!: string;
  @IsString() @Length(1, 500) cargoDescription!: string;
  @Type(() => Number) @IsInt() @IsPositive() quantity!: number;
  @Type(() => Number) @IsNumber() @IsPositive() weightKg!: number;
  @Type(() => Number) @IsOptional() @IsNumber() @IsPositive() volumeM3?: number;
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @IsPositive()
  linearMeters?: number;
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @IsPositive()
  customerPriceCents?: number;
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @IsPositive()
  driverPriceCents?: number;
  @IsOptional()
  @IsArray()
  @IsIn(vehicleTypes, { each: true })
  vehicleTypes?: VehicleType[];
  @IsOptional()
  @IsArray()
  @IsIn(bodyTypes, { each: true })
  bodyTypes?: BodyType[];
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @IsPositive()
  minimumFreeMeters?: number;
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @IsPositive()
  minimumCapacityKg?: number;
}


export class UpdateFreightDto {
  @IsOptional() @IsIn(freightTypes) freightType?: FreightType;
  @IsOptional() @IsString() @Length(2, 120) originCity?: string;
  @IsOptional() @IsString() @Length(2, 2) originState?: string;
  @IsOptional() @IsString() @Length(2, 120) destinationCity?: string;
  @IsOptional() @IsString() @Length(2, 2) destinationState?: string;
  @IsOptional() @IsString() @Length(1, 500) cargoDescription?: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsPositive() quantity?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() weightKg?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() volumeM3?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() linearMeters?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @IsPositive() customerPriceCents?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @IsPositive() driverPriceCents?: number | null;
  @IsOptional() @IsArray() @IsIn(vehicleTypes, { each: true }) vehicleTypes?: VehicleType[];
  @IsOptional() @IsArray() @IsIn(bodyTypes, { each: true }) bodyTypes?: BodyType[];
  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() minimumFreeMeters?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() minimumCapacityKg?: number | null;
}

export class UpdateFreightStatusDto {
  @IsIn(freightStatuses)
  status!: FreightStatus;
}
