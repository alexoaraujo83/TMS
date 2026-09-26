import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { appendAuditEvent, type AuditEventInput } from "./audit-repository.js";
import { assertUuid } from "./query.js";
import { withTransaction } from "./transaction.js";

export interface CreateFreightInput {
  tenantId: string;
  freightType: string;
  originCity: string;
  originState: string;
  destinationCity: string;
  destinationState: string;
  cargoDescription: string;
  quantity: number;
  weightKg: number;
  volumeM3?: number;
  linearMeters?: number;
  customerPriceCents?: number;
  driverPriceCents?: number;
  vehicleTypes?: readonly string[];
  bodyTypes?: readonly string[];
  minimumFreeMeters?: number;
  minimumCapacityKg?: number;
}

export interface FreightRow {
  id: string;
  tenantId: string;
  status: string;
  freightType: string;
  originCity: string;
  originState: string;
  destinationCity: string;
  destinationState: string;
  cargoDescription: string;
  quantity: number;
  weightKg: string;
  volumeM3: string | null;
  linearMeters: string | null;
  customerPriceCents: string | null;
  driverPriceCents: string | null;
  vehicleTypes: readonly string[];
  bodyTypes: readonly string[];
  minimumFreeMeters: string | null;
  minimumCapacityKg: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const FREIGHT_COLUMNS = `id,
  tenant_id as "tenantId",
  status,
  freight_type as "freightType",
  origin_city as "originCity",
  origin_state as "originState",
  destination_city as "destinationCity",
  destination_state as "destinationState",
  cargo_description as "cargoDescription",
  quantity,
  weight_kg as "weightKg",
  volume_m3 as "volumeM3",
  linear_meters as "linearMeters",
  customer_price_cents as "customerPriceCents",
  driver_price_cents as "driverPriceCents",
  vehicle_types as "vehicleTypes",
  body_types as "bodyTypes",
  minimum_free_meters as "minimumFreeMeters",
  minimum_capacity_kg as "minimumCapacityKg",
  created_at as "createdAt",
  updated_at as "updatedAt"`;

type AuditInput = Omit<AuditEventInput, "tenantId" | "entityId">;

export class PostgresFreightRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateFreightInput): Promise<FreightRow> {
    return this.createWithAudit(input);
  }

  async createWithAudit(
    input: CreateFreightInput,
    audit?: AuditInput,
  ): Promise<FreightRow> {
    assertUuid(input.tenantId, "tenantId");
    return withTransaction(
      this.pool,
      { tenantId: input.tenantId },
      async (client) => {
        const result = await client.query<FreightRow>(
          `insert into freights (
          tenant_id, freight_type, origin_city, origin_state,
          destination_city, destination_state, cargo_description,
          quantity, weight_kg, volume_m3, linear_meters,
          customer_price_cents, driver_price_cents,
          vehicle_types, body_types, minimum_free_meters, minimum_capacity_kg
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        returning ${FREIGHT_COLUMNS}`,
          [
            input.tenantId,
            input.freightType,
            input.originCity,
            input.originState,
            input.destinationCity,
            input.destinationState,
            input.cargoDescription,
            input.quantity,
            input.weightKg,
            input.volumeM3 ?? null,
            input.linearMeters ?? null,
            input.customerPriceCents ?? null,
            input.driverPriceCents ?? null,
            input.vehicleTypes ?? [],
            input.bodyTypes ?? [],
            input.minimumFreeMeters ?? null,
            input.minimumCapacityKg ?? null,
          ],
        );
        const row = result.rows[0];
        if (!row) throw new Error("Freight creation failed");
        if (audit) {
          await appendAuditEvent(client, {
            ...audit,
            tenantId: input.tenantId,
            entityId: row.id,
          });
        }
        return row;
      },
    );
  }


  async updateWithAudit(
    tenantId: string,
    freightId: string,
    input: Partial<Omit<CreateFreightInput, "tenantId">>,
    audit?: AuditInput,
  ): Promise<FreightRow | null> {
    assertUuid(tenantId, "tenantId");
    assertUuid(freightId, "freightId");
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const currentResult = await client.query<FreightRow>(
        `select ${FREIGHT_COLUMNS} from freights where id = $1 and tenant_id = $2 limit 1`,
        [freightId, tenantId],
      );
      const current = currentResult.rows[0];
      if (!current) return null;

      const result = await client.query<FreightRow>(
        `update freights set
          freight_type = coalesce($3, freight_type),
          origin_city = coalesce($4, origin_city),
          origin_state = coalesce($5, origin_state),
          destination_city = coalesce($6, destination_city),
          destination_state = coalesce($7, destination_state),
          cargo_description = coalesce($8, cargo_description),
          quantity = coalesce($9, quantity),
          weight_kg = coalesce($10, weight_kg),
          volume_m3 = case when $11::numeric is null then volume_m3 else $11 end,
          linear_meters = case when $12::numeric is null then linear_meters else $12 end,
          customer_price_cents = case when $13::integer is null then customer_price_cents else $13 end,
          driver_price_cents = case when $14::integer is null then driver_price_cents else $14 end,
          vehicle_types = coalesce($15, vehicle_types),
          body_types = coalesce($16, body_types),
          minimum_free_meters = case when $17::numeric is null then minimum_free_meters else $17 end,
          minimum_capacity_kg = case when $18::numeric is null then minimum_capacity_kg else $18 end,
          updated_at = now()
        where id = $1 and tenant_id = $2
        returning ${FREIGHT_COLUMNS}`,
        [
          freightId, tenantId, input.freightType ?? null, input.originCity ?? null,
          input.originState ?? null, input.destinationCity ?? null,
          input.destinationState ?? null, input.cargoDescription ?? null,
          input.quantity ?? null, input.weightKg ?? null, input.volumeM3 ?? null,
          input.linearMeters ?? null, input.customerPriceCents ?? null,
          input.driverPriceCents ?? null, input.vehicleTypes ?? null, input.bodyTypes ?? null,
          input.minimumFreeMeters ?? null, input.minimumCapacityKg ?? null,
        ],
      );
      const row = result.rows[0] ?? null;
      if (row && audit) {
        await appendAuditEvent(client, {
          ...audit,
          tenantId,
          entityId: row.id,
          beforeState: audit.beforeState ?? current,
          afterState: audit.afterState ?? row,
        });
      }
      return row;
    });
  }

  async deleteWithAudit(
    freightId: string,
    tenantId: string,
    audit: Omit<AuditEventInput, "tenantId" | "entityId">,
  ): Promise<boolean> {
    assertUuid(tenantId, "tenantId");
    assertUuid(freightId, "freightId");
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const result = await client.query<{ id: string }>(
        "delete from freights where id = $1 and tenant_id = $2 returning id",
        [freightId, tenantId],
      );
      const row = result.rows[0];
      if (!row) return false;
      await appendAuditEvent(client, {
        ...audit,
        tenantId,
        entityId: row.id,
      });
      return true;
    });
  }

  async findById(
    tenantId: string,
    freightId: string,
  ): Promise<FreightRow | null> {
    assertUuid(tenantId, "tenantId");
    assertUuid(freightId, "freightId");
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const result = await client.query<FreightRow>(
        `select ${FREIGHT_COLUMNS} from freights where id = $1 and tenant_id = $2 limit 1`,
        [freightId, tenantId],
      );
      return result.rows[0] ?? null;
    });
  }

  async list(tenantId: string): Promise<readonly FreightRow[]> {
    assertUuid(tenantId, "tenantId");
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const result = await client.query<FreightRow>(
        `select ${FREIGHT_COLUMNS} from freights where tenant_id = $1 order by created_at desc`,
        [tenantId],
      );
      return result.rows;
    });
  }

  async updateStatusWithAudit(
    tenantId: string,
    freightId: string,
    expectedStatus: string,
    nextStatus: string,
    audit: AuditInput,
  ): Promise<FreightRow | null> {
    assertUuid(tenantId, "tenantId");
    assertUuid(freightId, "freightId");

    return withTransaction(this.pool, { tenantId }, async (client) => {
      const result = await client.query<FreightRow>(
        `update freights
            set status = $3, updated_at = now()
          where id = $1 and tenant_id = $2 and status = $4
          returning ${FREIGHT_COLUMNS}`,
        [freightId, tenantId, nextStatus, expectedStatus],
      );
      const row = result.rows[0] ?? null;
      if (!row) return null;

      if (nextStatus === "delivered" || nextStatus === "cancelled") {
        const assignment = await client.query<{
          id: string;
          status: "active";
        }>(
          `select id, status
             from freight_assignments
            where tenant_id = $1
              and freight_id = $2
              and status = 'active'
            for update`,
          [tenantId, freightId],
        );

        if (nextStatus === "delivered" && !assignment.rows[0]) {
          throw new Error(
            "Freight cannot be delivered without an active assignment",
          );
        }

        const activeAssignment = assignment.rows[0];
        if (activeAssignment) {
          const assignmentNextStatus =
            nextStatus === "delivered" ? "completed" : "cancelled";
          const timestampColumn =
            assignmentNextStatus === "completed"
              ? "completed_at"
              : "cancelled_at";

          await client.query(
            `update freight_assignments
                set status = $3, ${timestampColumn} = now(), updated_at = now()
              where tenant_id = $1 and id = $2 and status = 'active'`,
            [tenantId, activeAssignment.id, assignmentNextStatus],
          );

          if (audit) {
            await appendAuditEvent(client, {
              ...audit,
              tenantId,
              action:
                assignmentNextStatus === "completed"
                  ? "freight.assignment_completed"
                  : "freight.assignment_cancelled",
              entityType: "freight_assignment",
              entityId: activeAssignment.id,
              beforeState: { status: "active", freightId },
              afterState: { status: assignmentNextStatus, freightId },
            });
          }
        }
      }

      // Status transitions are persisted with their audit event and outbox event in one transaction.
      if (audit) {
        await appendAuditEvent(client, {
          ...audit,
          tenantId,
          entityId: row.id,
        });

        const eventId = randomUUID();
        await client.query(
          `insert into outbox_events (
             id, tenant_id, aggregate_type, aggregate_id, event_type, payload
           ) values ($1, $2, 'freight', $3, 'freight.status_changed', $4::jsonb)`,
          [
            eventId,
            tenantId,
            row.id,
            JSON.stringify({
              event_id: eventId,
              freight_id: row.id,
              from_status: expectedStatus,
              to_status: nextStatus,
              request_id: audit.requestId ?? null,
              correlation_id: audit.correlationId ?? null,
              actor_user_id: audit.actorUserId ?? null,
            }),
          ],
        );
      }

      return row;
    });
  }
}
