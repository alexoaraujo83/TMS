import assert from "node:assert/strict";
import test from "node:test";
import {
  getCargoProfileRecommendations,
  validateVehicleCompatibility,
  type VehicleCompatibilityInput,
} from "../src/vehicle-compatibility.ts";

const input = (overrides: Partial<VehicleCompatibilityInput> = {}): VehicleCompatibilityInput => ({
  cargoProfile: "carga_fracionada",
  cargoWeightKg: 930,
  cargoDimensions: { lengthM: 2.2, widthM: 2.0, heightM: 1.5 },
  volumetricFactorKgM3: 300,
  vehicleType: "truck",
  vehicleBodyType: "bau",
  payloadCapacityKg: 5000,
  vehicleDimensions: { internalLengthM: 6, internalWidthM: 2.2, internalHeightM: 2.2 },
  axleStatus: "within_limit",
  ...overrides,
});

test("calculates cargo cubage and volumetric weight using the configured carrier factor", () => {
  const result = validateVehicleCompatibility(input({
    cargoDimensions: { lengthM: 2.2, widthM: 2.5, heightM: 2 },
  }));

  assert.equal(result.volumeM3, 11);
  assert.equal(result.cubedWeightKg, 3300);
  assert.equal(result.volumetricFactorKgM3, 300);
});

test("rejects cargo that exceeds the actual vehicle internal width", () => {
  const result = validateVehicleCompatibility(input({
    cargoDimensions: { lengthM: 2.2, widthM: 2.5, heightM: 2 },
  }));

  assert.equal(result.status, "rejected");
  assert.ok(result.reasons.includes("cargo-width-exceeds-vehicle"));
});

test("rejects cargo heavier than the vehicle payload capacity", () => {
  const result = validateVehicleCompatibility(input({ cargoWeightKg: 5200 }));

  assert.equal(result.status, "rejected");
  assert.ok(result.reasons.includes("cargo-weight-exceeds-payload"));
});

test("returns pending when vehicle dimensions are not verified", () => {
  const result = validateVehicleCompatibility(input({ vehicleDimensions: undefined }));

  assert.equal(result.status, "pending");
  assert.ok(result.reasons.includes("vehicle-internal-dimensions-unverified"));
});

test("returns pending when only some cargo dimensions are supplied", () => {
  const result = validateVehicleCompatibility(input({
    cargoDimensions: { lengthM: 2.2, widthM: 2.5 },
  }));

  assert.equal(result.status, "pending");
  assert.ok(result.reasons.includes("cargo-dimensions-incomplete"));
});

test("does not auto-approve axle overload or unverified axle status", () => {
  const exceeded = validateVehicleCompatibility(input({ axleStatus: "exceeded" }));
  const unknown = validateVehicleCompatibility(input({ axleStatus: "unknown" }));

  assert.equal(exceeded.status, "pending");
  assert.equal(unknown.status, "pending");
  assert.ok(exceeded.reasons.includes("axle-load-exceeded-redistribution-required"));
});

test("flags reference envelope exceedance for legal review rather than asserting AET automatically", () => {
  const result = validateVehicleCompatibility(input({
    loadedOverallHeightM: 4.5,
    legalEnvelope: {
      maximumOverallHeightM: 4.4,
      requiresLegalReviewAboveHeight: true,
    },
  }));

  assert.equal(result.status, "pending");
  assert.ok(result.reasons.includes("loaded-height-exceeds-reference-review-limit"));
});

test("recommends refrigerated body for perishable cargo", () => {
  const recommendation = getCargoProfileRecommendations("pereciveis");

  assert.deepEqual(recommendation.bodyTypes, ["refrigerado"]);
  assert.ok(recommendation.notes.some((note) => note.includes("temperatura")));
});

test("rejects body mismatch for an ISO container profile", () => {
  const result = validateVehicleCompatibility(input({
    cargoProfile: "container_iso_40",
    vehicleBodyType: "bau",
  }));

  assert.equal(result.status, "rejected");
  assert.ok(result.reasons.includes("body-type-incompatible"));
});

test("rejects invalid numeric input", () => {
  assert.throws(() => validateVehicleCompatibility(input({ cargoWeightKg: 0 })), /cargoWeightKg/);
});
