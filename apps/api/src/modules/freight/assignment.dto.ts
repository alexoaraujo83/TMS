import { IsUUID } from "class-validator";

export class AssignFreightDto {
  @IsUUID()
  driverId!: string;

  @IsUUID()
  vehicleId!: string;
}
