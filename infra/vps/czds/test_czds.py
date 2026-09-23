import gzip
from contextlib import redirect_stdout
from dataclasses import replace
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from database import begin_sql, finish_sql, import_labels
from limits import GIB, MEDIUM, PILOT
from zone import ZoneError, ZoneReader, records, tld_name

spec = importlib.util.spec_from_file_location("client", Path(__file__).with_name("regcount-czds.py"))
client = importlib.util.module_from_spec(spec)
spec.loader.exec_module(client)


def fixture(tld="test", serial=100, names=("alpha", "beta")):
    return (f"$ORIGIN {tld}.\n$TTL 1d\n@ IN SOA ns.{tld}. hostmaster.{tld}. (\n"
            f" {serial} 1h 15m 1w 1d )\n@ IN NS ns.{tld}.\n"
            + "".join(f"{n} IN NS ns1.example.\n    1h IN NS ns2.example.\n" for n in names)
            + f"ns.{tld}. IN A 192.0.2.1\nns.alpha.{tld}. IN AAAA 2001:db8::1\n")


META = {"sha256": "a" * 64, "downloaded_at": 1790100000, "compressed_bytes": 100}


class ParserTests(unittest.TestCase):
    def parse(self, content, tld="test"):
        reader = ZoneReader(tld)
        return list(reader.labels(io.StringIO(content))), reader

    def test_delegations_exclude_glue_and_apex_preserve_duplicates_for_sql(self):
        labels, reader = self.parse(fixture())
        self.assertEqual(labels, ["alpha", "alpha", "beta", "beta"])
        self.assertEqual(reader.serial, 100)

    def test_absolute_case_ttl_order_punycode_and_escapes(self):
        labels, _ = self.parse(fixture(names=()) + "ALPHA.TeSt. IN 3600 NS ns.test.\nxn--bcher-kva 3600 IN NS ns.test.\n\\097bc NS ns.test.\n")
        self.assertEqual(labels, ["alpha", "xn--bcher-kva", "abc"])

    def test_comments_quotes_subdelegation_and_changed_origin(self):
        labels, _ = self.parse(fixture() + 'x TXT "some ; ( text )" ; ignored\n$ORIGIN alpha.test.\nchild NS ns.test.\n')
        self.assertEqual(set(labels), {"alpha", "beta"})

    def test_reject_bad_or_incomplete_zone(self):
        bad = ["alpha IN NS ns.test.\n", fixture(names=()),
               fixture() + "$INCLUDE /etc/passwd\n", fixture() + "$GENERATE 1-10 $ NS ns.test.\n",
               fixture() + "$ORIGIN other.\n", fixture() + "evil.other. NS ns.test.\n",
               fixture() + "x NS ns.test. extra\n", fixture() + "x SOA ns.test. mail.test. 1 2 3 4 5\n",
               fixture() + "@ SOA ns.test. mail.test. 101 2 3 4 5\n", fixture() + "x TXT ( abc\n",
               fixture() + "x TXT \"bad\n", fixture() + "x IN\n"]
        for content in bad:
            with self.subTest(content=content[-60:]), self.assertRaises(ZoneError):
                self.parse(content)

    def test_record_memory_bound(self):
        with self.assertRaises(ZoneError):
            list(records(["x TXT " + "x" * 65536]))

    def test_invalid_tld_never_becomes_sql_or_path(self):
        for value in ["../x", "x'; DROP TABLE x;--", "a.b", "a" * 64, "x\n", "-x"]:
            with self.subTest(value=value), self.assertRaises(ZoneError):
                tld_name(value)


