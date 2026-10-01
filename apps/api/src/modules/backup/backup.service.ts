import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";
import { DATABASE_POOL } from "../../common/database.provider.js";

@Injectable()
export class BackupService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async listManifests() {
    const result = await this.pool.query(
      `
      select
        backup_id as "backupId",
        object_path as "object",
        created_at as "createdAt",
        bytes,
        sha256,
        postgres_version as "postgresVersion",
        public_table_count as "publicTableCount",
        migration_table as "migrationTable",
        migration_count as "migrationCount",
        duration_seconds as "durationSeconds",
        integrity_status as "integrity",
        retention_status as "retention",
        source_run_id as "runId",
        source_run_url as "runUrl",
        source,
        manifest_version as "manifestVersion"
      from public.backup_manifests
      where integrity_status = 'verified'
        and retention_status = 'verified'
      order by created_at desc
      limit 50
      `,
    );

    return {
      backups: result.rows,
      generatedAt: new Date().toISOString(),
      source: "postgresql.backup_manifests",
    };
  }
}
