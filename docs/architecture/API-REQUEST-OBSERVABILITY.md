# API Request Observability

The API emits one structured completion event for each HTTP request after the response finishes.

## Event

`api.request.completed` contains:

- `requestId`: correlation identifier from `X-Request-Id` or a generated UUID.
- `method`: HTTP method.
- `path`: Express request path.
- `statusCode`: final HTTP response status.
- `durationMs`: elapsed request time in milliseconds.

The telemetry middleware does not record request bodies, query strings, authorization headers, cookies, or response bodies.

The request context middleware remains responsible for establishing the canonical `X-Request-Id` response header. Telemetry observes that correlation value and measures completion time.

Telemetry emission is isolated behind an injectable callback so tests and future observability adapters can consume the event without coupling the API to an external monitoring vendor.
