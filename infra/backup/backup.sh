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
export PGSSLMODE="${PGSSLMODE:-require}"

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

  aws --endpoint-url "$S3_ENDPOINT" s3api delete-objects \
    --bucket "$S3_BUCKET" \
    --delete "file://${delete_json}" \
    --only-show-errors

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
echo "backup_id=${run_id}"
echo "object=${object}"
echo "bytes=${size}"
echo "sha256=${checksum}"
echo "duration_seconds=${duration}"
echo "postgres_version=${postgres_version}"
echo "public_table_count=${public_table_count}"
echo "migration_table=${migration_table:-none}"
echo "migration_count=${migration_count:-none}"
echo "retention_deleted_objects=${deleted_objects}"
echo "retention_deleted_runs=${deleted_runs}"
echo "backup_status=verified"
echo "retention_status=verified"
