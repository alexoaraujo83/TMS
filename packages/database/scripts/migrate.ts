import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsDir = join(root, "migrations");
const databaseUrl = process.env.DATABASE_URL;
const allowExistingSchemaBaseline = process.env.TMS_ALLOW_EXISTING_SCHEMA_BASELINE === "true";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const expectedTables = [
  "audit_events",
  "carriers",
  "compliance_checks",
  "drivers",
  "freight_assignments",
  "freights",
  "gr_requests",
  "permissions",
  "role_permissions",
  "roles",
  "schema_migrations",
  "tenant_memberships",
  "tenants",
  "trips",
  "users",
  "vehicles",
] as const;

const rlsTables = expectedTables.filter(
  (table) => !["permissions", "schema_migrations"].includes(table),
);

const requiredColumns: Record<string, string[]> = {
  users: ["id", "email", "display_name", "status", "auth0_subject", "created_at", "updated_at"],
  tenants: ["id", "name", "status", "created_at", "updated_at"],
  tenant_memberships: ["tenant_id", "user_id", "role_id", "status"],
  roles: ["id", "name", "description"],
  permissions: ["id", "resource", "action"],
  role_permissions: ["role_id", "permission_id"],
  carriers: ["id", "tenant_id"],
  drivers: ["id", "tenant_id", "carrier_id"],
  vehicles: ["id", "tenant_id", "driver_id"],
  freights: ["id", "tenant_id"],
  freight_assignments: ["id", "tenant_id", "freight_id"],
  trips: ["id", "tenant_id", "freight_assignment_id", "status"],
  compliance_checks: [
    "id",
    "tenant_id",
    "freight_id",
    "assignment_id",
    "check_type",
    "status",
    "provider",
    "external_reference",
    "metadata",
    "checked_at",
    "expires_at",
  ],
  gr_requests: [
    "id",
    "tenant_id",
    "freight_id",
    "assignment_id",
    "status",
    "provider",
    "protocol",
    "external_reference",
    "metadata",
    "submitted_at",
    "approved_at",
    "rejected_at",
    "expires_at",
  ],
  audit_events: ["id", "tenant_id", "actor_user_id", "event_type", "created_at"],
};

const client = new Client({ connectionString: databaseUrl });

