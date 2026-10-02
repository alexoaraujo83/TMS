#!/usr/bin/env bash
set -Eeuo pipefail

required=(NEON_DATABASE_URL S3_ENDPOINT S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY S3_REGION BACKUP_ENCRYPTION_KEY)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "missing required environment variable: ${name}" >&2
    exit 2
  fi
done

retention_days="${BACKUP_RETENTION_DAYS:-14}"
if [[ ! "$retention_days" =~ ^[1-9][0-9]*$ ]]; then
  echo "BACKUP_RETENTION_DAYS must be a positive integer" >&2
  exit 2
fi

export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="$S3_REGION"
export PGSSLMODE="${PGSSLMODE:-verify-full}"
export PGSSLROOTCERT="${PGSSLROOTCERT:-system}"

run_id="$(date -u +%Y%m%dT%H%M%SZ)"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

plain="$tmp_dir/tms-${run_id}.dump"
cipher="$tmp_dir/tms-${run_id}.dump.enc"
sha_file="$tmp_dir/tms-${run_id}.sha256"
remote_sha_file="$tmp_dir/tms-${run_id}.remote.sha256"
manifest="$tmp_dir/tms-${run_id}.json"

start_epoch="$(date +%s)"
echo "backup_start=${run_id}"
echo "retention_days=${retention_days}"

pg_dump --dbname="$NEON_DATABASE_URL" --format=custom --compress=zstd:3 --file="$plain"

postgres_version="$(psql "$NEON_DATABASE_URL" -Atqc 'select current_setting('"'"'server_version'"'"')')"
public_table_count="$(psql "$NEON_DATABASE_URL" -Atqc "select count(*) from information_schema.tables where table_schema = 'public'")"
migration_table="$(psql "$NEON_DATABASE_URL" -Atqc "select table_name from information_schema.tables where table_schema = 'public' and table_name in ('schema_migrations', 'drizzle_migrations') order by case table_name when 'schema_migrations' then 1 else 2 end limit 1")"
migration_count=""
if [[ -n "$migration_table" ]]; then
  migration_count="$(psql "$NEON_DATABASE_URL" -Atqc "select count(*) from public.\"${migration_table}\"")"
fi

db_fingerprint="$(psql "$NEON_DATABASE_URL" -Atqc "select current_database() || '|' || current_user || '|' || coalesce(inet_server_addr()::text, 'local') || '|' || inet_server_port() || '|' || current_setting('server_version')")"
echo "db_fingerprint=${db_fingerprint}"

openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt \
  -in "$plain" -out "$cipher" \
  -pass env:BACKUP_ENCRYPTION_KEY

sha256sum "$cipher" > "$sha_file"
checksum="$(awk '{print $1}' "$sha_file")"
size="$(stat -c '%s' "$cipher")"

object="tms/postgres/${run_id}/tms-${run_id}.dump.enc"
checksum_object="tms/postgres/${run_id}/tms-${run_id}.sha256"
manifest_object="tms/postgres/${run_id}/manifest.json"

cat > "$manifest" <<EOF
{
  "format": "pg_dump-custom+openssl-aes-256-cbc",
  "backup_id": "${run_id}",
  "object": "${object}",
  "sha256": "${checksum}",
  "bytes": ${size},
  "created_at": "${run_id}",
  "pg_sslmode": "${PGSSLMODE}",
  "postgres_version": "${postgres_version}",
  "public_table_count": ${public_table_count},
  "migration_table": "${migration_table}",
  "migration_count": ${migration_count:-null}
}
EOF

aws --endpoint-url "$S3_ENDPOINT" s3 cp "$cipher" "s3://${S3_BUCKET}/${object}" --only-show-errors
aws --endpoint-url "$S3_ENDPOINT" s3 cp "$sha_file" "s3://${S3_BUCKET}/${checksum_object}" --only-show-errors
aws --endpoint-url "$S3_ENDPOINT" s3 cp "$manifest" "s3://${S3_BUCKET}/${manifest_object}" --only-show-errors

remote_size="$(aws --endpoint-url "$S3_ENDPOINT" s3api head-object --bucket "$S3_BUCKET" --key "$object" --query 'ContentLength' --output text)"
if [[ "$remote_size" != "$size" ]]; then
  echo "size verification failed: local_size=${size} remote_size=${remote_size}" >&2
  exit 1
fi

aws --endpoint-url "$S3_ENDPOINT" s3 cp "s3://${S3_BUCKET}/${checksum_object}" "$remote_sha_file" --only-show-errors
remote_checksum="$(awk '{print $1}' "$remote_sha_file")"
if [[ "$remote_checksum" != "$checksum" ]]; then
  echo "checksum verification failed: local_checksum=${checksum} remote_checksum=${remote_checksum}" >&2
  exit 1
fi

