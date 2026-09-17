import test from "node:test";
import assert from "node:assert/strict";

import { APP_NAME } from "./index.ts";

test("exports the canonical application name", () => {
  assert.equal(APP_NAME, "tms");
});