async function validateExistingSchema(): Promise<void> {
  const tables = await client.query<{ table_name: string }>(
    `
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
      and table_name = any($1::text[])
    order by table_name
  `,
    [expectedTables],
  );

  const foundTables = new Set(tables.rows.map((row) => row.table_name));
  const missingTables = expectedTables.filter((table) => !foundTables.has(table));
  if (missingTables.length > 0) {
    throw new Error(`Existing schema baseline rejected: missing tables: ${missingTables.join(", ")}`);
  }

  const columns = await client.query<{ table_name: string; column_name: string }>(
    `
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = any($1::text[])
  `,
    [Object.keys(requiredColumns)],
  );

  const foundColumns = new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`));
  const missingColumns = Object.entries(requiredColumns).flatMap(([table, names]) =>
    names.filter((name) => !foundColumns.has(`${table}.${name}`)).map((name) => `${table}.${name}`),
  );
  if (missingColumns.length > 0) {
    throw new Error(`Existing schema baseline rejected: missing columns: ${missingColumns.join(", ")}`);
  }

  const rls = await client.query<{
    relname: string;
    relrowsecurity: boolean;
    relforcerowsecurity: boolean;
  }>(
    `
    select c.relname, c.relrowsecurity, c.relforcerowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any($1::text[])
  `,
    [rlsTables],
  );

  const badRls = rls.rows.filter((row) => !row.relrowsecurity || !row.relforcerowsecurity);
  if (badRls.length > 0) {
    throw new Error(
      `Existing schema baseline rejected: RLS/FORCE RLS missing on ${badRls
        .map((row) => row.relname)
        .join(", ")}`,
    );
  }

  const policies = await client.query<{ tablename: string; policy_count: string }>(
    `
    select tablename, count(*)::text as policy_count
    from pg_policies
    where schemaname = 'public'
      and tablename = any($1::text[])
    group by tablename
  `,
    [rlsTables],
  );
  const policyCounts = new Map(policies.rows.map((row) => [row.tablename, Number(row.policy_count)]));
  const missingPolicies = rlsTables.filter(
    (table) => !policyCounts.has(table) || policyCounts.get(table) === 0,
  );
  if (missingPolicies.length > 0) {
    throw new Error(`Existing schema baseline rejected: missing RLS policies: ${missingPolicies.join(", ")}`);
  }

  const primaryKeys = await client.query<{ table_name: string; primary_key_count: string }>(
    `
    select tc.table_name, count(*)::text as primary_key_count
    from information_schema.table_constraints tc
    where tc.table_schema = 'public'
      and tc.constraint_type = 'PRIMARY KEY'
      and tc.table_name = any($1::text[])
    group by tc.table_name
  `,
    [expectedTables],
  );
  const primaryKeyCounts = new Map(
    primaryKeys.rows.map((row) => [row.table_name, Number(row.primary_key_count)]),
  );
  const missingPrimaryKeys = expectedTables.filter((table) => !primaryKeyCounts.has(table));
  if (missingPrimaryKeys.length > 0) {
    throw new Error(
      `Existing schema baseline rejected: missing primary keys: ${missingPrimaryKeys.join(", ")}`,
    );
  }

  const auth0Resolver = await client.query<{
    proname: string;
    prosecdef: boolean;
    proconfig: string[] | null;
  }>(
    `
    select p.proname, p.prosecdef, p.proconfig
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='check_tenant_membership'
      and pg_get_function_identity_arguments(p.oid)='text, uuid'
  `,
  );
  const resolver = auth0Resolver.rows[0];
  if (
    !resolver ||
    !resolver.prosecdef ||
    !resolver.proconfig?.includes("search_path=public, pg_catalog")
  ) {
    throw new Error(
      "Existing schema baseline rejected: canonical Auth0 membership resolver is missing or insecure",
    );
  }

  const auth0Index = await client.query<{ indexname: string }>(
    `
    select indexname
    from pg_indexes
    where schemaname='public'
      and tablename='users'
      and indexname='users_auth0_subject_uidx'
  `,
  );
  if (auth0Index.rows.length !== 1) {
    throw new Error("Existing schema baseline rejected: users_auth0_subject_uidx is missing");
  }

  const tenantScopedFks = await client.query<{ constraint_name: string }>(
    `
    select constraint_name
    from information_schema.table_constraints
    where constraint_schema='public'
      and constraint_type='FOREIGN KEY'
      and constraint_name in (
        'drivers_carrier_same_tenant_fkey',
        'vehicles_driver_same_tenant_fkey'
      )
  `,
  );
  if (tenantScopedFks.rows.length !== 2) {
    throw new Error(
      "Existing schema baseline rejected: canonical tenant-scoped driver/vehicle foreign keys are incomplete",
    );
  }

  console.log("existing schema baseline validation passed");
}

try {
  await client.connect();
  await client.query(`
    create table if not exists public.schema_migrations (
      version text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);

  const files = (await readdir(migrationsDir))
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort();
  const migrationChecksums = new Map<string, string>();

  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), "utf8");
    migrationChecksums.set(file, createHash("sha256").update(sql).digest("hex"));
  }

  if (allowExistingSchemaBaseline) {
    await client.query("begin");
    try {
      await client.query("select pg_advisory_xact_lock(hashtext('tms:schema-migrations'))");
      const result = await client.query<{ count: string }>(
        "select count(*)::text as count from public.schema_migrations",
      );

      if (Number(result.rows[0]?.count ?? 0) === 0) {
        await validateExistingSchema();
        for (const [file, checksum] of migrationChecksums) {
          await client.query(
            "insert into public.schema_migrations (version, checksum) values ($1, $2)",
            [file, checksum],
          );
        }
        console.log(`registered ${migrationChecksums.size} canonical baseline migrations`);
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }

  for (const [file, checksum] of migrationChecksums) {
    await client.query("begin");
    try {
      await client.query(
        "select pg_advisory_xact_lock(hashtext('tms:schema-migrations'))",
      );

      const result = await client.query<{ checksum: string }>(
        "select checksum from public.schema_migrations where version = $1",
        [file],
      );
      const applied = result.rows[0];

      if (applied) {
        if (applied.checksum !== checksum) {
          throw new Error(`Migration checksum mismatch: ${file}`);
        }
        await client.query("commit");
        continue;
      }

      const sql = await readFile(join(migrationsDir, file), "utf8");
      await client.query(sql);
      await client.query(
        "insert into public.schema_migrations (version, checksum) values ($1, $2)",
        [file, checksum],
      );
      await client.query("commit");
      console.log(`applied ${file}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
} finally {
  await client.end();
}
