import { IsIn, IsUUID } from "class-validator";

const tripStatuses = [
  "planned",
  "in_transit",
  "delivered",
  "cancelled",
] as const;

export class CreateTripDto {
  @IsUUID()
  freightId!: string;

  @IsUUID()
  assignmentId!: string;
}

export class TransitionTripDto {
  @IsIn(tripStatuses)
  expectedStatus!: string;

  @IsIn(tripStatuses)
  nextStatus!: string;
}
