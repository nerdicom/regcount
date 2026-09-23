"""Credential/recovery guard checks with a fake Docker CLI; no real daemon needed.

Run as root inside a disposable development container:
    python infra/vps/test-bootstrap.py
Requires PyYAML for the separate Compose structure check.
"""
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unittest

import yaml


SOURCE = Path(__file__).with_name("bootstrap-database.sh").read_text()


class ComposeChecks(unittest.TestCase):
    def test_private_persistent_database(self):
        config = yaml.safe_load(SOURCE.split("<<'COMPOSE'\n", 1)[1].split("\nCOMPOSE", 1)[0])
        db = config["services"]["db"]
        self.assertNotIn("ports", db)
        self.assertNotIn("network_mode", db)
        self.assertTrue(config["networks"]["database"]["internal"])
        self.assertEqual(db["volumes"], ["postgres_data:/var/lib/postgresql/data"])
        self.assertNotIn("POSTGRES_PASSWORD", db["environment"])
        self.assertIn("POSTGRES_PASSWORD_FILE", db["environment"])
        self.assertEqual(db["secrets"], ["postgres_password"])


@unittest.skipUnless(os.geteuid() == 0, "installer expects root; use a disposable root container")
class BootstrapChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="regcount-bootstrap-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.install = self.root / "installation"
        self.volume = self.root / "volume-exists"
        self.script = self.root / "bootstrap.sh"
        self.script.write_text(SOURCE.replace("/opt/regcount-data", str(self.install)).replace(
            "/run/lock/regcount-database-install.lock", str(self.root / "install.lock")))
        bin_dir = self.root / "bin"
        bin_dir.mkdir()
        docker = bin_dir / "docker"
        docker.write_text('''#!/usr/bin/env python3
import os
from pathlib import Path
import sys
args = sys.argv[1:]
volume = Path(os.environ["TEST_VOLUME"])
if args[:2] == ["volume", "inspect"]:
    sys.exit(0 if volume.exists() else 1)
if args[:1] == ["compose"] and "up" in args:
    volume.touch()
if args[:1] == ["compose"] and "exec" in args:
    print("regcount")
''')
        docker.chmod(0o700)
        self.env = dict(os.environ, PATH=str(bin_dir) + os.pathsep + os.environ["PATH"],
                        TEST_VOLUME=str(self.volume))

    def run_installer(self):
        result = subprocess.run(["bash", str(self.script)], env=self.env,
                                capture_output=True, text=True, timeout=15)
        # A failed command must not accidentally echo any existing password.
        secret = self.install / "secrets/postgres-password"
        if secret.exists():
            self.assertNotIn(secret.read_text().strip(), result.stdout + result.stderr)
        return result

    def fresh(self):
        result = self.run_installer()
        self.assertEqual(result.returncode, 0, result.stderr)
        return result

    def test_fresh_install_and_rerun_preserve_secret_and_configuration(self):
        self.fresh()
        secret = self.install / "secrets/postgres-password"
        original = secret.read_bytes()
        self.assertTrue(re.fullmatch(rb"[0-9a-f]{96}\n", original))
        self.assertEqual(secret.stat().st_mode & 0o777, 0o600)
        original_config = (self.install / "compose.yaml").read_bytes()
        self.fresh()
        self.assertEqual(secret.read_bytes(), original)
        self.assertEqual((self.install / "compose.yaml").read_bytes(), original_config)

    def test_existing_volume_without_configuration_is_preserved(self):
        self.volume.touch()
        result = self.run_installer()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("configuration is missing", result.stderr)
        self.assertTrue(self.volume.exists())
        self.assertFalse(self.install.exists())

    def test_missing_secret_is_not_rotated_for_existing_database(self):
        self.fresh()
        secret = self.install / "secrets/postgres-password"
        secret.unlink()
        result = self.run_installer()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("password file is missing", result.stderr)
        self.assertFalse(secret.exists())
        self.assertTrue(self.volume.exists())

    def test_modified_configuration_is_not_replaced(self):
        self.fresh()
        config = self.install / "compose.yaml"
        changed = config.read_text() + "\n# operator change\n"
        config.write_text(changed)
        result = self.run_installer()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("configuration differs", result.stderr)
        self.assertEqual(config.read_text(), changed)

    def test_insecure_password_permissions_fail(self):
        self.fresh()
        secret = self.install / "secrets/postgres-password"
        secret.chmod(0o644)
        result = self.run_installer()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("permissions 600", result.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)