cutoff_epoch="$(( $(date -u +%s) - retention_days * 86400 ))"
deleted_runs=0
deleted_objects=0
while IFS= read -r run_prefix; do
  [[ -z "$run_prefix" ]] && continue
  run_id_candidate="${run_prefix#tms/postgres/}"
  run_id_candidate="${run_id_candidate%/}"
  [[ "$run_id_candidate" == "$run_id" ]] && continue
  [[ "$run_id_candidate" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || continue
  run_epoch="$(date -u -d "$run_id_candidate" +%s 2>/dev/null || true)"
  [[ -n "$run_epoch" ]] || continue
  (( run_epoch < cutoff_epoch )) || continue

  run_objects_file="$tmp_dir/${run_id_candidate}.objects"
  aws --endpoint-url "$S3_ENDPOINT" s3api list-objects-v2 \
    --bucket "$S3_BUCKET" \
    --prefix "${run_prefix}" \
    --query 'Contents[].Key' \
    --output text | tr '\t' '\n' | sed '/^None$/d;/^$/d' > "$run_objects_file"

  object_count="$(wc -l < "$run_objects_file")"
  (( object_count > 0 )) || continue

  delete_json="$tmp_dir/${run_id_candidate}.delete.json"
  awk 'BEGIN { printf "{\"Objects\":[" } { if (n++) printf ","; printf "{\"Key\":\"%s\"}", $0 } END { printf "],\"Quiet\":true}" }' "$run_objects_file" > "$delete_json"

  delete_response="$(aws --endpoint-url "$S3_ENDPOINT" s3api delete-objects \
    --bucket "$S3_BUCKET" \
    --delete "file://${delete_json}" \
    --query 'Errors' \
    --output json \
    --only-show-errors)"
  if [[ "$delete_response" != "[]" && "$delete_response" != "null" ]]; then
    echo "retention deletion reported object errors for run ${run_id_candidate}: ${delete_response}" >&2
    exit 1
  fi

  deleted_runs=$((deleted_runs + 1))
  deleted_objects=$((deleted_objects + object_count))
done < <(aws --endpoint-url "$S3_ENDPOINT" s3api list-objects-v2 \
  --bucket "$S3_BUCKET" \
  --prefix "tms/postgres/" \
  --delimiter '/' \
  --query 'CommonPrefixes[].Prefix' \
  --output text | tr '\t' '\n' | sed '/^None$/d;/^$/d')

end_epoch="$(date +%s)"
duration="$((end_epoch - start_epoch))"

source_run_id="${GITHUB_RUN_ID:-}"
source_run_url=""
if [[ -n "${GITHUB_SERVER_URL:-}" && -n "${GITHUB_REPOSITORY:-}" && -n "$source_run_id" ]]; then
  source_run_url="${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${source_run_id}"
fi

psql "$NEON_DATABASE_URL" -v ON_ERROR_STOP=1 \
  --set=backup_id="$run_id" \
  --set=object_path="$object" \
  --set=created_at="$run_id" \
  --set=bytes="$size" \
  --set=sha256="$checksum" \
  --set=postgres_version="$postgres_version" \
  --set=public_table_count="$public_table_count" \
  --set=migration_table="${migration_table}" \
  --set=migration_count="${migration_count:-}" \
  --set=duration_seconds="$duration" \
  --set=source_run_id="$source_run_id" \
  --set=source_run_url="$source_run_url" <<'SQL'
insert into public.backup_manifests (
  backup_id, object_path, created_at, bytes, sha256, postgres_version,
  public_table_count, migration_table, migration_count, duration_seconds,
  integrity_status, retention_status, source_run_id, source_run_url
) values (
  :'backup_id', :'object_path',
  to_timestamp(extract(epoch from to_timestamp(:'created_at', 'YYYYMMDD"T"HH24MISS"Z"'))),
  :'bytes'::bigint, :'sha256', :'postgres_version', :'public_table_count'::integer,
  nullif(:'migration_table', ''), nullif(:'migration_count', '')::integer,
  :'duration_seconds'::integer, 'verified', 'verified',
  nullif(:'source_run_id', '')::bigint, nullif(:'source_run_url', '')
)
on conflict (object_path) do update set
  bytes = excluded.bytes, sha256 = excluded.sha256,
  postgres_version = excluded.postgres_version, public_table_count = excluded.public_table_count,
  migration_table = excluded.migration_table, migration_count = excluded.migration_count,
  duration_seconds = excluded.duration_seconds, integrity_status = excluded.integrity_status,
  retention_status = excluded.retention_status, source_run_id = excluded.source_run_id,
  source_run_url = excluded.source_run_url, recorded_at = now();
SQL

manifest_persisted_count="$(psql "$NEON_DATABASE_URL" -Atqc "select count(*) from public.backup_manifests where backup_id = '$run_id'")"
if [[ "$manifest_persisted_count" != "1" ]]; then
  echo "manifest persistence verification failed: backup_id=${run_id} count=${manifest_persisted_count}" >&2
  exit 1
fi
echo "manifest_persisted=true"
echo "manifest_persisted_count=${manifest_persisted_count}"
echo "backup_id=${run_id}"
echo "object=${object}"
echo "bytes=${size}"
echo "sha256=${checksum}"
echo "duration_seconds=${duration}"
echo "postgres_version=${postgres_version}"
echo "public_table_count=${public_table_count}"
echo "migration_table=${migration_table:-none}"
echo "migration_count=${migration_count:-none}"
echo "manifest_status=recorded"
echo "retention_deleted_objects=${deleted_objects}"
echo "retention_deleted_runs=${deleted_runs}"
echo "backup_status=verified"
echo "retention_status=verified"
