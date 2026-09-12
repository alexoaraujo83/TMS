import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AssignmentRepository } from "@tms/database";
import type { Pool } from "pg";
import { DATABASE_POOL } from "../../common/database.provider.js";
import type { RequestContext } from "../../common/request-context.js";

@Injectable()
export class AssignmentService {
  private readonly assignments: AssignmentRepository;

  constructor(@Inject(DATABASE_POOL) pool: Pool) {
    this.assignments = new AssignmentRepository(pool);
  }

  async assign(
    context: RequestContext,
    freightId: string,
    driverId: string,
    vehicleId: string,
  ) {
    try {
      return await this.assignments.assign(
        context.tenantId,
        freightId,
        driverId,
        vehicleId,
        {
          actorUserId: context.userId,
          action: "freight.assigned",
          entityType: "freight_assignment",
          requestId: context.requestId,
        },
      );
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      if (error.message === "Freight not found") {
        throw new NotFoundException(error.message);
      }
      if (
        error.message.includes("not eligible") ||
        error.message.includes("already has an active assignment") ||
        error.message.includes("could not be moved")
      ) {
        throw new ConflictException(error.message);
      }
      if (
        error.message === "Driver not found" ||
        error.message === "Vehicle not found"
      ) {
        throw new NotFoundException(error.message);
      }
      if (
        error.message === "Driver is not eligible for assignment" ||
        error.message === "Vehicle is not available for assignment" ||
        error.message === "Vehicle is not assigned to the selected driver"
      ) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
