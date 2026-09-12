import { strict as assert } from "node:assert";
import test from "node:test";
import { rankCandidates, scoreCandidate } from "../src/index.ts";
import type { Freight } from "@tms/freight";

const baseFreight: Freight = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  tenantId: "11111111-1111-1111-1111-111111111111",
  status: "matching",
  type: "dedicated",
  origin: { city: "Betim", state: "MG", country: "BR" },
  destination: { city: "Divinópolis", state: "MG", country: "BR" },
  cargo: { description: "Carga", quantity: 1, weightKg: 1000 },
  vehicleRequirement: {
    types: ["truck"],
    bodies: ["bau"],
    minimumCapacityKg: 1000,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const candidate = {
  driverId: "22222222-2222-2222-2222-222222222222",
  tenantId: baseFreight.tenantId,
  vehicleType: "truck" as const,
  bodyType: "bau" as const,
  capacityKg: 1200,
  available: true,
  distanceKm: 50,
  routeCompatibility: 90,
  historicalReliability: 95,
};

test("rejects cross-tenant matching before scoring", () => {
  assert.throws(() =>
    scoreCandidate(baseFreight, {
      ...candidate,
      tenantId: "33333333-3333-3333-3333-333333333333",
    }),
  );
});

test("rejects freight statuses that are not matching", () => {
  assert.throws(() => scoreCandidate({ ...baseFreight, status: "open" }, candidate));
  assert.throws(() =>
    rankCandidates({ ...baseFreight, status: "negotiating" }, [candidate]),
  );
});

test("ranks eligible candidates deterministically", () => {
  const results = rankCandidates(baseFreight, [candidate]);
  assert.equal(results.length, 1);
  assert.equal(results[0]?.candidate.driverId, candidate.driverId);
  assert.ok(results[0]?.total > 0);
});

test("uses driver id as deterministic tie-breaker", () => {
  const first = { ...candidate, driverId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" };
  const second = { ...candidate, driverId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" };
  const results = rankCandidates(baseFreight, [second, first]);
  assert.deepEqual(
    results.map((result) => result.candidate.driverId),
    [first.driverId, second.driverId],
  );
});

test("does not invent routing confidence when routing data is unavailable", () => {
  const result = scoreCandidate(baseFreight, {
    ...candidate,
    distanceKm: undefined,
    routeCompatibility: undefined,
  });
  assert.equal(result.distance, 50);
  assert.equal(result.route, 50);
  assert.equal(result.reasons.includes("route-compatible"), false);
});

test("hard capacity mismatch scores zero", () => {
  const result = scoreCandidate(baseFreight, { ...candidate, capacityKg: 500 });
  assert.equal(result.capacity, 0);
});
