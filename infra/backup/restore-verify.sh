#!/usr/bin/env bash
set -Eeuo pipefail

required=(S3_ENDPOINT S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY S3_REGION BACKUP_PASSPHRASE BACKUP_OBJECT RESTORE_DATABASE_URL)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "missing required environment variable: ${name}" >&2
    exit 2
  fi
done

export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="$S3_REGION"
export PGSSLMODE="${PGSSLMODE:-require}"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

cipher="$tmp_dir/backup.dump.enc"
plain="$tmp_dir/backup.dump"

aws --endpoint-url "$S3_ENDPOINT" s3 cp "s3://${S3_BUCKET}/${BACKUP_OBJECT}" "$cipher" --only-show-errors

expected="$(aws --endpoint-url "$S3_ENDPOINT" s3api get-object --bucket "$S3_BUCKET" --key "${BACKUP_OBJECT%.dump.enc}.sha256" "$tmp_dir/remote.sha256" >/dev/null && awk '{print $1}' "$tmp_dir/remote.sha256")"
actual="$(sha256sum "$cipher" | awk '{print $1}')"
[[ "$actual" == "$expected" ]] || { echo "checksum mismatch" >&2; exit 1; }

openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
  -in "$cipher" -out "$plain" \
  -pass env:BACKUP_PASSPHRASE

pg_restore --dbname="$RESTORE_DATABASE_URL" --clean --if-exists --no-owner --no-privileges "$plain"

psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "select current_database(), current_schema();"
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "select count(*) from information_schema.tables where table_schema not in ('pg_catalog','information_schema');"

# Optional migration marker validation: set EXPECTED_MIGRATION_COUNT only after
# the production migration inventory has been confirmed for the target restore.
if [[ -n "${EXPECTED_MIGRATION_COUNT:-}" ]]; then
  count="$(psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "select count(*) from public.schema_migrations" 2>/dev/null || true)"
  [[ "$count" == "$EXPECTED_MIGRATION_COUNT" ]] || { echo "migration count mismatch: expected=${EXPECTED_MIGRATION_COUNT} actual=${count}" >&2; exit 1; }
fi

echo "restore_status=verified"
