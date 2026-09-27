#!/usr/bin/env bash
set -euo pipefail

pg_dump_bin="$(command -v pg_dump || true)"
if [[ -z "$pg_dump_bin" && -x /opt/homebrew/opt/libpq/bin/pg_dump ]]; then
  pg_dump_bin=/opt/homebrew/opt/libpq/bin/pg_dump
fi

if [[ -z "$pg_dump_bin" || ! -x "$pg_dump_bin" ]]; then
  printf '%s\n' 'pg_dump tidak ditemukan. Install PostgreSQL client (contoh macOS: brew install libpq).'
  exit 1
fi

printf '%s' 'Paste Supabase database connection string (input disembunyikan): '
read -r -s database_url
printf '\n'

if [[ "$database_url" != postgres://* && "$database_url" != postgresql://* ]]; then
  printf '%s\n' 'Connection string harus diawali postgres:// atau postgresql://.'
  exit 1
fi

timestamp="$(date '+%Y%m%d_%H%M%S')"
backup_dir="backups"
output_file="$backup_dir/supabase_public_$timestamp.sql"
mkdir -p "$backup_dir"

"$pg_dump_bin" \
  --dbname="$database_url" \
  --schema=public \
  --no-owner \
  --no-privileges \
  --format=plain \
  --file="$output_file"

printf 'Backup selesai: %s\n' "$output_file"
printf '%s\n' 'Isi dump: schema dan data dalam schema public. Auth users dan file Storage tidak termasuk.'