import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { TripExecutionRepository } from "@tms/database";
import type { Pool } from "pg";
import { DATABASE_POOL } from "../../common/database.provider.js";
import type { RequestContext } from "../../common/request-context.js";
import type {
  CreateOccurrenceDto,
  CreatePodDto,
} from "./trip-execution.dto.js";

@Injectable()
export class TripExecutionService {
  private readonly repository: TripExecutionRepository;

  constructor(@Inject(DATABASE_POOL) pool: Pool) {
    this.repository = new TripExecutionRepository(pool);
  }

  createOccurrence(
    context: RequestContext,
    tripId: string,
    dto: CreateOccurrenceDto,
  ) {
    return this.repository.createOccurrence(
      context.tenantId,
      tripId,
      {
        type: dto.type,
        severity: dto.severity,
        description: dto.description,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
        metadata: dto.metadata,
      },
      {
        actorUserId: context.userId,
        action: "trip.occurrence_created",
        entityType: "trip_occurrence",
        requestId: context.requestId,
      },
    );
  }

  listOccurrences(context: RequestContext, tripId: string) {
    return this.repository.listOccurrences(context.tenantId, tripId);
  }

  createPod(context: RequestContext, tripId: string, dto: CreatePodDto) {
    return this.repository.createPod(
      context.tenantId,
      tripId,
      {
        recipientName: dto.recipientName,
        receivedAt: new Date(dto.receivedAt),
        documentRef: dto.documentRef,
        notes: dto.notes,
        metadata: dto.metadata,
      },
      {
        actorUserId: context.userId,
        action: "trip.pod_created",
        entityType: "trip_pod",
        requestId: context.requestId,
      },
    );
  }

  async getPod(context: RequestContext, tripId: string) {
    const pod = await this.repository.getPod(context.tenantId, tripId);
    if (!pod) throw new NotFoundException("POD not found");
    return pod;
  }

  listTimeline(context: RequestContext, tripId: string) {
    return this.repository.listTimeline(context.tenantId, tripId);
  }
}
