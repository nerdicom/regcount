"""One bounded zone per systemd activation; private durable queue state."""
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import subprocess
import time

from database import PSQL
from limits import PROFILES
from zone import ZoneError, tld_name


DAY = 86400
UNIT_DIRECTORY = Path("/etc/systemd/system")
SERVICE = "regcount-czds-queue.service"
TIMER = "regcount-czds-queue.timer"
DEFAULT_ZONES = [
    {"tld": name, "profile": "pilot" if name in {"dev", "zone"} else "medium"}
    for name in ("app", "xyz", "org", "dev", "zone", "info", "biz", "cloud",
                 "tech", "shop", "online", "site", "store", "pro", "name")
]
UNITS = {
    SERVICE: """# Managed by RegCount CZDS automation v1
[Unit]
Description=RegCount private zone import queue
Wants=network-online.target
After=network-online.target docker.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/regcount-czds queue-run
Environment=PYTHONUNBUFFERED=1
UMask=0077
Nice=10
TimeoutStartSec=3h
TimeoutStopSec=45s
KillMode=mixed
""",
    TIMER: """# Managed by RegCount CZDS automation v1
[Unit]
Description=Check the RegCount import queue every 15 minutes

[Timer]
OnActiveSec=10s
OnCalendar=*-*-* *:00/15:00
AccuracySec=1min
Persistent=true
Unit=regcount-czds-queue.service

[Install]
WantedBy=timers.target
""",
}


