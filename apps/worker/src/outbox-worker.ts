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

export interface OutboxProcessorOptions {
  leaseMs?: number;
  heartbeatMs?: number;
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

interface LeaseState {
  event: OutboxEvent;
  lost: boolean;
  done: boolean;
}

export class OutboxProcessor {
  private readonly leaseMs: number;
  private readonly heartbeatMs: number;

  constructor(
    private readonly store: OutboxStore,
    private readonly handler: EventHandler,
    options: OutboxProcessorOptions = {},
  ) {
    this.leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS;
    this.heartbeatMs = Math.max(
      MIN_HEARTBEAT_MS,
      options.heartbeatMs ?? Math.floor(this.leaseMs / 3),
    );
    if (!Number.isFinite(this.leaseMs) || this.leaseMs <= 0) {
      throw new Error("OUTBOX_LEASE_INVALID");
    }
    if (this.heartbeatMs >= this.leaseMs) {
      throw new Error("OUTBOX_HEARTBEAT_INVALID");
    }
  }

  async process(tenantId: string, limit = 50): Promise<ProcessResult> {
    const events = await this.store.claimPending(tenantId, limit);
    let published = 0;
    let failed = 0;
    const states = events.map<LeaseState>((event) => ({ event, lost: false, done: false }));
    let pendingRenewal: Promise<void> | undefined;

    const renewActiveLeases = async (): Promise<void> => {
      await Promise.all(
        states
          .filter((state) => !state.done && !state.lost)
          .map(async (state) => {
            try {
              await this.store.renewLease(
                tenantId,
                state.event.id,
                state.event.leaseToken,
                this.leaseMs,
              );
            } catch {
              state.lost = true;
            }
          }),
      );
    };

    const heartbeat = setInterval(() => {
      const renewal = renewActiveLeases();
      pendingRenewal = renewal;
      void renewal.then(
        () => {
          if (pendingRenewal === renewal) pendingRenewal = undefined;
        },
        () => {
          if (pendingRenewal === renewal) pendingRenewal = undefined;
        },
      );
    }, this.heartbeatMs);

    try {
      for (const state of states) {
        if (pendingRenewal) await pendingRenewal;

        const { event } = state;
        if (state.lost) {
          failed += 1;
          state.done = true;
          continue;
        }

        try {
          await this.handler(event);
        } catch (error) {
          if (pendingRenewal) await pendingRenewal;
          const message = error instanceof Error ? error.message : String(error);
          const retryAt = new Date(Date.now() + retryDelayMs(event.attempts));
          if (!state.lost) {
            await this.store.markFailed(
              tenantId,
              event.id,
              event.leaseToken,
              message.slice(0, 4000),
              retryAt,
            );
          }
          failed += 1;
          state.done = true;
          continue;
        }

        if (pendingRenewal) await pendingRenewal;
        if (state.lost) {
          failed += 1;
          state.done = true;
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
        state.done = true;
      }
    } finally {
      clearInterval(heartbeat);
      if (pendingRenewal) await pendingRenewal;
    }

    return { claimed: events.length, published, failed };
  }
}
