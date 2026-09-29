"""Exercise installer file/upgrade behavior with mocked HTTP and Docker."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SOURCE = Path(__file__).resolve().parent
REVISION = "a" * 40


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.folder = Path(self.temp.name)
        self.root = self.folder / "data"
        self.root.mkdir(mode=0o700)
        (self.root / ".managed-by").write_text("regcount-database-v1\n")
        (self.root / "compose.yaml").write_text("DO NOT CHANGE\n")
        self.bin = self.folder / "bin"
        self.bin.mkdir()
        self.launcher = self.bin / "regcount-czds"
        self.script = self.folder / "install.sh"
        self.script.write_text((SOURCE.parent / "install-czds.sh").read_text()
                               .replace("/opt/regcount-data", str(self.root))
                               .replace("/usr/local/bin/regcount-czds", str(self.launcher)))
        self.env = {**os.environ, "PATH": str(self.bin) + ":" + os.environ["PATH"],
                    "TEST_SOURCE": str(SOURCE), "TEST_FOLDER": str(self.folder)}
        (self.bin / "curl").write_text("""#!/usr/bin/env python3
import os, pathlib, shutil, sys
args = sys.argv[1:]
url = next(a for a in args if a.startswith('https://'))
source = pathlib.Path(os.environ['TEST_SOURCE']) / url.rsplit('/', 1)[1]
dest = args[args.index('-o') + 1]
shutil.copyfile(source, dest)
if os.environ.get('BREAK_HASH') and source.name == 'zone.py':
    pathlib.Path(dest).write_text('BROKEN')
""")
        (self.bin / "docker").write_text("""#!/usr/bin/env python3
import os, pathlib, sys
state = pathlib.Path(os.environ['TEST_FOLDER']) / 'schema-created'
if '-c' in sys.argv:
    query = sys.argv[sys.argv.index('-c') + 1]
    if 'pg_namespace WHERE' in query:
        print('1:1' if state.exists() else '0:0')
    else:
        print('1')
else:
    sql = sys.stdin.read()
    if 'CREATE ROLE regcount_ingest' not in sql: sys.exit(1)
    state.write_text(sql)
""")
        (self.bin / "curl").chmod(0o755)
        (self.bin / "docker").chmod(0o755)

    def run_installer(self, revision=REVISION, automate=False, **extra):
        args = ["bash", str(self.script), revision] + (["--automate"] if automate else [])
        return subprocess.run(args, env={**self.env, **extra}, capture_output=True, text=True)

    def test_install_rerun_preserves_credentials_cache_and_database(self):
        result = self.run_installer()
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        target = self.root / "czds"
        self.assertTrue((target / "app").is_symlink())
        self.assertEqual((target / "app/zone.py").read_bytes(), (SOURCE / "zone.py").read_bytes())
        (target / "credentials.json").write_text("PRIVATE FIXTURE")
        (target / "cache/test.attempt.json").write_text("KEEP CADENCE")
        result = self.run_installer()
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertEqual((target / "credentials.json").read_text(), "PRIVATE FIXTURE")
        self.assertEqual((target / "cache/test.attempt.json").read_text(), "KEEP CADENCE")
        self.assertEqual((self.root / "compose.yaml").read_text(), "DO NOT CHANGE\n")

    def test_bad_checksum_prevents_schema_install(self):
        result = self.run_installer(BREAK_HASH="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.folder / "schema-created").exists())
        self.assertFalse(self.launcher.exists())

    def test_upgrade_from_previous_manifests_keeps_private_state(self):
        self.assertEqual(self.run_installer().returncode, 0)
        target = self.root / "czds"
        previous = target / "app"
        (target / "credentials.json").write_text("PRIVATE FIXTURE")
        (target / "cache/app.attempt.json").write_text("KEEP TIMER")
        for removed, revision in [(('limits.py', 'automation.py'), 'b' * 40), (('automation.py',), 'c' * 40)]:
            with self.subTest(removed=removed):
                # Model both the original four-file and medium-profile five-file releases.
                manifest = previous / "SHA256SUMS"
                manifest.write_text("\n".join(line for line in manifest.read_text().splitlines() if not line.endswith(removed)) + "\n")
                for name in removed:
                    (previous / name).unlink()
                result = self.run_installer(revision=revision)
                self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
                self.assertEqual(os.readlink(previous), "release-" + revision)
                self.assertTrue((previous / "automation.py").exists())
                self.assertTrue((target / ("release-" + REVISION)).is_dir())
                self.assertEqual((target / "credentials.json").read_text(), "PRIVATE FIXTURE")
                self.assertEqual((target / "cache/app.attempt.json").read_text(), "KEEP TIMER")
                self.assertEqual((self.root / "compose.yaml").read_text(), "DO NOT CHANGE\n")

    def test_automation_flag_dispatches_after_releasing_installer_lock(self):
        # Intercept only automation activation; never install real systemd units.
        shim = self.bin / 'python3'
        shim.write_text(f'''#!{sys.executable}
import fcntl, os, pathlib, sys
if len(sys.argv) > 2 and sys.argv[1].endswith('/regcount-czds.py') and sys.argv[2] == 'automate':
    root = pathlib.Path(os.environ['TEST_FOLDER']) / 'data/czds'
    with (root / 'run.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        (root / 'automation-dispatched').write_text('yes')
else:
    os.execv({sys.executable!r}, [{sys.executable!r}] + sys.argv[1:])
''')
        shim.chmod(0o755)
        fake_systemctl = self.bin / 'systemctl'
        fake_systemctl.write_text('#!/bin/sh\nexit 0\n')
        fake_systemctl.chmod(0o755)
        result = self.run_installer(automate=True)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertEqual((self.root / 'czds/automation-dispatched').read_text(), 'yes')

    def test_unmanaged_directory_is_preserved(self):
        target = self.root / "czds"
        target.mkdir()
        (target / "important").write_text("KEEP")
        result = self.run_installer()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((target / "important").read_text(), "KEEP")

    def test_modified_code_is_preserved(self):
        self.assertEqual(self.run_installer().returncode, 0)
        path = self.root / "czds/app/zone.py"
        path.write_text("LOCAL CHANGES")
        result = self.run_installer()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(path.read_text(), "LOCAL CHANGES")


if __name__ == "__main__":
    unittest.main()
