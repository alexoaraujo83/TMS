#!/usr/bin/env bash
set -Eeuo pipefail

required=(S3_ENDPOINT S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY S3_REGION BACKUP_ENCRYPTION_KEY BACKUP_OBJECT RESTORE_DATABASE_URL)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "missing required environment variable: ${name}" >&2
    exit 2
  fi
done

export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="$S3_REGION"
export PGSSLMODE="${PGSSLMODE:-verify-full}"
export PGSSLROOTCERT="${PGSSLROOTCERT:-system}"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

cipher="$tmp_dir/backup.dump.enc"
plain="$tmp_dir/backup.dump"
toc="$tmp_dir/restore.list"
filtered_toc="$tmp_dir/restore.filtered.list"
manifest="$tmp_dir/manifest.json"

aws --endpoint-url "$S3_ENDPOINT" s3 cp "s3://${S3_BUCKET}/${BACKUP_OBJECT}" "$cipher" --only-show-errors
manifest_object="${BACKUP_OBJECT%/*}/manifest.json"
aws --endpoint-url "$S3_ENDPOINT" s3 cp "s3://${S3_BUCKET}/${manifest_object}" "$manifest" --only-show-errors
python3 - "$manifest" "$BACKUP_OBJECT" <<'PY'
import json, sys
m=json.load(open(sys.argv[1], encoding="utf-8"))
if m.get("object") != sys.argv[2]: raise SystemExit("manifest object does not match selected backup")
for k in ("sha256","bytes","postgres_version","public_table_count","migration_count"):
    if k not in m: raise SystemExit("manifest missing field: "+k)
if len(m["sha256"]) != 64: raise SystemExit("manifest sha256 is invalid")
PY

expected="$(aws --endpoint-url "$S3_ENDPOINT" s3api get-object --bucket "$S3_BUCKET" --key "${BACKUP_OBJECT%.dump.enc}.sha256" "$tmp_dir/remote.sha256" >/dev/null && awk '{print $1}' "$tmp_dir/remote.sha256")"
actual="$(sha256sum "$cipher" | awk '{print $1}')"
manifest_sha="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["sha256"])' "$manifest")"
manifest_bytes="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["bytes"])' "$manifest")"
manifest_pg="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["postgres_version"])' "$manifest")"
manifest_tables="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["public_table_count"])' "$manifest")"
manifest_migrations="$(python3 -c 'import json,sys; m=json.load(open(sys.argv[1])); print("" if m["migration_count"] is None else m["migration_count"])' "$manifest")"

[[ "$actual" == "$expected" ]] || { echo "checksum mismatch" >&2; exit 1; }
[[ "$actual" == "$manifest_sha" ]] || { echo "manifest checksum mismatch" >&2; exit 1; }
remote_size="$(stat -c '%s' "$cipher")"
[[ "$remote_size" == "$manifest_bytes" ]] || { echo "manifest size mismatch: expected=$manifest_bytes actual=$remote_size" >&2; exit 1; }

echo "restore_manifest=verified object=$BACKUP_OBJECT"
echo "restore_checksum=verified sha256=$actual"
echo "restore_bytes=verified bytes=$remote_size"
echo "restore_expected_postgres=$manifest_pg"
echo "restore_expected_public_tables=$manifest_tables"
echo "restore_expected_migrations=${manifest_migrations:-none}"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
  -in "$cipher" -out "$plain" \
  -pass env:BACKUP_ENCRYPTION_KEY

echo "restore_decrypt=verified"

# Neon-managed PostgREST objects are owned by the platform service role on the
# restore branch. Exclude those TOC entries so --clean never attempts to drop
# objects the restore role cannot own. Application/public objects remain in the
# restore and are still validated below.
pg_restore --list "$plain" > "$toc"
grep -Ev '(^|[[:space:]])pgrst([[:space:]]|$)|(^|[[:space:]])pg_session_jwt([[:space:]]|$)' "$toc" > "$filtered_toc"

pg_restore \
  --dbname="$RESTORE_DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  --use-list="$filtered_toc" \
  "$plain"

echo "restore_pg_restore=verified"

target_pg="$(psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "select current_setting('server_version')")"
source_pg_major="$(printf '%s' "$manifest_pg" | cut -d. -f1)"
target_pg_major="$(printf '%s' "$target_pg" | cut -d. -f1)"
[[ "$target_pg_major" == "$source_pg_major" ]] || { echo "postgres major version mismatch: expected=$source_pg_major actual=$target_pg" >&2; exit 1; }
echo "restore_postgres_version=verified source=$manifest_pg target=$target_pg"

table_count="$(psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "select count(*) from information_schema.tables where table_schema = 'public';")"
[[ "$table_count" == "$manifest_tables" ]] || { echo "public table count mismatch: expected=$manifest_tables actual=$table_count" >&2; exit 1; }
echo "restore_public_table_count=verified count=$table_count"

if [[ -n "$manifest_migrations" ]]; then
  count="$(psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "select count(*) from public.schema_migrations" 2>/dev/null || true)"
  [[ "$count" == "$manifest_migrations" ]] || { echo "migration count mismatch: expected=$manifest_migrations actual=$count" >&2; exit 1; }
  echo "restore_migration_count=verified count=$count"
fi

echo "restore_status=verified"
