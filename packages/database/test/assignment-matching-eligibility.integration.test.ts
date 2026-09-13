import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { vehicleSatisfiesFreightRequirements } from "../src/assignment-repository.js";

describe("assignment vehicle eligibility", () => {
  const freight = {
    vehicleTypes: ["truck"],
    bodyTypes: ["open"],
    weightKg: 5000,
    minimumCapacityKg: 6000,
    minimumFreeMeters: 5,
  };

  it("accepts the vehicle that satisfies the matching requirements", () => {
    assert.equal(
      vehicleSatisfiesFreightRequirements(freight, {
        vehicleType: "truck",
        bodyType: "open",
        capacityKg: 10000,
        freeMeters: 10,
      }),
      true,
    );
  });

  it("rejects a different vehicle that violates body type", () => {
    assert.equal(
      vehicleSatisfiesFreightRequirements(freight, {
        vehicleType: "truck",
        bodyType: "closed",
        capacityKg: 10000,
        freeMeters: 10,
      }),
      false,
    );
  });

  it("rejects insufficient capacity or free meters", () => {
    assert.equal(
      vehicleSatisfiesFreightRequirements(freight, {
        vehicleType: "truck",
        bodyType: "open",
        capacityKg: 5000,
        freeMeters: 4,
      }),
      false,
    );
  });

  it("accepts unconstrained vehicle and body types", () => {
    assert.equal(
      vehicleSatisfiesFreightRequirements(
        { ...freight, vehicleTypes: [], bodyTypes: [] },
        {
          vehicleType: "van",
          bodyType: "closed",
          capacityKg: 6000,
          freeMeters: 5,
        },
      ),
      true,
    );
  });
});
