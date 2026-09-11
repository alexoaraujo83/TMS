import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsDir = join(root, 'migrations');
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const client = new Client({ connectionString: databaseUrl });

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

  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');

    await client.query('begin');
    try {
      await client.query("select pg_advisory_xact_lock(hashtext('tms:schema-migrations'))");

      const result = await client.query<{ checksum: string }>(
        'select checksum from public.schema_migrations where version = $1',
        [file],
      );
      const applied = result.rows[0];

      if (applied) {
        if (applied.checksum !== checksum) {
          throw new Error(`Migration checksum mismatch: ${file}`);
        }
        await client.query('commit');
        continue;
      }

      await client.query(sql);
      await client.query(
        'insert into public.schema_migrations (version, checksum) values ($1, $2)',
        [file, checksum],
      );
      await client.query('commit');
      console.log(`applied ${file}`);
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  }
} finally {
  await client.end();
}
