# Freight and matching architecture

## Freight lifecycle

`draft → open → matching → negotiating → assigned → in_transit → delivered`

Cancellation is terminal and must be audited.

## Tenant isolation

Every operational aggregate carries `tenant_id`. API authorization must establish the authenticated tenant before domain access, and PostgreSQL RLS remains the final database boundary.

## Matching

The first matching engine is deterministic and explainable. It ranks candidates using:

- vehicle/body compatibility;
- cargo capacity;
- driver availability;
- route compatibility and distance;
- negotiated/offered price;
- historical reliability.

AI can later augment candidate ranking, but must not bypass tenant authorization, hard compatibility constraints, or the deterministic safety gate.

## Operational entities

- Carrier
- Driver
- Vehicle
- Freight

Driver compliance fields include RNTRC/ANTT status. Vehicle type and body type are modeled explicitly so operational searches can distinguish combinations such as truck + baú, carreta + sider, or grade baixa.
