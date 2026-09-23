#!/usr/bin/env bash
# RegCount VPS database foundation. Run as root on the new Ubuntu VPS.
# Creates no public listener, downloads no zone data, and never prints credentials.
set -Eeuo pipefail
umask 077

readonly install_dir=/opt/regcount-data
readonly project=regcount-data
readonly volume=regcount-postgres-data
readonly marker=regcount-database-v1
readonly image=postgres:17.11-bookworm

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
[[ ${EUID} -eq 0 ]] || fail 'Run this installer as root in the VPS terminal.'
for program in docker openssl flock install mktemp cmp stat; do
  command -v "$program" >/dev/null || fail "Required command is missing: $program"
done
docker info >/dev/null 2>&1 || fail 'Docker is not running or is not accessible.'
docker compose version >/dev/null 2>&1 || fail 'Docker Compose is not installed.'

exec 9>/run/lock/regcount-database-install.lock
flock -n 9 || fail 'Another RegCount database installation is running.'

if [[ -L "$install_dir" ]]; then
  fail "$install_dir must not be a symbolic link."
fi
if [[ -e "$install_dir" ]]; then
  [[ -f "$install_dir/.managed-by" ]] || fail "Existing $install_dir is not managed by this installer; nothing was replaced."
  [[ $(<"$install_dir/.managed-by") == "$marker" ]] || fail 'An incompatible installation already exists; nothing was replaced.'
else
  # Never invent a new password for an existing database volume.
  if docker volume inspect "$volume" >/dev/null 2>&1; then
    fail 'The database volume already exists, but its configuration is missing. Restore the original secrets/configuration first.'
  fi
  if [[ -n $(docker ps -aq --filter "label=com.docker.compose.project=$project") ]]; then
    fail 'Containers already use the RegCount project name. Restore their original configuration first.'
  fi
  install -d -m 700 "$install_dir"
  printf '%s\n' "$marker" > "$install_dir/.managed-by"
fi
install -d -m 700 "$install_dir/secrets"

readonly password_file="$install_dir/secrets/postgres-password"
if [[ ! -e "$password_file" ]]; then
  if docker volume inspect "$volume" >/dev/null 2>&1; then
    fail 'Database password file is missing. Restore it; generating a replacement would not change the existing database password.'
  fi
  password_tmp=$(mktemp "$install_dir/secrets/.password.XXXXXX")
  openssl rand -hex 48 > "$password_tmp"
  chmod 600 "$password_tmp"
  mv "$password_tmp" "$password_file"
fi
[[ -f "$password_file" && ! -L "$password_file" ]] || fail 'The password must be a regular file, not a symbolic link.'
[[ $(stat -c '%a:%u' "$password_file") == 600:0 ]] || fail 'The password file must be owned by root with permissions 600.'
[[ $(stat -c '%s' "$password_file") -eq 97 ]] || fail 'The existing password file has an unexpected format; it was not changed.'
LC_ALL=C grep -Eq '^[0-9a-f]{96}$' "$password_file" || fail 'The existing password file has an unexpected format; it was not changed.'

compose_tmp=$(mktemp "$install_dir/.compose.XXXXXX")
trap 'rm -f "${compose_tmp:-}"' EXIT
cat > "$compose_tmp" <<'COMPOSE'
name: regcount-data
services:
  db:
    image: postgres:17.11-bookworm
    restart: unless-stopped
    stop_grace_period: 120s
    mem_limit: 8g
    shm_size: 1g
    cpus: 2.0
    environment:
      POSTGRES_USER: regcount_admin
      POSTGRES_DB: regcount
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password
      POSTGRES_INITDB_ARGS: --data-checksums --auth-host=scram-sha-256
    secrets:
      - postgres_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - database
    command:
      - postgres
      - -c
      - shared_buffers=1GB
      - -c
      - effective_cache_size=4GB
      - -c
      - maintenance_work_mem=256MB
      - -c
      - work_mem=8MB
      - -c
      - max_connections=40
      - -c
      - max_wal_size=2GB
      - -c
      - password_encryption=scram-sha-256
    healthcheck:
      test: [CMD-SHELL, "pg_isready -U regcount_admin -d regcount"]
      interval: 10s
      timeout: 5s
      retries: 12
      start_period: 30s
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: "3"

secrets:
  postgres_password:
    file: ./secrets/postgres-password

volumes:
  postgres_data:
    name: regcount-postgres-data

networks:
  database:
    name: regcount-database
    internal: true
COMPOSE

if [[ -e "$install_dir/compose.yaml" ]]; then
  cmp -s "$compose_tmp" "$install_dir/compose.yaml" || fail 'The existing Compose configuration differs. Review it before upgrading; it was not overwritten.'
else
  install -m 600 "$compose_tmp" "$install_dir/compose.yaml"
fi

cd "$install_dir"
docker compose -p "$project" config --quiet
printf 'Downloading %s and starting the private RegCount database...\n' "$image"
docker compose -p "$project" pull db
docker compose -p "$project" up -d --wait --wait-timeout 180 db
database_name=$(docker compose -p "$project" exec -T db psql -U regcount_admin -d regcount -v ON_ERROR_STOP=1 -Atc 'SELECT current_database();')
[[ "$database_name" == regcount ]] || fail 'The database did not pass its SQL check.'
docker compose -p "$project" ps
printf '\nRegCount database is ready.\n'
printf 'Database: regcount\nConfiguration: %s/compose.yaml\n' "$install_dir"
printf 'Password: stored privately on this VPS; not displayed.\n'
printf 'Public database ports: none.\n'
printf 'Zone imports, application roles, search API, scheduled jobs, and database backups: not configured yet.\n'