def timestamp(value):
    return datetime.fromtimestamp(value, timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def config(client):
    value = client.private_json(client.ROOT / "queue.json")
    zones = value.get("zones")
    if value.get("version") != 1 or not isinstance(zones, list) or not 1 <= len(zones) <= 50:
        raise client.SafeError("Queue configuration must contain 1 to 50 explicit zones and version 1.")
    seen = set()
    for item in zones:
        tld = tld_name(item["tld"])
        if tld != item["tld"] or tld in seen or item["profile"] not in PROFILES:
            raise client.SafeError("Invalid or duplicate zone/profile in queue configuration.")
        seen.add(tld)
    return zones


def state_file(client):
    return client.ROOT / "queue-state.json"


def state(client):
    path = state_file(client)
    value = client.private_json(path) if path.exists() else {"version": 1, "zones": {}}
    if value.get("version") != 1 or not isinstance(value.get("zones"), dict):
        raise client.SafeError("Invalid queue state; review before continuing.")
    return value


def save(client, value):
    value["updated_at"] = time.time()
    client.save_json(state_file(client), value)


def snapshots():
    sql = """SELECT coalesce(json_agg(s), '[]'::json) FROM
 (SELECT tld, domain_count, sha256, extract(epoch FROM downloaded_at) AS downloaded_at
  FROM domain_index.zones ORDER BY tld) s"""
    result = subprocess.run(PSQL + ["-c", sql], check=True, capture_output=True, text=True, timeout=30)
    return {row["tld"]: row for row in json.loads(result.stdout)}


def safe_error(client, exc):
    # No arbitrary exception/HTTP body may place tokens or credentials in state/logs.
    if isinstance(exc, client.SafeError):
        return str(exc)[:1000]
    if isinstance(exc, ZoneError):
        return "Zone parser: " + str(exc)[:1000]
    if isinstance(exc, RuntimeError) and str(exc).startswith(("Database preparation failed:", "Database import failed:")):
        return str(exc)[:1000]  # These errors contain no ICANN credentials.
    return f"{type(exc).__name__}: import did not complete; inspect service logs and current committed status."


def next_download(client, tld, snapshot=None):
    path = client.ROOT / "cache" / (tld + ".attempt.json")
    last = float(client.private_json(path)["attempted_at"]) if path.exists() else 0
    # Also respect a committed snapshot if the attempt file is unavailable.
    last = max(last, float((snapshot or {}).get("downloaded_at", 0)))
    return last + DAY if last else 0


def pending_cache(client, tld, snapshot):
    folder = client.ROOT / "cache"
    path = folder / (tld + ".json")
    if not path.exists() or not (folder / (tld + ".zone.gz")).exists():
        return None
    metadata = client.private_json(path)
    if metadata["tld"] != tld:
        raise client.SafeError("Cache belongs to another zone; review required.")
    if snapshot and metadata["sha256"] == snapshot["sha256"]:
        return None
    if snapshot and float(metadata["downloaded_at"]) < float(snapshot["downloaded_at"]):
        return None
    return metadata


def run(client):
    """Called while holding the same lock used by manual imports and upgrades."""
    zones, report = config(client), state(client)
    if report.get("paused"):
        print("Queue needs attention: " + report.get("error", "Review configuration."), flush=True)
        return
    if time.time() < report.get("retry_after", 0):
        print("Queue connection retry deferred until " + timestamp(report["retry_after"]), flush=True)
        return
    try:
        current = snapshots()
    except Exception as exc:
        report.update(error="Cannot read database status (" + type(exc).__name__ + "). Retrying automatically.",
                      retry_after=time.time() + 900)
        save(client, report)
        print(report["error"], flush=True)
        return
    candidates = []
    for position, item in enumerate(zones):
        tld, snapshot = item["tld"], current.get(item["tld"])
        entry = report["zones"].setdefault(tld, {})
        if entry.get("status") == "running":
            # A process interruption may happen after COMMIT but before saving state.
            if snapshot and entry.get("expected_sha256") == snapshot["sha256"]:
                entry.update(status="ok", error=None, finished_at=time.time())
            else:
                entry.update(status="review", error="Previous worker was interrupted. Check committed status and cache, then use retry for this zone.")
        if entry.get("status") == "review" or time.time() < entry.get("retry_after", 0):
            continue
        try:
            cached = pending_cache(client, tld, snapshot)
            if cached is None and time.time() < next_download(client, tld, snapshot):
                continue
        except Exception as exc:
            entry.update(status="review", error=safe_error(client, exc))
            continue
        candidates.append((snapshot is not None, entry.get("checked_at", 0), position, item, cached))
    save(client, report)
    if not candidates:
        print("No zones due. Waiting zones will be checked automatically.", flush=True)
        return
    candidates.sort(key=lambda row: row[:3])
    links = None
    for _, _, _, item, cached in candidates:
        tld, limits = item["tld"], PROFILES[item["profile"]]
        entry = report["zones"][tld]
        try:
            client.disk_guard(limits.start_free)
        except client.DiskSpaceError as exc:
            report.update(error=safe_error(client, exc), retry_after=time.time() + 900)
            save(client, report)
            print("Queue paused for disk space: " + report["error"], flush=True)
            return
        if cached is None:
            if links is None:
                try:
                    token = client.authenticate()
                    links = client.approved_links(token)
                except Exception as exc:
                    report.update(error=safe_error(client, exc), paused=not isinstance(exc, client.TransientError),
                                  retry_after=time.time() + 3600)
                    save(client, report)
                    print("Queue connection problem: " + report["error"], flush=True)
                    return
            if tld not in links:
                entry.update(status="unapproved", checked_at=time.time(), retry_after=time.time() + DAY,
                             error="Not in the current approved download list. Rechecking access tomorrow.")
                save(client, report)
                continue
        entry.update(status="running", phase="cached import" if cached else "download", checked_at=time.time(),
                     started_at=time.time(), expected_sha256=None, error=None, retry_after=0)
        report.update(error=None, retry_after=0)
        save(client, report)
        print(f"Starting .{tld} ({item['profile']}); one zone per run.", flush=True)
        try:
            metadata = cached or client.download(tld, links[tld], token, limits)
            entry.update(phase="import", expected_sha256=metadata["sha256"])
            save(client, report)
            client.import_cache(tld, limits=limits)
            entry.update(status="ok", phase="complete", finished_at=time.time(), error=None)
        except client.DiskSpaceError as exc:
            entry.update(status="disk", error=safe_error(client, exc), retry_after=time.time() + 900)
        except client.TransientError as exc:
            entry.update(status="retry", error=safe_error(client, exc), retry_after=max(time.time() + 3600, next_download(client, tld)))
        except Exception as exc:
            entry.update(status="review", error=safe_error(client, exc))
        # SIGTERM/KeyboardInterrupt deliberately leave running state for recovery.
        save(client, report)
        print(f".{tld}: {entry['status']}" + (" — " + entry["error"] if entry.get("error") else ""), flush=True)
        return
    print("No approved zones due; access will be checked again automatically.", flush=True)


def progress(client):
    """Read atomic state without blocking on a long-running import."""
    if not (client.ROOT / "queue.json").exists():
        print("Automation is not configured. Run: regcount-czds automate")
        return
    timer = subprocess.run(["systemctl", "is-active", TIMER], capture_output=True, text=True, timeout=15)
    print("Background timer: " + timer.stdout.strip())
    report, current = state(client), snapshots()
    if report.get("error"):
        print("Attention: " + report["error"])
    for item in config(client):
        tld = item["tld"]
        entry, snapshot = report["zones"].get(tld, {}), current.get(tld)
        count = f"{int(snapshot['domain_count']):,} domains" if snapshot else "not imported"
        due = next_download(client, tld, snapshot)
        status = entry.get("status", "waiting" if due > time.time() else "queued")
        if status == "running":
            status += " (" + entry.get("phase", "working") + ")"
        print(f".{tld}: {status}; {count}" + ("; next download " + timestamp(due) if due else ""))
        if entry.get("error"):
            print("  " + entry["error"])
    print("Logs: journalctl -u regcount-czds-queue.service -n 50 --no-pager")


def retry(client, tld=None):
    report = state(client)
    if tld:
        if tld not in {item["tld"] for item in config(client)}:
            raise client.SafeError("That zone is not configured in the queue.")
        report["zones"][tld] = {"status": "queued", "checked_at": time.time()}
    else:
        report.update(paused=False, error=None, retry_after=0)
    save(client, report)
    print("Queue review flag cleared. Existing download timers are unchanged.")


def enable(client, disable=False):
    if disable:
        subprocess.run(["systemctl", "disable", "--now", TIMER], check=True)
        print("Automatic scheduling disabled. An import already running may finish.")
        return
    # Refuse to replace unrelated/custom units, including links to other units.
    for name, content in UNITS.items():
        path = UNIT_DIRECTORY / name
        if path.is_symlink() or (path.exists() and path.read_text() != content):
            raise client.SafeError("Existing automation unit differs; review it before enabling.")
    client.private_json(client.ROOT / "credentials.json")
    path = client.ROOT / "queue.json"
    if not path.exists():
        client.save_json(path, {"version": 1, "zones": DEFAULT_ZONES})
    zones = config(client)
    client.disk_guard()
    for name, content in UNITS.items():
        destination = UNIT_DIRECTORY / name
        temporary = destination.with_suffix(destination.suffix + ".regcount-tmp")
        with open(temporary, "w", opener=lambda p, flags: os.open(p, flags | os.O_NOFOLLOW, 0o644)) as output:
            output.write(content)
            output.flush()
            os.fsync(output.fileno())
        temporary.chmod(0o644)
        os.replace(temporary, destination)
    subprocess.run(["systemctl", "daemon-reload"], check=True)
    subprocess.run(["systemctl", "enable", "--now", TIMER], check=True)
    print(f"Background queue enabled for {len(zones)} extensions. Runs one due zone every 15 minutes; repeats at least 24 hours apart.")
    print("You can close this terminal. Progress: regcount-czds progress")
