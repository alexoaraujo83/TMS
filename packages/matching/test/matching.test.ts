import assert from "node:assert/strict";
import test from "node:test";
import type { Freight } from "@tms/freight";
import {
  isFreightEligibleForMatching,
  rankCandidates,
  scoreCandidate,
  type MatchCandidate,
} from "../src/index.ts";

const freight: Freight = {
  id: "00000000-0000-0000-0000-000000000001",
  tenantId: "00000000-0000-0000-0000-000000000010",
  status: "matching",
  type: "shared",
  origin: { city: "Betim", state: "MG", country: "BR" },
  destination: { city: "Divinopolis", state: "MG", country: "BR" },
  cargo: { description: "Modules", quantity: 1, weightKg: 2200 },
  vehicleRequirement: {
    types: ["truck"],
    bodies: ["aberto"],
    minimumCapacityKg: 2200,
  },
  driverPrice: { amountCents: 300000, currency: "BRL" },
  createdAt: new Date("2026-09-01T00:00:00Z"),
  updatedAt: new Date("2026-09-01T00:00:00Z"),
};

const candidate = (
  overrides: Partial<MatchCandidate> = {},
): MatchCandidate => ({
  driverId: "00000000-0000-0000-0000-000000000020",
  tenantId: freight.tenantId,
  vehicleType: "truck",
  bodyType: "aberto",
  capacityKg: 2500,
  available: true,
  distanceKm: 20,
  routeCompatibility: 90,
  ...overrides,
});

test("recognizes only matching-status freights as eligible", () => {
  assert.equal(isFreightEligibleForMatching("matching"), true);
  assert.equal(isFreightEligibleForMatching("open"), false);
  assert.equal(isFreightEligibleForMatching("negotiating"), false);
  assert.equal(isFreightEligibleForMatching("assigned"), false);
});

test("rejects freight that is not in matching status", () => {
  assert.throws(
    () => scoreCandidate({ ...freight, status: "open" }, candidate()),
    /Freight status open is not eligible for matching/,
  );
});

test("scores compatible candidates and exposes matching reasons", () => {
  const result = scoreCandidate(freight, candidate());

  assert.equal(result.vehicleCompatibility, 100);
  assert.ok(Math.abs(result.capacity - 96.5909) < 0.001);
  assert.equal(result.availability, 100);
  assert.equal(result.route, 90);
  assert.ok(result.total > 88);
  assert.deepEqual(result.reasons, [
    "vehicle-compatible",
    "available",
    "route-compatible",
  ]);
});

test("uses neutral scores when routing data is unavailable", () => {
  const result = scoreCandidate(
    freight,
    candidate({ distanceKm: undefined, routeCompatibility: undefined }),
  );

  assert.equal(result.distance, 50);
  assert.equal(result.route, 50);
  assert.ok(!result.reasons.includes("route-compatible"));
});

test("ranks stronger candidates before weaker candidates", () => {
  const results = rankCandidates(freight, [
    candidate({
      driverId: "00000000-0000-0000-0000-000000000022",
      distanceKm: 250,
      routeCompatibility: 40,
    }),
    candidate({
      driverId: "00000000-0000-0000-0000-000000000021",
      distanceKm: 10,
      routeCompatibility: 95,
    }),
  ]);

  assert.equal(
    results[0]?.candidate.driverId,
    "00000000-0000-0000-0000-000000000021",
  );
  assert.ok((results[0]?.total ?? 0) > (results[1]?.total ?? 0));
});

test("uses driver id as a deterministic tie-breaker", () => {
  const results = rankCandidates(freight, [
    candidate({
      driverId: "00000000-0000-0000-0000-000000000022",
    }),
    candidate({
      driverId: "00000000-0000-0000-0000-000000000021",
    }),
  ]);

  assert.deepEqual(
    results.map((result) => result.candidate.driverId),
    [
      "00000000-0000-0000-0000-000000000021",
      "00000000-0000-0000-0000-000000000022",
    ],
  );
});

test("rejects cross-tenant candidates", () => {
  assert.throws(
    () =>
      scoreCandidate(
        freight,
        candidate({
          tenantId: "00000000-0000-0000-0000-000000000099",
        }),
      ),
    /Cross-tenant matching is forbidden/,
  );
});
