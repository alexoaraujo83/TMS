# TMS Domain Map

This document defines the initial bounded-context map. Modules may evolve, but cross-domain dependencies must remain explicit.

| Domain          | Owns                                                               | May depend on                                   |
| --------------- | ------------------------------------------------------------------ | ----------------------------------------------- |
| Platform        | tenant lifecycle, platform configuration                           | IAM primitives                                  |
| IAM             | identity, membership, roles, permissions                           | Platform                                        |
| Master Data     | parties, customers, carriers, drivers, vehicles, addresses         | Platform, IAM                                   |
| Freight         | requests, cargo, stops, quotations, negotiation, contracts         | Platform, IAM, Master Data                      |
| Matching        | rules, capacity, candidates, scoring, assignment                   | Platform, Master Data, Freight                  |
| Trip Operations | trips, execution, occurrences, POD                                 | Platform, Master Data, Freight, Matching        |
| Compliance      | documents, validity, risk, GR controls                             | Platform, Master Data, Freight, Trip Operations |
| Finance         | costs, receivables, payables, settlement, payments, reconciliation | Platform, Master Data, Freight, Trip Operations |
| Reliability     | jobs, outbox, retries, webhooks                                    | Platform                                        |
| Audit           | immutable operational/security history                             | Platform, IAM                                   |
| Analytics       | read models, KPIs and operational reporting                        | domain events/read models                       |

## Forbidden coupling

- Web pages must not access the database directly.
- Domain modules must not import another module's private persistence implementation.
- Finance must not mutate Freight records as an implicit side effect; state transitions are explicit use cases/events.
- Worker handlers must be idempotent and must not bypass authorization boundaries for tenant-scoped business data.
- AI/optimization components may recommend decisions but cannot silently mutate transactional state.
