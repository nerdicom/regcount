"""Exercise scheduling with a controllable clock and no external services."""
from contextlib import ExitStack, redirect_stdout
import fcntl
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import automation
from limits import MEDIUM
from test_czds import client


NOW = 1790164800


class QueueTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.root = Path(self.stack.enter_context(tempfile.TemporaryDirectory()))
        self.root.chmod(0o700)
        (self.root / "cache").mkdir()
        self.stack.enter_context(patch.object(client, "ROOT", self.root))
        self.clock = self.stack.enter_context(patch.object(automation.time, "time", return_value=NOW))
        self.stack.enter_context(redirect_stdout(io.StringIO()))
        self.current = {}
        self.stack.enter_context(patch.object(automation, "snapshots", side_effect=lambda: dict(self.current)))
        self.disk = self.stack.enter_context(patch.object(client, "disk_guard"))
        self.auth = self.stack.enter_context(patch.object(client, "authenticate", return_value="PRIVATE TOKEN"))
        self.links = self.stack.enter_context(patch.object(client, "approved_links", return_value={"app": "app-url", "xyz": "xyz-url", "org": "org-url"}))
        self.download = self.stack.enter_context(patch.object(client, "download", side_effect=self.fake_download))
        self.importer = self.stack.enter_context(patch.object(client, "import_cache", side_effect=self.fake_import))
        self.configure("app", "xyz")

    def configure(self, *zones):
        client.save_json(self.root / "queue.json", {"version": 1, "zones": [{"tld": tld, "profile": "medium"} for tld in zones]})

    def attempt(self, tld, when):
        client.save_json(self.root / "cache" / (tld + ".attempt.json"), {"attempted_at": when})

    def fake_download(self, tld, url, token, limits):
        self.assertIs(limits, MEDIUM)
        self.attempt(tld, self.clock.return_value)
        metadata = {"tld": tld, "sha256": "a" * 64, "downloaded_at": self.clock.return_value, "compressed_bytes": 20}
        (self.root / "cache" / (tld + ".zone.gz")).write_bytes(b"synthetic complete cache")
        client.save_json(self.root / "cache" / (tld + ".json"), metadata)
        return metadata

    def fake_import(self, tld, limits):
        metadata = client.private_json(self.root / "cache" / (tld + ".json"))
        self.current[tld] = {**metadata, "domain_count": 123}

    def report(self):
        return client.private_json(self.root / "queue-state.json")

    def test_waiting_app_does_not_block_xyz_and_only_one_download_runs(self):
        self.attempt("app", NOW - 3600)
        before = (self.root / "cache/app.attempt.json").read_bytes()
        automation.run(client)
        self.assertEqual(self.download.call_args.args[0], "xyz")
        self.assertEqual(self.download.call_count, 1)
        self.assertEqual(self.report()["zones"]["xyz"]["status"], "ok")
        automation.run(client)
        self.assertEqual(self.download.call_count, 1)
        self.assertEqual((self.root / "cache/app.attempt.json").read_bytes(), before)
        self.clock.return_value = NOW + 86400
        automation.run(client)
        self.assertEqual(self.download.call_args.args[0], "app")

    def test_existing_manual_imports_are_not_redownloaded_early(self):
        self.configure("xyz")
        self.fake_download("xyz", "url", "token", MEDIUM)
        self.fake_import("xyz", MEDIUM)
        automation.run(client)
        self.auth.assert_not_called()
        self.download.assert_not_called()

    def test_complete_uncommitted_cache_imports_without_network(self):
        self.configure("xyz")
        self.fake_download("xyz", "url", "token", MEDIUM)
        automation.run(client)
        self.auth.assert_not_called()
        self.download.assert_not_called()
        self.importer.assert_called_once_with("xyz", limits=MEDIUM)

    def test_bad_zone_is_paused_and_next_zone_continues(self):
        self.importer.side_effect = RuntimeError("Database preparation failed: count drop")
        automation.run(client)
        self.assertEqual(self.report()["zones"]["app"]["status"], "review")
        self.importer.side_effect = self.fake_import
        automation.run(client)
        self.assertEqual([call.args[0] for call in self.download.call_args_list], ["app", "xyz"])
        self.assertEqual(self.report()["zones"]["xyz"]["status"], "ok")

    def test_transfer_failure_keeps_24_hour_backoff(self):
        self.configure("app")
        def failed(*args):
            self.attempt("app", NOW)
            raise client.TransientError("Transfer interrupted")
        self.download.side_effect = failed
        automation.run(client)
        self.clock.return_value = NOW + 3601
        automation.run(client)
        self.assertEqual(self.download.call_count, 1)
        self.assertEqual(self.report()["zones"]["app"]["retry_after"], NOW + 86400)

    def test_low_space_defers_without_consuming_attempt(self):
        self.disk.side_effect = client.DiskSpaceError("low space")
        automation.run(client)
        self.auth.assert_not_called()
        self.download.assert_not_called()
        self.assertEqual(list((self.root / "cache").iterdir()), [])
        self.disk.side_effect = None
        self.clock.return_value = NOW + 901
        automation.run(client)
        self.download.assert_called_once()

    def test_auth_problem_pauses_without_printing_secret_and_can_be_cleared(self):
        self.auth.side_effect = ValueError("PRIVATE TOKEN MUST NOT LEAK")
        automation.run(client)
        self.assertTrue(self.report()["paused"])
        self.assertNotIn("PRIVATE TOKEN", json.dumps(self.report()))
        automation.run(client)
        self.assertEqual(self.auth.call_count, 1)
        automation.retry(client)
        self.assertFalse(self.report()["paused"])

    def test_unapproved_zone_is_deferred_without_downloading(self):
        self.links.return_value = {"xyz": "xyz-url"}
        automation.run(client)
        self.assertEqual(self.report()["zones"]["app"]["status"], "unapproved")
        self.assertEqual(self.download.call_args.args[0], "xyz")

    def test_interruption_after_commit_is_reconciled(self):
        self.configure("app")
        self.fake_download("app", "url", "token", MEDIUM)
        self.fake_import("app", MEDIUM)
        client.save_json(self.root / "queue-state.json", {"version": 1, "zones": {"app": {"status": "running", "expected_sha256": "a" * 64}}})
        automation.run(client)
        self.assertEqual(self.report()["zones"]["app"]["status"], "ok")
        self.download.assert_not_called()

    def test_unknown_interruption_requires_review_and_retry_keeps_timer(self):
        self.configure("app")
        self.attempt("app", NOW)
        client.save_json(self.root / "queue-state.json", {"version": 1, "zones": {"app": {"status": "running"}}})
        automation.run(client)
        self.assertEqual(self.report()["zones"]["app"]["status"], "review")
        automation.retry(client, "app")
        automation.run(client)
        self.download.assert_not_called()
        self.assertEqual(client.private_json(self.root / "cache/app.attempt.json")["attempted_at"], NOW)

    def test_queue_avoids_overlap_but_progress_and_disable_remain_available(self):
        with (self.root / "run.lock").open("w") as lock, patch.dict(sys.modules, {"client": client}), patch.object(client.signal, "signal"):
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with patch.object(sys, "argv", ["regcount-czds", "queue-run"]):
                client.main()
            self.download.assert_not_called()
            with patch.object(sys, "argv", ["regcount-czds", "progress"]), patch.object(automation, "progress") as progress:
                client.main()
                progress.assert_called_once_with(client)
            with patch.object(sys, "argv", ["regcount-czds", "automate", "--disable"]), patch.object(automation, "enable") as enable:
                client.main()
                enable.assert_called_once_with(client, disable=True)

    def test_enable_preserves_existing_config_and_timers_and_refuses_custom_units(self):
        units = self.root / "units"
        units.mkdir()
        client.save_json(self.root / "credentials.json", {"username": "fixture", "password": "private"})
        self.attempt("app", NOW)
        before = (self.root / "queue.json").read_bytes()
        with patch.object(automation, "UNIT_DIRECTORY", units), patch.object(automation.subprocess, "run") as systemctl:
            automation.enable(client)
            automation.enable(client)
            self.assertEqual((self.root / "queue.json").read_bytes(), before)
            self.assertEqual(client.private_json(self.root / "cache/app.attempt.json")["attempted_at"], NOW)
            self.assertIn("Persistent=true", (units / automation.TIMER).read_text())
            (units / automation.SERVICE).write_text("Unrelated service")
            calls = systemctl.call_count
            with self.assertRaises(client.SafeError):
                automation.enable(client)
            self.assertEqual(systemctl.call_count, calls)
            self.assertEqual((units / automation.SERVICE).read_text(), "Unrelated service")

    def test_database_failure_defers_without_auth_or_download(self):
        with patch.object(automation, "snapshots", side_effect=subprocess.TimeoutExpired("psql", 30)):
            automation.run(client)
        self.assertIn("Cannot read database status", self.report()["error"])
        self.auth.assert_not_called()
        self.download.assert_not_called()

    def test_invalid_queue_fails_before_network(self):
        self.configure("app", "app")
        with self.assertRaises(client.SafeError):
            automation.run(client)
        self.auth.assert_not_called()

    def test_broken_cache_does_not_block_other_zones(self):
        (self.root / 'cache/app.zone.gz').write_bytes(b'broken')
        client.save_json(self.root / 'cache/app.json', {"tld": "wrong-zone"})
        automation.run(client)
        self.assertEqual(self.report()["zones"]["app"]["status"], "review")
        self.assertEqual(self.download.call_args.args[0], "xyz")


if __name__ == "__main__":
    unittest.main()
