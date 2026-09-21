import assert from "node:assert/strict";
import test from "node:test";
import { fetchApiHealth, getApiBaseUrl } from "./api.ts";

test("normalizes the configured API base URL", () => {
  const previous = process.env.NEXT_PUBLIC_API_BASE_URL;
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.test///";

  try {
    assert.equal(getApiBaseUrl(), "https://api.example.test");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = previous;
  }
});

test("requires an API base URL", () => {
  const previous = process.env.NEXT_PUBLIC_API_BASE_URL;
  delete process.env.NEXT_PUBLIC_API_BASE_URL;

  try {
    assert.throws(
      () => getApiBaseUrl(),
      /NEXT_PUBLIC_API_BASE_URL is not configured/,
    );
  } finally {
    if (previous !== undefined) process.env.NEXT_PUBLIC_API_BASE_URL = previous;
  }
});

test("fetches and validates the API health contract", async () => {
  const previous = process.env.NEXT_PUBLIC_API_BASE_URL;
  const previousFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.test/";
  let request: Request | undefined;

  globalThis.fetch = async (input, init) => {
    request = new Request(input, init);
    return new Response(JSON.stringify({ status: "ok", service: "tms-api" }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-request-id": "request-123",
        "x-correlation-id": "correlation-123",
      },
    });
  };

  try {
    assert.deepEqual(await fetchApiHealth(), {
      status: "ok",
      service: "tms-api",
      requestId: "request-123",
      correlationId: "correlation-123",
    });
    assert.equal(request?.url, "https://api.example.test/health");
    assert.equal(request?.method, "GET");
  } finally {
    globalThis.fetch = previousFetch;
    if (previous === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = previous;
  }
});

test("rejects a non-success health response", async () => {
  const previous = process.env.NEXT_PUBLIC_API_BASE_URL;
  const previousFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.test";
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });

  try {
    await assert.rejects(
      () => fetchApiHealth(),
      /API health request failed with HTTP 503/,
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previous === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = previous;
  }
});

test("rejects an invalid health response contract", async () => {
  const previous = process.env.NEXT_PUBLIC_API_BASE_URL;
  const previousFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.test";
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    await assert.rejects(
      () => fetchApiHealth(),
      /API health response contract is invalid/,
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previous === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = previous;
  }
});
