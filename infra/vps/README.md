# RegCount VPS database foundation

This is the first VPS deployment step for the CZDS data pipeline. The existing
Next.js website continues to use its current provider settings. This installer
does not switch the website to live data or download ICANN zone files.

Once the database is healthy, continue with the [CZDS pilot](czds/README.md)
and `install-czds.sh`. That separate installer adds private zone processing
without changing this foundation's configuration or public networking.

## Target and requirements

- Hostinger KVM 4: 4 vCPU, 16 GB RAM, 200 GB disk.
- Ubuntu with Docker Engine and the Compose plugin already installed.
- Root shell in Hostinger Web Console or SSH.
- Outbound HTTPS access to Docker Hub.

Run `bash infra/vps/bootstrap-database.sh` from a checkout, or download this script
from a specific reviewed Git commit, then run that downloaded file. Do not paste
private SSH keys, ICANN credentials, or generated database passwords into chat or
GitHub. The installer generates its database password on the VPS.

## What the installer creates

| Item | Value |
| --- | --- |
| Docker image | `postgres:17.11-bookworm` |
| Compose project | `regcount-data` |
| Configuration | `/opt/regcount-data/compose.yaml` |
| Secret file | `/opt/regcount-data/secrets/postgres-password` (root, mode 600) |
| Database | `regcount` |
| Administrative database role | `regcount_admin` |
| Persistent Docker volume | `regcount-postgres-data` |
| Internal Docker network | `regcount-database` |
| Public ports | None |

The secret is mounted using Compose secrets and PostgreSQL's
`POSTGRES_PASSWORD_FILE` option; its value is not put in the command line,
Compose YAML, Git repository, or installer output. Compose secrets are local
files, not a separate encrypted vault. VPS root/Docker administrators can access
them. Keep the server and its backups restricted accordingly.

The container can use up to 8 GB RAM and 2 CPU cores, leaving capacity for a
separate importer and API. Settings are initial limits, not a benchmark or a
guarantee that every CZDS zone fits. PostgreSQL's 2 GB `max_wal_size` is a soft
checkpoint target, not a disk quota. Monitor total disk consumption, including
indexes, WAL, temporary files and import staging, before loading large zones.

The installer waits for health and then executes a real SQL query before
reporting success. If a pull or startup fails, rerun the same script after fixing
the reported error. It reuses the existing password and volume. It refuses to
replace a different Compose file or create a new password when an existing
database volume has lost its secret. It never removes a volume.

## Routine checks

Run each command separately in the VPS shell:

```sh
cd /opt/regcount-data
```

```sh
docker compose ps
```

```sh
docker compose exec -T db psql -U regcount_admin -d regcount -c 'SELECT version();'
```

```sh
docker compose logs --tail 50 db
```

Logs can contain database metadata; review before sharing. Do not run
`docker compose down -v` or remove `regcount-postgres-data`: that deletes data.
Normal container recreation/restart keeps the named volume.

## Next deployment stages

1. Apply Ubuntu security updates and confirm recovery access/backup settings.
2. Add importer and API database roles with separate credentials and limited
   privileges. Do not give the public search service the administrative role.
3. Build and test the streaming zone parser against approved CZDS files; count
   unique delegation owners, excluding glue hosts, apex records and duplicates.
4. Add transactional imports with failure recovery, per-zone timestamps and
   disk-space checks. Benchmark smaller zones before `.com` or `.net`.
5. Schedule approved zone downloads no more than once per 24 hours per zone,
   with failures and access-expiry monitoring.
6. Add authenticated HTTPS search API, public-site rate limits, and accurate
   coverage/freshness labels. Zone files show delegated domains, not all
   registrations; absent domains must not be advertised as available.
7. Configure off-server, database-consistent backups of irreplaceable metadata
   and configuration, with a tested restore. Named volumes and host snapshots
   alone are not a verified database backup strategy.
8. Connect Next.js to that API only after validation. No ICANN credentials should
   be exposed to the web browser or the Git repository.

## Validation performed before publishing

- Bash syntax check and Compose configuration structure validation.
- Simulated Docker tests for fresh install, rerun preserving credentials,
  refusing missing secrets for an existing volume, and preserving modified
  configuration.
- This preparation environment has no Docker daemon; a real PostgreSQL startup
  and SQL check must pass on the VPS before considering this installation done.

## References

- [Official PostgreSQL image](https://hub.docker.com/_/postgres)
- [Docker Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/)
- [PostgreSQL version policy](https://www.postgresql.org/support/versioning/)
