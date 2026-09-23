"""Stream safe COPY data through the existing private Docker socket path."""
import hashlib
import selectors
import subprocess
import tempfile

from zone import tld_name
from limits import PILOT


PSQL = ["docker", "compose", "-f", "/opt/regcount-data/compose.yaml",
        "exec", "-T", "db", "psql", "-X", "-U", "regcount_ingest", "-d",
        "regcount", "-v", "ON_ERROR_STOP=1", "-q", "-A", "-t"]


def begin_sql():
    return """BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL idle_in_transaction_session_timeout = '5min';
SET LOCAL statement_timeout = '30min';
DO $$ BEGIN
 IF NOT pg_try_advisory_xact_lock(728341, 1) THEN
   RAISE EXCEPTION 'Another RegCount import is running';
 END IF;
END $$;
CREATE TEMP TABLE incoming (label text COLLATE "C" NOT NULL) ON COMMIT DROP;
COPY incoming(label) FROM STDIN;
"""


def finish_sql(tld, serial, metadata, allow_large_drop=False, limits=PILOT):
    tld = tld_name(tld)
    serial = int(serial)
    digest = metadata["sha256"]
    if len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
        raise ValueError("Invalid SHA-256 metadata")
    fetched = float(metadata["downloaded_at"])
    size = int(metadata["compressed_bytes"])
    table = "z_" + hashlib.sha256(tld.encode()).hexdigest()[:24]
    candidate = table + "_next"
    # Only validated LDH labels, hashes, integers and finite floats are rendered.
    if not 0 < fetched < 1e11 or not 0 < size <= limits.compressed:
        raise ValueError("Invalid download metadata")
    drop_clause = "" if allow_large_drop else """
 IF previous_count IS NOT NULL AND new_count < previous_count * 0.8 THEN
   RAISE EXCEPTION 'Count fell more than 20 percent; retained previous data';
 END IF;
"""
    return f"""CREATE TABLE domain_index.{candidate} (
 label text COLLATE "C" NOT NULL,
 tld text COLLATE "C" NOT NULL DEFAULT '{tld}',
 CHECK (tld = '{tld}')
);
INSERT INTO domain_index.{candidate} (label) SELECT DISTINCT label FROM incoming;
ALTER TABLE domain_index.{candidate} ADD PRIMARY KEY (label, tld);
ANALYZE domain_index.{candidate};
DO $$ DECLARE previous_count bigint; previous_serial bigint; new_count bigint;
BEGIN
 SELECT domain_count, soa_serial INTO previous_count, previous_serial
 FROM domain_index.zones WHERE tld = '{tld}';
 SELECT count(*) INTO new_count FROM domain_index.{candidate};
 IF new_count = 0 THEN RAISE EXCEPTION 'Empty import refused'; END IF;
 {drop_clause}
 IF previous_serial IS NOT NULL AND
    mod({serial}::bigint - previous_serial + 4294967296, 4294967296) >= 2147483648 THEN
   RAISE EXCEPTION 'Older or ambiguous SOA serial; retained previous data';
 END IF;
END $$;
-- The parent is locked only after parsing, sorting and indexing succeed.
LOCK TABLE domain_index.domains IN ACCESS EXCLUSIVE MODE;
DROP TABLE IF EXISTS domain_index.{table};
ALTER TABLE domain_index.{candidate} RENAME TO {table};
ALTER TABLE domain_index.domains ATTACH PARTITION domain_index.{table}
 FOR VALUES IN ('{tld}');
INSERT INTO domain_index.zones
 (tld, soa_serial, domain_count, downloaded_at, sha256, compressed_bytes)
SELECT '{tld}', {serial}, count(*), to_timestamp({fetched}), '{digest}', {size}
 FROM domain_index.{table}
ON CONFLICT (tld) DO UPDATE SET
 soa_serial = excluded.soa_serial, domain_count = excluded.domain_count,
 downloaded_at = excluded.downloaded_at, imported_at = now(),
 sha256 = excluded.sha256, compressed_bytes = excluded.compressed_bytes;
SELECT 'REGCOUNT_READY_TO_COMMIT';
"""


def import_labels(tld, reader, lines, metadata, guard, allow_large_drop=False, limits=PILOT):
    # Stderr goes to a private temporary file, preventing pipe-buffer deadlock.
    with tempfile.TemporaryFile() as errors:
        process = subprocess.Popen(PSQL, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                   stderr=errors, text=True)
        try:
            process.stdin.write(begin_sql())
            for index, label in enumerate(reader.labels(lines)):
                if index % 10000 == 0:
                    guard()
                process.stdin.write(label + "\n")
            guard()
            # This terminator and COMMIT are never sent after parser/CRC failure.
            process.stdin.write("\\.\n")
            process.stdin.write(finish_sql(tld, reader.serial, metadata, allow_large_drop, limits))
            process.stdin.flush()
            with selectors.DefaultSelector() as selector:
                selector.register(process.stdout, selectors.EVENT_READ)
                while True:
                    guard()
                    if not selector.select(timeout=1):
                        continue
                    line = process.stdout.readline()
                    if line.strip() == "REGCOUNT_READY_TO_COMMIT":
                        break
                    if not line:
                        errors.seek(0)
                        raise RuntimeError("Database preparation failed: " + errors.read(2000).decode(errors="replace"))
            guard()
            process.stdin.write("COMMIT;\n")
            process.stdin.write(f"SELECT tld || ': ' || domain_count || ' unique delegated domains imported' FROM domain_index.zones WHERE tld = '{tld_name(tld)}';\n")
            process.stdin.close()
            result_text = process.stdout.read()
            result = process.wait()
            if result:
                errors.seek(0)
                # PostgreSQL messages cannot contain ICANN secrets (never sent).
                raise RuntimeError("Database import failed: " + errors.read(2000).decode(errors="replace"))
            return result_text.strip()
        except BaseException:
            # Killing docker exec alone need not kill psql. EOF closes the
            # database connection without COMMIT, rolling back partial work.
            if not process.stdin.closed:
                try:
                    process.stdin.close()
                except BrokenPipeError:
                    pass
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.terminate()
                process.wait(timeout=10)
            raise
        finally:
            process.stdout.close()
