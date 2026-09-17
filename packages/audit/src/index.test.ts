import test from "node:test";
import assert from "node:assert/strict";

import { createAuditEvent } from "./index.ts";

const context = {
  tenantId: "tenant-1",
  userId: "user-1",
  roles: ["dispatcher"],
};

test("creates an audit event from tenant context", () => {
  const event = createAuditEvent(context, {
    action: "create",
    resource: "freight",
    resourceId: "freight-1",
    requestId: "request-1",
    metadata: { source: "test" },
  });

  assert.equal(event.tenantId, "tenant-1");
  assert.equal(event.actorUserId, "user-1");
  assert.equal(event.action, "create");
  assert.equal(event.resource, "freight");
  assert.equal(event.resourceId, "freight-1");
  assert.equal(event.requestId, "request-1");
  assert.deepEqual(event.metadata, { source: "test" });
  assert.ok(event.occurredAt instanceof Date);
});
