import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, Length, MaxLength } from 'class-validator';
import type { BodyType, FreightType, VehicleType } from '@tms/freight';

const freightTypes: FreightType[] = ['dedicated', 'shared', 'complement', 'urgent'];
const vehicleTypes: VehicleType[] = ['fiorino', '3_4', 'toco', 'truck', 'bitruck', 'carreta', 'ls', 'vanderleia', 'bitrem', 'rodotrem'];
const bodyTypes: BodyType[] = ['bau', 'sider', 'grade_baixa', 'graneleiro', 'prancha', 'aberto', 'outro'];

export class CreateFreightDto {
  @IsIn(freightTypes)
  freightType!: FreightType;

  @IsString()
  @Length(2, 120)
  originCity!: string;

  @IsString()
  @Length(2, 2)
  originState!: string;

  @IsString()
  @Length(2, 120)
  destinationCity!: string;

  @IsString()
  @Length(2, 2)
  destinationState!: string;

  @IsString()
  @Length(1, 500)
  cargoDescription!: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  weightKg!: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @IsPositive()
  volumeM3?: number;

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