class DownloadTests(unittest.TestCase):
    def test_approved_link_auth_boundary(self):
        valid = "https://czds-download-api.icann.org/czds/downloads/test.zone"
        with patch.object(client, "request", return_value=io.BytesIO(json.dumps([valid]).encode())):
            self.assertEqual(client.approved_links("secret"), {"test": valid})
        for url in ["http://czds-api.icann.org/czds/downloads/test.zone",
                    "https://evil.example/czds/downloads/test.zone",
                    valid + "?token=x", "https://x@czds-api.icann.org/czds/downloads/test.zone"]:
            with self.subTest(url=url), patch.object(client, "request", return_value=io.BytesIO(json.dumps([url]).encode())), self.assertRaises(client.SafeError):
                client.approved_links("secret")

    def test_redirects_are_not_followed(self):
        with self.assertRaises(client.SafeError):
            client.NoRedirect().redirect_request(None, None, 302, "", {}, "https://evil.example")

    def test_cooldown_boundary_and_clock_reversal(self):
        with patch.object(Path, "exists", return_value=True), patch.object(client, "private_json", return_value={"attempted_at": 100000}):
            for now in [99999, 100000, 186399]:
                with self.assertRaises(client.SafeError):
                    client.check_cooldown(Path("test"), now)
            client.check_cooldown(Path("test"), 186400)

    def test_corrupt_gzip_and_expansion_limit(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "test.gz"
            path.write_bytes(gzip.compress(fixture().encode())[:-4])
            with self.assertRaises(EOFError):
                list(client.zone_lines(path))
            path.write_bytes(gzip.compress(fixture().encode()))
            with self.assertRaises(client.SafeError):
                list(client.zone_lines(path, replace(PILOT, expanded=100)))

    def test_failed_download_cleans_partial_and_keeps_cooldown(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "cache").mkdir()
            with patch.object(client, "ROOT", root), patch.object(client, "disk_guard"), patch.object(client, "request", return_value=io.BytesIO(b"x" * 40)):
                with self.assertRaises(client.SafeError):
                    client.download("test", "https://example.invalid", "private-token", replace(PILOT, compressed=20))
                self.assertTrue((root / "cache/test.attempt.json").exists())
                self.assertFalse((root / "cache/test.partial").exists())
                self.assertFalse((root / "cache/test.zone.gz").exists())

    def test_hash_mismatch_never_calls_database(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "cache").mkdir()
            (root / "cache/test.zone.gz").write_bytes(b"x")
            with patch.object(client, "ROOT", root), patch.object(client, "disk_guard"), patch.object(client, "private_json", return_value={**META, "tld": "test"}), patch.object(client, "import_labels") as db:
                with self.assertRaises(client.SafeError):
                    client.import_cache("test")
                db.assert_not_called()

    def test_low_disk_stops(self):
        with patch.object(client.shutil, "disk_usage", return_value=type("Usage", (), {"free": 100})()):
            with self.assertRaises(client.SafeError):
                client.disk_guard()

    def test_preflight_failure_does_not_consume_download_attempt(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "cache").mkdir()
            with patch.object(client, "ROOT", root), patch.object(client, "disk_guard", side_effect=client.SafeError("low disk")), patch.object(client, "request") as request:
                with self.assertRaises(client.SafeError):
                    client.download("app", "https://example.invalid", "private-token", MEDIUM)
                request.assert_not_called()
                self.assertFalse((root / "cache/app.attempt.json").exists())

    def test_database_filesystem_is_checked_separately(self):
        usage = lambda path: type("Usage", (), {"free": 100 * GIB if path == client.ROOT else 10 * GIB})()
        with patch.object(client, "DB_STORAGE", Path("/separate-volume")), patch.object(client.shutil, "disk_usage", side_effect=usage):
            with self.assertRaises(client.SafeError):
                client.disk_guard()

    def test_medium_download_cache_and_parser_use_same_budget(self):
        data = gzip.compress(fixture("app").encode())
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "cache").mkdir()
            with patch.object(client, "ROOT", root), patch.object(client, "disk_guard"), patch.object(client, "request", return_value=io.BytesIO(data)), patch.object(client, "import_labels", return_value="app: 2 unique delegated domains imported") as db, redirect_stdout(io.StringIO()):
                client.download("app", "https://example.invalid", "private-token", MEDIUM)
                client.import_cache("app", limits=MEDIUM)
                args = db.call_args.args
                self.assertIs(args[-1], MEDIUM)
                self.assertEqual(set(args[1].labels(args[2])), {"alpha", "beta"})
                with self.assertRaises(client.SafeError):
                    client.import_cache("app", limits=replace(PILOT, compressed=len(data) - 1))
                self.assertEqual(db.call_count, 1)

    def test_capacity_is_local_and_preserves_cadence(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "cache").mkdir()
            state = root / "cache/app.attempt.json"
            client.save_json(state, {"attempted_at": 1790100000})
            before = state.read_bytes()
            output = io.StringIO()
            with patch.object(client, "ROOT", root), patch.object(client, "DB_STORAGE", root), patch.object(client.time, "time", return_value=1790100010), patch.object(client.shutil, "disk_usage", return_value=type("Usage", (), {"free": 100 * GIB})()), patch.object(client.subprocess, "run") as query, patch.object(client, "request") as request, redirect_stdout(output):
                client.capacity("app", "medium")
            self.assertIn("Disk preflight: PASS", output.getvalue())
            self.assertIn("Download timer: WAIT", output.getvalue())
            self.assertIn("2026-09-23T18:00:00+00:00", output.getvalue())
            self.assertIn("Complete cached file: none", output.getvalue())
            self.assertEqual(state.read_bytes(), before)
            request.assert_not_called()
            self.assertIn("pg_database_size", query.call_args.args[0][-1])


