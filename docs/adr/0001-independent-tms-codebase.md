# ADR 0001 — Independent TMS codebase

## Status

Accepted

## Decision

The TMS is implemented as an independent canonical codebase. Architecture, security, tenancy, database, and operational decisions are validated against the requirements of this repository rather than inherited from another project.

Validated engineering patterns may be adopted when they satisfy the TMS contracts, tests, security boundaries, and operational evidence requirements.

## Consequences

The repository remains independently evolvable and avoids historical coupling, legacy namespaces, and undocumented assumptions from external codebases.
