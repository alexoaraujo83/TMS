-- Persist verified backup metadata in PostgreSQL as a structured DR catalog source.

create table if not exists public.backup_manifests (
  backup_id text primary key,
  object_path text not null unique,
  created_at timestamptz not null,
  bytes bigint not null check (bytes > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  postgres_version text not null,
  public_table_count integer not null check (public_table_count >= 0),
  migration_table text,
  migration_count integer check (migration_count is null or migration_count >= 0),
  duration_seconds integer not null check (duration_seconds >= 0),
  integrity_status text not null check (integrity_status in ('verified')),
  retention_status text not null check (retention_status in ('verified')),
  source_run_id bigint,
  source_run_url text,
  source text not null default 'Backup Now',
  manifest_version integer not null default 1,
  recorded_at timestamptz not null default now()
);

create index if not exists backup_manifests_created_at_idx
  on public.backup_manifests (created_at desc);

create index if not exists backup_manifests_sha256_idx
  on public.backup_manifests (sha256);

grant select, insert, update on table public.backup_manifests to tms_app;
