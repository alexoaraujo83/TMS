import assert from "node:assert/strict";
import test from "node:test";
import {
  FREIGHT_STATUS_TRANSITIONS,
  canTransitionFreightStatus,
  type FreightStatus,
} from "../src/index.ts";

const statuses = Object.keys(FREIGHT_STATUS_TRANSITIONS) as FreightStatus[];

test("allows only declared forward lifecycle transitions", () => {
  assert.equal(canTransitionFreightStatus("draft", "open"), true);
  assert.equal(canTransitionFreightStatus("open", "matching"), true);
  assert.equal(canTransitionFreightStatus("matching", "negotiating"), true);
  assert.equal(canTransitionFreightStatus("negotiating", "assigned"), true);
  assert.equal(canTransitionFreightStatus("assigned", "in_transit"), true);
  assert.equal(canTransitionFreightStatus("in_transit", "delivered"), true);
});

test("permits cancellation only before delivery", () => {
  for (const status of [
    "draft",
    "open",
    "matching",
    "negotiating",
    "assigned",
  ] as const) {
    assert.equal(canTransitionFreightStatus(status, "cancelled"), true);
  }

  assert.equal(canTransitionFreightStatus("in_transit", "cancelled"), false);
  assert.equal(canTransitionFreightStatus("delivered", "cancelled"), false);
});

test("prevents terminal states from reopening", () => {
  for (const status of ["delivered", "cancelled"] as const) {
    for (const next of statuses) {
      assert.equal(canTransitionFreightStatus(status, next), false);
    }
  }
});

test("prevents skipping operational lifecycle stages", () => {
  assert.equal(canTransitionFreightStatus("draft", "matching"), false);
  assert.equal(canTransitionFreightStatus("open", "assigned"), false);
  assert.equal(canTransitionFreightStatus("matching", "assigned"), false);
  assert.equal(canTransitionFreightStatus("assigned", "delivered"), false);
  assert.equal(canTransitionFreightStatus("in_transit", "assigned"), false);
});
