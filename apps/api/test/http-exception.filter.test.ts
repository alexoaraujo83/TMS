import assert from "node:assert/strict";
import test from "node:test";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { HttpExceptionFilter } from "../src/common/http-exception.filter.js";
import { normalizeHttpExceptionMessage } from "../src/common/http-exception.filter.js";

function createHost(requestId = "req-test-123") {
  const jsonBodies: unknown[] = [];
  let statusCode: number | undefined;
  const response = {
    status(status: number) {
      statusCode = status;
      return this;
    },
    json(body: unknown) {
      jsonBodies.push(body);
      return body;
    },
  };
  const request = {
    header(name: string) {
      return name === "x-request-id" ? requestId : undefined;
    },
  };
  const host = {
    switchToHttp() {
      return {
        getResponse: () => response,
        getRequest: () => request,
      };
    },
  };
  return { host, jsonBodies, getStatus: () => statusCode };
}

test("keeps a string HTTP error message unchanged", () => {
  assert.equal(
    normalizeHttpExceptionMessage("Authentication required"),
    "Authentication required",
  );
});

test("normalizes Nest validation message arrays to a stable string", () => {
  assert.equal(
    normalizeHttpExceptionMessage({
      message: ["originCity must be a string", "weightKg must be positive"],
    }),
    "originCity must be a string; weightKg must be positive",
  );
});

test("uses the stable fallback for missing messages", () => {
  assert.equal(
    normalizeHttpExceptionMessage({ error: "Bad Request" }),
    "Request failed",
  );
  assert.equal(normalizeHttpExceptionMessage(undefined), "Request failed");
});

test("serializes 401 with request correlation and stable error code", () => {
  const fixture = createHost();
  new HttpExceptionFilter().catch(new UnauthorizedException("Authentication required"), fixture.host as never);

  assert.equal(fixture.getStatus(), 401);
  assert.deepEqual(fixture.jsonBodies[0], {
    code: "REQUEST_ERROR",
    message: "Authentication required",
    requestId: "req-test-123",
  });
});

test("serializes 403 without exposing authorization internals", () => {
  const fixture = createHost();
  new HttpExceptionFilter().catch(new ForbiddenException("Insufficient permission"), fixture.host as never);

  assert.equal(fixture.getStatus(), 403);
  assert.deepEqual(fixture.jsonBodies[0], {
    code: "REQUEST_ERROR",
    message: "Insufficient permission",
    requestId: "req-test-123",
  });
});

test("serializes 400 validation payloads as a stable message", () => {
  const fixture = createHost();
  new HttpExceptionFilter().catch(
    new BadRequestException({ message: ["originCity must be a string", "weightKg must be positive"] }),
    fixture.host as never,
  );

  assert.equal(fixture.getStatus(), 400);
  assert.deepEqual(fixture.jsonBodies[0], {
    code: "REQUEST_ERROR",
    message: "originCity must be a string; weightKg must be positive",
    requestId: "req-test-123",
  });
});

test("serializes 404 with the exception message", () => {
  const fixture = createHost();
  new HttpExceptionFilter().catch(new NotFoundException("Freight not found"), fixture.host as never);

  assert.equal(fixture.getStatus(), 404);
  assert.deepEqual(fixture.jsonBodies[0], {
    code: "REQUEST_ERROR",
    message: "Freight not found",
    requestId: "req-test-123",
  });
});

test("serializes unknown 500 failures without leaking exception details", () => {
  const fixture = createHost();
  new HttpExceptionFilter().catch(new Error("database password=secret"), fixture.host as never);

  assert.equal(fixture.getStatus(), 500);
  assert.deepEqual(fixture.jsonBodies[0], {
    code: "INTERNAL_ERROR",
    message: "Internal server error",
    requestId: "req-test-123",
  });
  assert.doesNotMatch(JSON.stringify(fixture.jsonBodies[0]), /password=secret/);
});
