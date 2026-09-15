import assert from "node:assert/strict";
import test from "node:test";
import { HealthController } from "../src/health.controller.js";

const healthyPool = {
  query: async () => ({ rows: [{ current_user: "tms_app" }] }),
};

const wrongRolePool = {
  query: async () => ({ rows: [{ current_user: "neondb_owner" }] }),
};

const failingPool = {
  query: async () => {
    throw new Error("DATABASE_UNAVAILABLE");
  },
};

test("health reports process liveness without requiring the database", () => {
  const controller = new HealthController(healthyPool);

  assert.deepEqual(controller.health(), {
    status: "ok",
    service: "tms-api",
  });
});

test("ready reports database readiness when the restricted runtime role is active", async () => {
  const controller = new HealthController(healthyPool);

  assert.deepEqual(await controller.ready(), {
    status: "ready",
    service: "tms-api",
  });
});

test("ready rejects when the database runtime role is not restricted", async () => {
  const controller = new HealthController(wrongRolePool);

  await assert.rejects(controller.ready(), /DATABASE_UNAVAILABLE/);
});

test("ready rejects when the database is unavailable", async () => {
  const controller = new HealthController(failingPool);

  await assert.rejects(controller.ready(), /DATABASE_UNAVAILABLE/);
});
