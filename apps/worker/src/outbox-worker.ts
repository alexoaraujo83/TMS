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

export class OutboxProcessor {
  constructor(
    private readonly store: OutboxStore,
    private readonly handler: EventHandler,
  ) {}

  async process(
    tenantId: string,
    limit = 50,
  ): Promise<ProcessResult> {
    const events = await this.store.claimPending(tenantId, limit);
    let published = 0;
    let failed = 0;

    for (const event of events) {
      try {
        await this.handler(event);
        await this.store.markPublished(tenantId, event.id, event.leaseToken);
        published += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const retryAt = new Date(Date.now() + retryDelayMs(event.attempts));
        await this.store.markFailed(
          tenantId,
          event.id,
          event.leaseToken,
          message.slice(0, 4000),
          retryAt,
        );
        failed += 1;
      }
    }

    return { claimed: events.length, published, failed };
  }
}
