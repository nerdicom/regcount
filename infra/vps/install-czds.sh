#!/usr/bin/env bash
# Install a reviewed, commit-pinned CZDS pilot without changing DB networking.
set -Eeuo pipefail
umask 077
readonly root=/opt/regcount-data
readonly target="$root/czds"
readonly marker=regcount-czds-v1
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
[[ $EUID -eq 0 ]] || fail 'Run as root in the VPS terminal.'
[[ ${1:-} =~ ^[0-9a-f]{40}$ ]] || fail 'Provide the reviewed 40-character Git commit SHA.'
readonly revision=$1
for program in python3 docker curl flock sha256sum; do
  command -v "$program" >/dev/null || fail "Missing required command: $program"
done
python3 -c 'import sys; sys.exit(sys.version_info < (3, 11))' || fail 'Python 3.11 or newer is required.'
[[ ! -L "$root" && -f "$root/.managed-by" ]] || fail 'Install the RegCount database foundation first.'
[[ $(<"$root/.managed-by") == regcount-database-v1 ]] || fail 'Unknown database installation.'
[[ ! -L "$target" ]] || fail 'Importer directory cannot be a symbolic link.'
if [[ -e "$target" ]]; then
  [[ -f "$target/.managed-by" && $(<"$target/.managed-by") == "$marker" ]] || fail 'Existing importer directory is not managed; nothing replaced.'
  [[ $(stat -c '%a:%u' "$target") == 700:0 ]] || fail 'Importer directory must be root-owned, mode 700.'
else
  install -d -m 700 "$target"
  printf '%s\n' "$marker" > "$target/.managed-by"
fi
exec 9>"$target/run.lock"
flock -n 9 || fail 'Another CZDS command is running.'
install -d -m 700 "$target/cache"
stage=$(mktemp -d "$target/.install.XXXXXX")
trap 'rm -rf "$stage"' EXIT
readonly base="https://raw.githubusercontent.com/nerdicom/regcount/$revision/infra/vps/czds"
for file in zone.py limits.py database.py regcount-czds.py schema.sql SHA256SUMS; do
  curl --proto '=https' --tlsv1.2 -fsS --connect-timeout 20 --max-time 120 "$base/$file" -o "$stage/$file"
done
(cd "$stage" && sha256sum --check --strict SHA256SUMS)
python3 -m py_compile "$stage/zone.py" "$stage/limits.py" "$stage/database.py" "$stage/regcount-czds.py"
rm -rf "$stage/__pycache__"
psql=(docker compose -f "$root/compose.yaml" exec -T db psql -X -U regcount_admin -d regcount -v ON_ERROR_STOP=1 -Atq)
existing=$("${psql[@]}" -c "SELECT (SELECT count(*) FROM pg_namespace WHERE nspname='domain_index') || ':' || (SELECT count(*) FROM pg_roles WHERE rolname='regcount_ingest');")
if [[ "$existing" == 0:0 ]]; then
  "${psql[@]}" < "$stage/schema.sql"
elif [[ "$existing" == 1:1 ]]; then
  compatible=$("${psql[@]}" -c "SELECT count(*) FROM pg_namespace n JOIN pg_roles r ON n.nspowner=r.oid WHERE n.nspname='domain_index' AND r.rolname='regcount_ingest' AND NOT r.rolsuper AND NOT r.rolcreatedb AND NOT r.rolcreaterole AND (SELECT array_agg(version) FROM domain_index.schema_version)=ARRAY[1];")
  [[ "$compatible" == 1 ]] || fail 'Existing schema is incompatible; no database objects replaced.'
else
  fail 'Partial/conflicting database setup; review before proceeding.'
fi
cat > "$stage/launcher" <<'LAUNCHER'
#!/usr/bin/env bash
set -euo pipefail
exec python3 /opt/regcount-data/czds/app/regcount-czds.py "$@"
LAUNCHER
if [[ -e /usr/local/bin/regcount-czds ]]; then
  [[ ! -L /usr/local/bin/regcount-czds ]] && cmp -s "$stage/launcher" /usr/local/bin/regcount-czds || fail 'Existing launcher differs; it was not overwritten.'
fi
if [[ -e "$target/app" || -L "$target/app" ]]; then
  [[ -L "$target/app" && $(readlink "$target/app") =~ ^release-[0-9a-f]{40}$ && -f "$target/app/SHA256SUMS" ]] || fail 'Unmanaged importer code exists.'
  (cd "$target/app" && sha256sum --check --strict SHA256SUMS) || fail 'Installed code was modified; review before upgrading.'
fi
# Keep credentials, cached downloads and cadence history outside the app folder.
readonly release="$target/release-$revision"
if [[ -e "$release" || -L "$release" ]]; then
  [[ -d "$release" && ! -L "$release" ]] || fail 'Unexpected release path.'
  for file in zone.py limits.py database.py regcount-czds.py schema.sql SHA256SUMS; do
    cmp -s "$stage/$file" "$release/$file" || fail 'Existing release differs; nothing replaced.'
  done
else
  install -d -m 700 "$stage/release"
  for file in zone.py limits.py database.py regcount-czds.py schema.sql SHA256SUMS; do
    install -m 600 "$stage/$file" "$stage/release/$file"
  done
  mv "$stage/release" "$release"
fi
ln -s "release-$revision" "$stage/app"
mv -Tf "$stage/app" "$target/app"
install -m 755 "$stage/launcher" /usr/local/bin/regcount-czds
printf '%s\n' "$revision" > "$target/revision"
printf '\nCZDS pilot installed. No zone files downloaded; no schedule enabled.\n'
if [[ -f "$target/credentials.json" ]]; then
  printf 'Existing credentials, data and download timers preserved.\nNext: regcount-czds capacity app --profile medium\n'
else
  printf 'Next: regcount-czds configure\nThen: regcount-czds approved\n'
fi
