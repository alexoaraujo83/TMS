declare module "node:test" {
  const test: (...args: unknown[]) => unknown;
  export default test;
}

declare module "node:assert/strict" {
  const assert: {
    equal: (...args: unknown[]) => unknown;
    deepEqual: (...args: unknown[]) => unknown;
    ok: (...args: unknown[]) => unknown;
  };
  export default assert;
}
