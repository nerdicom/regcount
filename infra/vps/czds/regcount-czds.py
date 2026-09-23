#!/usr/bin/env python3
"""Private, bounded, one-zone CZDS pilot. Python standard library only."""
import argparse
import fcntl
import getpass
import gzip
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

from database import PSQL, import_labels
from zone import ZoneError, ZoneReader, tld_name


ROOT = Path("/opt/regcount-data/czds")
AUTH_URL = "https://account-api.icann.org/api/authenticate"
LINKS_URL = "https://czds-api.icann.org/czds/downloads/links"
MAX_COMPRESSED = 256 * 1024**2
MAX_EXPANDED = 2 * 1024**3
MIN_FREE = 20 * 1024**3
COOLDOWN = 86400
CHUNK = 64 * 1024


class SafeError(RuntimeError):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise SafeError("ICANN redirected the request; endpoint review required.")


def request(url, token=None, payload=None):
    headers = {"Accept": "application/json", "User-Agent": "RegCount-CZDS-pilot/1"}
    if token:
        headers["Authorization"] = "Bearer " + token
    if payload is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=None if payload is None else json.dumps(payload).encode(), headers=headers)
    try:
        # Do not inherit proxy settings that could expose account credentials.
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
        response = opener.open(req, timeout=60)
        if response.status != 200:
            response.close()
            raise SafeError("ICANN returned an unexpected HTTP status.")
        return response
    except urllib.error.HTTPError as exc:
        raise SafeError(f"ICANN HTTP {exc.code}. Check account/access status; credentials were not logged.") from None
    except (urllib.error.URLError, TimeoutError):
        raise SafeError("ICANN connection failed or timed out; credentials were not logged.") from None


def json_response(response):
    with response:
        content = response.read(2 * 1024**2 + 1)
    if len(content) > 2 * 1024**2:
        raise SafeError("ICANN JSON response exceeded its limit.")
    return json.loads(content)


def private_json(path):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or stat.S_IMODE(info.st_mode) != 0o600:
        raise SafeError("Private state must be a root-owned regular file with permissions 600.")
    with path.open() as source:
        return json.load(source)


def save_json(path, value):
    temporary = path.with_suffix(path.suffix + ".tmp")
    with open(temporary, "w", opener=lambda p, flags: os.open(p, flags | os.O_NOFOLLOW, 0o600)) as output:
        json.dump(value, output)
        output.flush()
        os.fsync(output.fileno())
    os.replace(temporary, path)


def configure():
    if not sys.stdin.isatty():
        raise SafeError("Run configure in an interactive terminal.")
    username = input("ICANN account email: ").strip()
    password = getpass.getpass("ICANN password (hidden): ")
    if not username or not password:
        raise SafeError("Email and password are required.")
    credentials = {"username": username, "password": password}
    authenticate(credentials)  # Preserve existing credentials on failure.
    save_json(ROOT / "credentials.json", credentials)
    print("ICANN connection verified. Credentials stored privately on this VPS.")


def authenticate(credentials=None):
    if credentials is None:
        credentials = private_json(ROOT / "credentials.json")
    result = json_response(request(AUTH_URL, payload=credentials))
    token = result.get("accessToken")
    if not isinstance(token, str) or not token or "\n" in token or "\r" in token:
        raise SafeError("ICANN did not return an access token.")
    return token


def approved_links(token):
    result = json_response(request(LINKS_URL, token))
    if not isinstance(result, list):
        raise SafeError("Unexpected ICANN zone-link response.")
    links = {}
    for url in result:
        if not isinstance(url, str):
            raise SafeError("Unexpected ICANN zone-link response.")
        parsed = urllib.parse.urlsplit(url)
        # Send a bearer token only to the documented CZDS service hosts.
        if (parsed.scheme != "https" or parsed.hostname not in {"czds-api.icann.org", "czds-download-api.icann.org"}
                or parsed.port not in (None, 443) or parsed.username or parsed.password or parsed.query or parsed.fragment
                or not parsed.path.startswith("/czds/downloads/") or not parsed.path.endswith(".zone")):
            raise SafeError("Unrecognized ICANN download link; review required.")
        tld = tld_name(parsed.path.rsplit("/", 1)[1][:-5])
        if tld in links:
            raise SafeError("Duplicate ICANN zone links; review required.")
        links[tld] = url
    return links


def disk_guard():
    if shutil.disk_usage(ROOT).free < MIN_FREE:
        raise SafeError("Less than 20 GiB free. Import stopped before commit; review disk usage.")