class ProcessTests(unittest.TestCase):
    def test_metadata_limit_matches_selected_profile(self):
        for size in (PILOT.compressed + 1, MEDIUM.compressed):
            meta = {**META, "compressed_bytes": size}
            with self.assertRaises(ValueError):
                finish_sql("app", 100, meta)
            self.assertIn(str(size), finish_sql("app", 100, meta, limits=MEDIUM))
        with self.assertRaises(ValueError):
            finish_sql("app", 100, {**META, "compressed_bytes": MEDIUM.compressed + 1}, limits=MEDIUM)

    def test_parser_failure_never_sends_commit(self):
        class Input(io.StringIO):
            def close(self):
                self.saved = self.getvalue()
                super().close()
        class Process:
            stdin = Input()
            stdout = io.StringIO()
            def wait(self, timeout=None):
                return 0
        process = Process()
        with patch("database.subprocess.Popen", return_value=process):
            with self.assertRaises(ZoneError):
                import_labels("test", ZoneReader("test"), io.StringIO(fixture() + "$INCLUDE x\n"), META, lambda: None)
        self.assertIn("alpha\n", process.stdin.saved)
        self.assertNotIn("COMMIT", process.stdin.saved.replace("ON COMMIT DROP", ""))
        self.assertNotIn("\\.\n", process.stdin.saved)


def sql_cases():
    cases = []
    for name, tld, serial, names, allow in [
        ("initial", "test", 100, ("alpha", "beta"), False),
        ("other", "other", 200, ("alpha",), False),
        ("refresh", "test", 101, ("alpha", "gamma"), False),
        ("large_drop", "test", 102, ("alpha",), False),
        ("old_serial", "test", 99, ("alpha", "beta"), False),
        ("reviewed_drop", "test", 102, ("alpha",), True),
        ("interrupted", "test", 103, ("delta", "epsilon"), False),
    ]:
        reader = ZoneReader(tld)
        labels = list(reader.labels(io.StringIO(fixture(tld, serial, names))))
        cases.append({"name": name, "begin": begin_sql().split("COPY incoming")[0],
                      "copy": "\n".join(labels) + "\n",
                      "finish": finish_sql(tld, reader.serial, META, allow)})
    return cases


if __name__ == "__main__":
    import sys
    if sys.argv[-1] == "--sql-cases":
        print(json.dumps(sql_cases()))
    else:
        unittest.main()
