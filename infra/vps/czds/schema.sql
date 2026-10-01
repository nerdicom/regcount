-- Executed once as regcount_admin, after the installer checks ownership.
BEGIN;
CREATE ROLE regcount_ingest LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2 PASSWORD NULL;
ALTER ROLE regcount_ingest SET temp_file_limit = '4GB';
GRANT CONNECT, TEMPORARY ON DATABASE regcount TO regcount_ingest;
CREATE SCHEMA domain_index AUTHORIZATION regcount_ingest;
SET ROLE regcount_ingest;
CREATE TABLE domain_index.schema_version (version integer PRIMARY KEY);
INSERT INTO domain_index.schema_version VALUES (1);
CREATE TABLE domain_index.domains (
  label text COLLATE "C" NOT NULL,
  tld text COLLATE "C" NOT NULL,
  PRIMARY KEY (label, tld)
) PARTITION BY LIST (tld);
CREATE TABLE domain_index.zones (
  tld text PRIMARY KEY,
  soa_serial bigint NOT NULL CHECK (soa_serial BETWEEN 0 AND 4294967295),
  domain_count bigint NOT NULL CHECK (domain_count > 0),
  downloaded_at timestamptz NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  sha256 text NOT NULL,
  compressed_bytes bigint NOT NULL
);
COMMIT;
