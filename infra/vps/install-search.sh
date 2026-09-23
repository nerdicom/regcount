#!/usr/bin/env bash
# Install a private search API; HTTPS publication is a separate explicit step.
set -Eeuo pipefail
umask 077
readonly target=/opt/regcount-data/search
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
[[ $EUID -eq 0 ]] || fail 'Run as root on the VPS.'
[[ $# -eq 1 && $1 =~ ^[0-9a-f]{40}$ ]] || fail 'Provide the reviewed 40-character Git commit SHA.'
readonly revision=$1
for program in docker python3 curl flock sha256sum install stat; do
  command -v "$program" >/dev/null || fail "Missing program: $program"
done
[[ ! -L /opt/regcount-data && -f /opt/regcount-data/.managed-by && $(</opt/regcount-data/.managed-by) == regcount-database-v1 ]] || fail 'Install the database foundation first.'
[[ ! -L "$target" ]] || fail 'Search directory must not be a symbolic link.'
if [[ -e "$target" ]]; then
  [[ -f "$target/.managed-by" && $(<"$target/.managed-by") == regcount-search-v1 ]] || fail 'Unmanaged search directory exists.'
  [[ $(stat -c '%a:%u' "$target") == 700:0 ]] || fail 'Search directory must be root-owned, mode 700.'
else
  install -d -m 700 "$target"
  printf 'regcount-search-v1\n' > "$target/.managed-by"
fi
exec 9>"$target/install.lock"
flock -n 9 || fail 'Another search installation is running.'
stage=$(mktemp -d "$target/.install.XXXXXX")
trap 'rm -rf "$stage"' EXIT
readonly base="https://raw.githubusercontent.com/nerdicom/regcount/$revision/infra/vps/search"
files=(database.mjs http.mjs server.mjs manage.py Dockerfile package.json package-lock.json compose.yaml Caddyfile SHA256SUMS)
for file in "${files[@]}"; do
  curl --proto '=https' --tlsv1.2 -fsS --connect-timeout 20 --max-time 120 "$base/$file" -o "$stage/$file"
done
(cd "$stage" && sha256sum --check --strict SHA256SUMS)
python3 -m py_compile "$stage/manage.py"
if [[ -e "$target/app" || -L "$target/app" ]]; then
  [[ -L "$target/app" && $(readlink "$target/app") =~ ^release-[0-9a-f]{40}$ ]] || fail 'Unmanaged code exists.'
  (cd "$target/app" && sha256sum --check --strict SHA256SUMS) || fail 'Installed code was modified.'
fi
if [[ -e "$target/compose.yaml" ]]; then
  [[ ! -L "$target/compose.yaml" ]] && cmp -s "$stage/compose.yaml" "$target/compose.yaml" || fail 'Existing search Compose file differs; review it before upgrading.'
fi
readonly release="$target/release-$revision"
if [[ -e "$release" || -L "$release" ]]; then
  [[ -d "$release" && ! -L "$release" ]] || fail 'Unexpected release path.'
  for file in "${files[@]}"; do
    cmp -s "$stage/$file" "$release/$file" || fail 'Existing release differs.'
  done
else
  install -d -m 700 "$release"
  for file in "${files[@]}"; do install -m 644 "$stage/$file" "$release/$file"; done
fi
cat > "$stage/launcher" <<'LAUNCHER'
#!/usr/bin/env bash
set -euo pipefail
exec python3 /opt/regcount-data/search/app/manage.py "$@"
LAUNCHER
if [[ -e /usr/local/bin/regcount-search ]]; then
  [[ ! -L /usr/local/bin/regcount-search ]] && cmp -s "$stage/launcher" /usr/local/bin/regcount-search || fail 'Unmanaged launcher exists.'
fi
python3 "$stage/manage.py" _configure
ln -s "release-$revision" "$stage/app"
mv -Tf "$stage/app" "$target/app"
install -m 600 "$stage/compose.yaml" "$target/compose.yaml"
install -m 755 "$stage/launcher" /usr/local/bin/regcount-search
if [[ ! -e "$target/.env" ]]; then install -m 600 /dev/null "$target/.env"; fi
docker compose --project-directory "$target" --env-file "$target/.env" -f "$target/compose.yaml" config --quiet
docker compose --project-directory "$target" --env-file "$target/.env" -f "$target/compose.yaml" up -d --build --wait --wait-timeout 180 api
printf '\nPrivate search API installed. Import schedules and existing data preserved.\n'
/usr/local/bin/regcount-search status
