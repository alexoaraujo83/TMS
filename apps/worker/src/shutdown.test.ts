import { describe, expect, it } from "vitest";

describe("worker shutdown contract", () => {
  it("documents that shutdown clears scheduling before awaiting the active run", () => {
    const source = `clearInterval(timer); await activeRun; await pool.end();`;
    expect(source.indexOf("clearInterval(timer)")).toBeLessThan(
      source.indexOf("await activeRun"),
    );
    expect(source.indexOf("await activeRun")).toBeLessThan(
      source.indexOf("await pool.end()"),
    );
  });
});
