import {
  type BodyType,
  type Freight,
  type FreightStatus,
  type VehicleType,
} from "@tms/freight";

export interface MatchCandidate {
  driverId: string;
  tenantId: string;
  vehicleType: VehicleType;
  bodyType: BodyType;
  capacityKg: number;
  available: boolean;
  vehicleId?: string;
  driverName?: string;
  plate?: string;
  freeMeters?: number;
  distanceKm?: number;
  routeCompatibility?: number;
  historicalReliability?: number;
  offeredPriceCents?: bigint;
}

export interface MatchBreakdown {
  total: number;
  distance: number;
  vehicleCompatibility: number;
  capacity: number;
  availability: number;
  route: number;
  price: number;
  reliability: number;
}

export interface MatchResult extends MatchBreakdown {
  candidate: MatchCandidate;
  reasons: readonly string[];
}

const MATCHING_ELIGIBLE_STATUSES: ReadonlySet<FreightStatus> = new Set([
  "matching",
]);

const clamp = (value: number): number => Math.max(0, Math.min(100, value));

export function isFreightEligibleForMatching(status: FreightStatus): boolean {
  return MATCHING_ELIGIBLE_STATUSES.has(status);
}

function assertFreightEligibleForMatching(freight: Freight): void {
  if (!isFreightEligibleForMatching(freight.status)) {
    throw new Error(
      `Freight status ${freight.status} is not eligible for matching`,
    );
  }
}

function vehicleScore(freight: Freight, candidate: MatchCandidate): number {
  const types = freight.vehicleRequirement.types;
  const bodies = freight.vehicleRequirement.bodies;
  const typeOk = !types?.length || types.includes(candidate.vehicleType);
  const bodyOk = !bodies?.length || bodies.includes(candidate.bodyType);
  if (typeOk && bodyOk) return 100;
  if (typeOk || bodyOk) return 50;
  return 0;
}

function capacityScore(freight: Freight, candidate: MatchCandidate): number {
  const required = freight.cargo.weightKg;
  if (candidate.capacityKg < required) return 0;
  const excess = candidate.capacityKg - required;
  return clamp(100 - (excess / Math.max(required, 1)) * 25);
}

function distanceScore(distanceKm?: number): number {
  if (distanceKm === undefined) return 50;
  return clamp(100 - distanceKm / 2);
}

export function scoreCandidate(
  freight: Freight,
  candidate: MatchCandidate,
): MatchResult {
  assertFreightEligibleForMatching(freight);

  if (freight.tenantId !== candidate.tenantId) {
    throw new Error("Cross-tenant matching is forbidden");
  }

  const distance = distanceScore(candidate.distanceKm);
  const vehicleCompatibility = vehicleScore(freight, candidate);
  const capacity = capacityScore(freight, candidate);
  const availability = candidate.available ? 100 : 0;
  const route =
    candidate.routeCompatibility === undefined
      ? 50
      : clamp(candidate.routeCompatibility);
  const reliability = clamp(candidate.historicalReliability ?? 50);

  const price =
    candidate.offeredPriceCents === undefined ||
    freight.driverPrice === undefined
      ? 50
      : clamp(
          100 -
            Math.abs(
              Number(
                candidate.offeredPriceCents - freight.driverPrice.amountCents,
              ),
            ) /
              10000,
        );

  const total =
    distance * 0.2 +
    vehicleCompatibility * 0.2 +
    capacity * 0.15 +
    availability * 0.15 +
    route * 0.15 +
    price * 0.1 +
    reliability * 0.05;

  const reasons: string[] = [];
  if (vehicleCompatibility === 100) reasons.push("vehicle-compatible");
  if (capacity === 100) reasons.push("capacity-suitable");
  if (availability === 100) reasons.push("available");
  if (route >= 80 && candidate.routeCompatibility !== undefined)
    reasons.push("route-compatible");
  if (reliability >= 80) reasons.push("high-reliability");

  return {
    candidate,
    total: Math.round(total * 100) / 100,
    distance,
    vehicleCompatibility,
    capacity,
    availability,
    route,
    price,
    reliability,
    reasons,
  };
}

export function rankCandidates(
  freight: Freight,
  candidates: readonly MatchCandidate[],
): MatchResult[] {
  assertFreightEligibleForMatching(freight);

  return candidates
    .map((candidate) => scoreCandidate(freight, candidate))
    .sort(
      (a, b) =>
        b.total - a.total ||
        a.candidate.driverId.localeCompare(b.candidate.driverId),
    );
}
