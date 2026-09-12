export type FreightStatus =
  | "draft"
  | "open"
  | "matching"
  | "negotiating"
  | "assigned"
  | "in_transit"
  | "delivered"
  | "cancelled";

export type FreightType = "dedicated" | "shared" | "complement" | "urgent";

export type VehicleType =
  | "fiorino"
  | "3_4"
  | "toco"
  | "truck"
  | "bitruck"
  | "carreta"
  | "ls"
  | "vanderleia"
  | "bitrem"
  | "rodotrem";

export type BodyType =
  | "bau"
  | "sider"
  | "grade_baixa"
  | "graneleiro"
  | "prancha"
  | "aberto"
  | "outro";

export interface Location {
  city: string;
  state: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

export interface Cargo {
  description: string;
  quantity: number;
  weightKg: number;
  volumeM3?: number;
  linearMeters?: number;
  valueCents?: bigint;
}

export interface VehicleRequirement {
  types?: readonly VehicleType[];
  bodies?: readonly BodyType[];
  minimumFreeMeters?: number;
  minimumCapacityKg?: number;
}

export interface Money {
  amountCents: bigint;
  currency: "BRL";
}

export interface Freight {
  id: string;
  tenantId: string;
  status: FreightStatus;
  type: FreightType;
  origin: Location;
  destination: Location;
  cargo: Cargo;
  vehicleRequirement: VehicleRequirement;
  driverPrice?: Money;
  customerPrice?: Money;
  collectionWindowStart?: Date;
  collectionWindowEnd?: Date;
  deliveryWindowStart?: Date;
  deliveryWindowEnd?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const FREIGHT_STATUS_TRANSITIONS: Readonly<
  Record<FreightStatus, readonly FreightStatus[]>
> = {
  draft: ["open", "cancelled"],
  open: ["matching", "cancelled"],
  matching: ["negotiating", "open", "cancelled"],
  negotiating: ["assigned", "matching", "cancelled"],
  assigned: ["in_transit", "cancelled"],
  in_transit: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function canTransitionFreightStatus(
  current: FreightStatus,
  next: FreightStatus,
): boolean {
  return FREIGHT_STATUS_TRANSITIONS[current].includes(next);
}

export function assertFreightCapacity(freight: Freight): void {
  if (freight.cargo.weightKg <= 0)
    throw new Error("Cargo weight must be positive");
  if (freight.cargo.quantity <= 0)
    throw new Error("Cargo quantity must be positive");
  if (freight.cargo.volumeM3 !== undefined && freight.cargo.volumeM3 < 0) {
    throw new Error("Cargo volume cannot be negative");
  }
  if (
    freight.vehicleRequirement.minimumCapacityKg !== undefined &&
    freight.vehicleRequirement.minimumCapacityKg < freight.cargo.weightKg
  ) {
    throw new Error("Vehicle capacity is insufficient for cargo weight");
  }
}
