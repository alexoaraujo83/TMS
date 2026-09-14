import assert from "node:assert/strict";
import test from "node:test";
import { HealthController } from "../src/health.controller.js";

const healthyPool = {
  query: async () => ({ rows: [{ ok: 1 }] }),
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

test("ready reports database readiness when the database responds", async () => {
  const controller = new HealthController(healthyPool);

  assert.deepEqual(await controller.ready(), {
    status: "ready",
    service: "tms-api",
  });
});

test("ready rejects when the database is unavailable", async () => {
  const controller = new HealthController(failingPool);

  await assert.rejects(controller.ready(), /DATABASE_UNAVAILABLE/);
});
