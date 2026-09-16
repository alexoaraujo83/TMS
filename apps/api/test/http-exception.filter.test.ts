import { describe, expect, it } from "node:test";
import { normalizeHttpExceptionMessage } from "../src/common/http-exception.filter.js";

describe("normalizeHttpExceptionMessage", () => {
  it("keeps a string message unchanged", () => {
    expect(normalizeHttpExceptionMessage("Authentication required")).toBe(
      "Authentication required",
    );
  });

  it("normalizes Nest validation message arrays to a stable string", () => {
    expect(
      normalizeHttpExceptionMessage({
        message: ["originCity must be a string", "weightKg must be positive"],
      }),
    ).toBe("originCity must be a string; weightKg must be positive");
  });

  it("uses the stable fallback for missing messages", () => {
    expect(normalizeHttpExceptionMessage({ error: "Bad Request" })).toBe(
      "Request failed",
    );
    expect(normalizeHttpExceptionMessage(undefined)).toBe("Request failed");
  });
});
