import type { Freight } from '@tms/freight';
import type { MatchCandidate, MatchResult } from '@tms/matching';

export interface MatchingApplicationService {
  rank(tenantId: string, freight: Freight, candidates: readonly MatchCandidate[]): readonly MatchResult[];
}

export function assertMatchingTenant(tenantId: string, freight: Freight, candidates: readonly MatchCandidate[]): void {
  if (tenantId !== freight.tenantId) {
    throw new Error('Cross-tenant matching is forbidden');
  }
  if (candidates.some((candidate) => candidate.tenantId !== tenantId)) {
    throw new Error('Cross-tenant matching candidate is forbidden');
  }
}
