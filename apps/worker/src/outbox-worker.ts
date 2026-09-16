export interface OutboxEvent {
  id: string;
  tenantId: string;
  aggregateType: string;
  aggregateId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  attempts: number;
  leaseToken: string;
}

export interface OutboxStore {
  claimPending(tenantId: string, limit: number): Promise<OutboxEvent[]>;
  renewLease(
    tenantId: string,
    id: string,
    leaseToken: string,
    leaseMs?: number,
  ): Promise<void>;
  markPublished(tenantId: string, id: string, leaseToken: string): Promise<void>;
  markFailed(
    tenantId: string,
    id: string,
    leaseToken: string,
    error: string,
    retryAt: Date,
  ): Promise<void>;
}

export type EventHandler = (event: OutboxEvent) => Promise<void>;

export interface ProcessResult {
  claimed: number;
  published: number;
  failed: number;
}

export function retryDelayMs(
  attempts: number,
  baseDelayMs = 1000,
  maxDelayMs = 300000,
): number {
  return Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempts - 1));
}

const DEFAULT_LEASE_MS = 5 * 60 * 1000;
const MIN_HEARTBEAT_MS = 1000;

export class OutboxProcessor {
  constructor(
    private readonly store: OutboxStore,
    private readonly handler: EventHandler,
  ) {}

  async process(tenantId: string, limit = 50): Promise<ProcessResult> {
    const events = await this.store.claimPending(tenantId, limit);
    let published = 0;
    let failed = 0;

    for (const event of events) {
      let leaseLost = false;
      const heartbeatMs = Math.max(
        MIN_HEARTBEAT_MS,
        Math.floor(DEFAULT_LEASE_MS / 3),
      );
      const heartbeat = setInterval(() => {
        void this.store
          .renewLease(tenantId, event.id, event.leaseToken, DEFAULT_LEASE_MS)
          .catch(() => {
            leaseLost = true;
          });
      }, heartbeatMs);

      try {
        await this.handler(event);
      } catch (error) {
        clearInterval(heartbeat);
        const message = error instanceof Error ? error.message : String(error);
        const retryAt = new Date(Date.now() + retryDelayMs(event.attempts));
        if (!leaseLost) {
          await this.store.markFailed(
            tenantId,
            event.id,
            event.leaseToken,
            message.slice(0, 4000),
            retryAt,
          );
        }
        failed += 1;
        continue;
      }

      clearInterval(heartbeat);
      if (leaseLost) {
        failed += 1;
        continue;
      }

      try {
        await this.store.markPublished(tenantId, event.id, event.leaseToken);
        published += 1;
      } catch {
        // The handler has already completed its side effect. Do not clear the
        // lease or schedule an immediate retry: doing so can turn an
        // acknowledgement failure into an avoidable duplicate side effect.
        // The existing lease remains fenced until it expires, after which a
        // later claim may replay the event. Handlers therefore remain required
        // to be idempotent using event.id as their durable idempotency key.
        failed += 1;
      }
    }

    return { claimed: events.length, published, failed };
  }
}
