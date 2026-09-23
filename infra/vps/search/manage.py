"""Root-only control commands. Credentials never enter command arguments."""
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import socket
import subprocess
import sys
import urllib.request

ROOT = Path('/opt/regcount-data/search')
COMPOSE = ['docker', 'compose', '--project-directory', str(ROOT), '--env-file', str(ROOT / '.env'), '-f', str(ROOT / 'compose.yaml')]
PSQL = ['docker', 'compose', '-f', '/opt/regcount-data/compose.yaml', 'exec', '-T', 'db',
        'psql', '-X', '-U', 'regcount_admin', '-d', 'regcount', '-v', 'ON_ERROR_STOP=1', '-Atq']

def sql(query):
    result = subprocess.run(PSQL, input=query, text=True, capture_output=True, timeout=30)
    if result.returncode:
        raise RuntimeError('Database setup/query failed. No credentials were printed.')
    return result.stdout.strip()

def private_file(name):
    path = ROOT / 'secrets' / name
    if path.is_symlink() or not path.is_file() or path.stat().st_uid != 0:
        raise RuntimeError('Missing or untrusted search secret file.')
    value = path.read_text().strip()
    if not re.fullmatch('[a-f0-9]{64}', value):
        raise RuntimeError('Unexpected search secret format.')
    return value

def configure():
    existing = sql("SELECT coalesce((SELECT shobj_description(oid, 'pg_authid') FROM pg_roles WHERE rolname='regcount_search'), '');")
    present = sql("SELECT count(*) FROM pg_roles WHERE rolname='regcount_search';") == '1'
    if present and existing != 'RegCount read-only search v1':
        raise RuntimeError('An unmanaged regcount_search role exists; it was not changed.')
    if present and not (ROOT / 'secrets/db-password').is_file():
        raise RuntimeError('Restore the existing search database secret; it was not replaced.')
    directory = ROOT / 'secrets'
    if directory.is_symlink():
        raise RuntimeError('Secret directory must not be a symbolic link.')
    directory.mkdir(mode=0o700, exist_ok=True)
    os.chmod(directory, 0o700)
    for name in ('db-password', 'api-token'):
        path = directory / name
        if not path.exists():
            # Parent directory is root-only. The mounted file is readable by the
            # unprivileged container account without mounting any other secrets.
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
            with os.fdopen(fd, 'w') as stream:
                stream.write(secrets.token_hex(32) + '\n')
        private_file(name)
        os.chmod(path, 0o644)
    password = private_file('db-password')
    create = '' if present else 'CREATE ROLE regcount_search;'
    sql(f"""BEGIN;
SET LOCAL lock_timeout = '5s';
{create}
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='regcount_search')) THEN
   RAISE EXCEPTION 'Unexpected search role membership';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM domain_index.schema_version WHERE version=1) THEN
   RAISE EXCEPTION 'Unsupported domain index';
 END IF;
END $$;
ALTER ROLE regcount_search LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 6 PASSWORD '{password}';
COMMENT ON ROLE regcount_search IS 'RegCount read-only search v1';
ALTER ROLE regcount_search SET default_transaction_read_only = on;
ALTER ROLE regcount_search SET statement_timeout = '4s';
ALTER ROLE regcount_search SET lock_timeout = '750ms';
ALTER ROLE regcount_search SET idle_in_transaction_session_timeout = '15s';
ALTER ROLE regcount_search SET work_mem = '4MB';
ALTER ROLE regcount_search SET temp_file_limit = '64MB';
GRANT CONNECT ON DATABASE regcount TO regcount_search;
GRANT USAGE ON SCHEMA domain_index TO regcount_search;
GRANT SELECT ON domain_index.domains, domain_index.zones TO regcount_search;
COMMIT;
""")

def request(path, origin='http://127.0.0.1:8787'):
    req = urllib.request.Request(origin + path, headers={'Authorization': 'Bearer ' + private_file('api-token')})
    # No redirects: never forward the API token to another host.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None
    with urllib.request.build_opener(NoRedirect).open(req, timeout=15) as response:
        return json.load(response)

