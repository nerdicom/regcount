"""Reconcile a bounded list of useful extensions with current CZDS access."""
import time

from limits import MEDIUM, PROFILES

# .com needs measured large-zone capacity; ccTLDs need separate sources.
CZDS_PRIORITIES = (
    "com", "net", "org", "xyz", "app", "dev", "top", "info", "biz",
    "online", "shop", "store", "site", "cloud", "tech", "pro", "name",
    "club", "vip", "link", "live", "world", "space", "life", "news",
    "today", "agency", "solutions", "website", "design", "digital",
    "email", "network", "social", "business", "ltd", "one",
)
EXTERNAL_PRIORITIES = ("ai", "io", "si", "co", "me", "tv", "cc", "so", "us",
                       "uk", "co.uk", "de", "ca", "au", "com.au", "in", "cn", "ru")


def plan(approved, zones, imported):
    queued = {item["tld"] for item in zones}
    rows = []
    for tld in CZDS_PRIORITIES + EXTERNAL_PRIORITIES:
        if tld in imported:
            status = "indexed"
        elif tld in queued:
            status = "queued" if tld in approved else "queued-awaiting-access"
        elif tld in EXTERNAL_PRIORITIES:
            status = "external-source-required"
        elif tld not in approved:
            status = "approval-required"
        elif tld == "com":
            status = "capacity-review"
        else:
            status = "ready-to-queue"
        rows.append({"tld": tld, "status": status})
    return rows


def reconcile(client, apply=False, limit=10):
    import automation
    if not 1 <= limit <= 10:
        raise client.SafeError("Add between 1 and 10 priority extensions per batch.")
    zones = automation.config(client)
    imported = automation.snapshots()
    approved = client.approved_links(client.authenticate())
    rows = plan(approved, zones, imported)
    for row in rows:
        print(f".{row['tld']}: {row['status']}")
    selected = [row["tld"] for row in rows if row["status"] == "ready-to-queue"][:limit]
    selected = selected[:max(0, 50 - len(zones))]
    if not apply:
        print("Next bounded batch: " + (", ".join("." + tld for tld in selected) or "none"))
        print("Read-only plan. No queue, data, credentials, or download timers changed.")
        return rows
    if not selected:
        print("No approved priority extensions can be added to this bounded queue.")
        return rows
    # A passing budget check is not an assertion that a complete zone will fit.
    # The existing compressed/expanded limits and live disk reserve still apply.
    client.disk_guard(MEDIUM.start_free)
    original = client.private_json(client.ROOT / "queue.json")
    client.save_json(client.ROOT / f"queue-before-priority-{time.time_ns()}.json", original)
    client.save_json(client.ROOT / "queue.json", {
        **original, "zones": zones + [{"tld": tld, "profile": "medium"} for tld in selected],
    })
    print("Added approved priority extensions: " + ", ".join("." + tld for tld in selected))
    print("Existing entries, review flags and download timers preserved. One due zone per scheduled run.")
    print("An extension is covered only after its import commits and appears in the live coverage API.")
    return rows


def reindex(client, tld):
    """Replay exactly the committed snapshot, without another registry download."""
    import automation
    configured = {item['tld']: item['profile'] for item in automation.config(client)}
    current = automation.snapshots().get(tld)
    if tld not in configured or current is None:
        raise client.SafeError("Reindex requires an already imported extension in the existing queue.")
    path = client.ROOT / 'cache' / (tld + '.json')
    if not path.exists():
        raise client.SafeError("No committed snapshot cache. The next normal refresh will build the index.")
    cached = client.private_json(path)
    if cached.get('sha256') != current['sha256'] or float(cached.get('downloaded_at', 0)) != float(current['downloaded_at']):
        raise client.SafeError("Cache differs from the committed snapshot. Reindex did not change live data.")
    # import_cache verifies the file hash, gzip CRC, serial and record-count guard.
    # Its transactional swap includes the new index and preserves download timing.
    client.import_cache(tld, limits=PROFILES[configured[tld]])