def check_cooldown(path, now):
    if path.exists():
        previous = float(private_json(path)["attempted_at"])
        if now - previous < COOLDOWN:
            hours = max(0, (COOLDOWN - (now - previous)) / 3600)
            raise SafeError(f"Download attempted within 24 hours. Wait about {hours:.1f} hours, or use import-cache if a completed file exists.")


def download(tld, url, token):
    folder = ROOT / "cache"
    state = folder / (tld + ".attempt.json")
    now = time.time()
    check_cooldown(state, now)
    disk_guard()
    # Persist before requesting data: even interrupted attempts enforce cadence.
    save_json(state, {"attempted_at": now})
    partial = folder / (tld + ".partial")
    digest, count = hashlib.sha256(), 0
    try:
        with request(url, token) as response, partial.open("wb") as output:
            while chunk := response.read(CHUNK):
                count += len(chunk)
                if count > MAX_COMPRESSED:
                    raise SafeError("Zone exceeds the 256 MiB compressed pilot limit; capacity review required.")
                disk_guard()
                output.write(chunk)
                digest.update(chunk)
            output.flush()
            os.fsync(output.fileno())
        if count < 18:
            raise SafeError("ICANN returned an empty or invalid gzip file.")
        metadata = {"tld": tld, "downloaded_at": now, "sha256": digest.hexdigest(), "compressed_bytes": count}
        os.replace(partial, folder / (tld + ".zone.gz"))
        save_json(folder / (tld + ".json"), metadata)
        return metadata
    finally:
        partial.unlink(missing_ok=True)


def zone_lines(path):
    total = 0
    with gzip.open(path, "rb") as source:
        while line := source.readline(65537):
            total += len(line)
            if len(line) > 65536 or total > MAX_EXPANDED:
                raise SafeError("Zone exceeds the bounded pilot parser limits.")
            yield line.decode("utf-8")
    # Reading to EOF verifies gzip trailers, including CRC and truncation.


def import_cache(tld, allow_large_drop=False):
    path = ROOT / "cache" / (tld + ".zone.gz")
    metadata = private_json(ROOT / "cache" / (tld + ".json"))
    if metadata["tld"] != tld or path.stat().st_size > MAX_COMPRESSED:
        raise SafeError("Cached file metadata or size is invalid.")
    disk_guard()
    with path.open("rb") as source:
        digest = hashlib.file_digest(source, "sha256").hexdigest()
    if digest != metadata["sha256"] or path.stat().st_size != metadata["compressed_bytes"]:
        raise SafeError("Cached file checksum failed; nothing imported.")
    print(f"Importing .{tld}; existing data remains available until commit.", flush=True)
    print(import_labels(tld, ZoneReader(tld), zone_lines(path), metadata, disk_guard, allow_large_drop))


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ["configure", "approved", "status"]:
        sub.add_parser(name)
    for name in ["sync", "import-cache"]:
        command = sub.add_parser(name)
        command.add_argument("tld", type=tld_name)
        command.add_argument("--allow-large-drop", action="store_true", help="accept a reviewed >20%% count decrease; does not bypass download cadence")
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise SafeError("Run this tool as root in the VPS terminal.")
    info = ROOT.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != 0 or stat.S_IMODE(info.st_mode) != 0o700:
        raise SafeError("Importer directory must be root-owned with permissions 700.")
    with (ROOT / "run.lock").open("w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SafeError("Another RegCount CZDS command is running.") from None
        if args.command == "configure":
            configure()
        elif args.command == "approved":
            links = approved_links(authenticate())
            print(" ".join("." + tld for tld in sorted(links)))
            print(f"{len(links)} approved download links. No zones downloaded.")
        elif args.command == "status":
            subprocess.run(PSQL + ["-c", "SELECT tld, domain_count, soa_serial, downloaded_at, imported_at FROM domain_index.zones ORDER BY tld"], check=True)
        else:
            if args.command == "sync":
                check_cooldown(ROOT / "cache" / (args.tld + ".attempt.json"), time.time())
                token = authenticate()
                links = approved_links(token)
                if args.tld not in links:
                    raise SafeError("That extension is not in this account's approved downloads.")
                download(args.tld, links[args.tld], token)
            import_cache(args.tld, args.allow_large_drop)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("Stopped. Run status to check the last committed import.")
    except Exception as exc:
        # Only curated errors are printed; no HTTP bodies/tokens or tracebacks.
        if isinstance(exc, (SafeError, ZoneError, RuntimeError)):
            sys.exit("ERROR: " + str(exc))
        sys.exit("ERROR: Operation failed (" + type(exc).__name__ + "). Run status to check the last committed import before retrying.")
