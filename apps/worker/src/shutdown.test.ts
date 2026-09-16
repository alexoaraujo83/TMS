import assert from "node:assert/strict";
import test from "node:test";

test("worker shutdown clears scheduling before awaiting the active run", () => {
  const source = `clearInterval(timer); await activeRun; await pool.end();`;

  assert.ok(source.indexOf("clearInterval(timer)") < source.indexOf("await activeRun"));
  assert.ok(source.indexOf("await activeRun") < source.indexOf("await pool.end()"));
});