def host():
    path = ROOT / '.env'
    if not path.exists():
        return None
    text = path.read_text().strip()
    if not text:
        return None
    value = text.removeprefix('REGCOUNT_SEARCH_HOST=')
    if text == value or not re.fullmatch(r'(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}', value):
        raise RuntimeError('Invalid managed hostname configuration.')
    return value

def status():
    result = request('/v1/status')
    zones = result['coverage']['zones']
    print(f"Search API ready: {len(zones)} imported extensions; {sum(z['domainCount'] for z in zones):,} domain records.")
    for zone in zones:
        print(f".{zone['tld']}: {zone['domainCount']:,}; downloaded {zone['downloadedAt']}" + ('; older than 72 hours' if zone['stale'] else ''))
    print('Priority extensions not imported: ' + ', '.join('.' + t for t in result['coverage']['requiredMissing']))
    current_host = host()
    if current_host:
        request('/v1/status', 'https://' + current_host)
        print('HTTPS API verified: https://' + current_host)
    else:
        print('Private installation only. Next: add the DNS record, then run regcount-search publish data.regcount.com')

def publish(value):
    if not re.fullmatch(r'(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}', value):
        raise RuntimeError('Provide a fully qualified lowercase hostname.')
    addresses = {item[4][0] for item in socket.getaddrinfo(value, 443, type=socket.SOCK_STREAM)}
    local = json.loads(subprocess.check_output(['ip', '-j', 'address', 'show'], text=True))
    local_addresses = {addr['local'] for iface in local for addr in iface.get('addr_info', [])}
    if not addresses or not addresses.issubset(local_addresses) or not all(ipaddress.ip_address(a).is_global for a in addresses):
        raise RuntimeError('DNS must point directly to this VPS. Use DNS-only mode and remove any incorrect AAAA record, then retry.')
    previous_host = host()
    if previous_host and previous_host != value:
        raise RuntimeError('A different hostname is already configured; review before changing it.')
    running = subprocess.check_output(COMPOSE + ['ps', '-q', 'proxy'], text=True).strip()
    if not running:
        for port in (80, 443):
            with socket.socket() as probe:
                probe.bind(('0.0.0.0', port))
    (ROOT / '.env').write_text('REGCOUNT_SEARCH_HOST=' + value + '\n')
    subprocess.run(COMPOSE + ['--profile', 'public', 'up', '-d', 'proxy'], check=True)
    print('HTTPS proxy started. Certificate issuance can take a few minutes.')
    print('Run regcount-search status to verify HTTPS before connecting the website.')

def main():
    if os.geteuid() != 0:
        raise RuntimeError('Run this command as root on the VPS.')
    command = sys.argv[1] if len(sys.argv) > 1 else 'status'
    if command == '_configure' and len(sys.argv) == 2:
        configure()
    elif command == 'status' and len(sys.argv) <= 2:
        status()
    elif command == 'publish' and len(sys.argv) == 3:
        publish(sys.argv[2])
    elif command == 'hostinger' and len(sys.argv) == 2:
        value = host()
        if not value:
            raise RuntimeError('Publish and verify HTTPS first.')
        request('/v1/status', 'https://' + value)
        print('Copy these into Hostinger server environment variables. Do not share a screenshot of this output.')
        print('REGCOUNT_LIVE_ENABLED=true\nREGCOUNT_DATA_SOURCE=czds')
        print('REGCOUNT_CZDS_API_URL=https://' + value)
        print('REGCOUNT_CZDS_API_TOKEN=' + private_file('api-token'))
    else:
        raise RuntimeError('Usage: regcount-search [status | publish HOSTNAME | hostinger]')

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Only our fixed operational messages may be displayed; library errors
        # can contain addresses or response contents and are deliberately terse.
        print('ERROR: ' + (str(error) if type(error) is RuntimeError else type(error).__name__ + ': operation did not complete.'), file=sys.stderr)
        sys.exit(1)
