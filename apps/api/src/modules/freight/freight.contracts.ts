import type { Freight } from "@tms/freight";

export interface FreightRepository {
  create(freight: Freight): Promise<Freight>;
  list(tenantId: string): Promise<readonly Freight[]>;
  findById(tenantId: string, freightId: string): Promise<Freight | null>;
}

export interface FreightApplicationService {
  create(tenantId: string, freight: Freight): Promise<Freight>;
  list(tenantId: string): Promise<readonly Freight[]>;
  get(tenantId: string, freightId: string): Promise<Freight | null>;
}
