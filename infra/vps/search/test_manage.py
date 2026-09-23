import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('search_manage', Path(__file__).with_name('manage.py'))
manage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(manage)

class ManageTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.root = Path(self.folder.name)
        self.patch = patch.object(manage, 'ROOT', self.root)
        self.patch.start()

    def tearDown(self):
        self.patch.stop()
        self.folder.cleanup()

    def test_new_install_and_rerun_preserve_secrets(self):
        with patch.object(manage, 'sql', side_effect=['', '0', '']) as sql:
            manage.configure()
            statement = sql.call_args.args[0]
            self.assertIn('GRANT SELECT ON domain_index.domains, domain_index.zones', statement)
            self.assertIn('NOSUPERUSER', statement)
        password = (self.root / 'secrets/db-password').read_text()
        token = (self.root / 'secrets/api-token').read_text()
        with patch.object(manage, 'sql', side_effect=['RegCount read-only search v1', '1', '']):
            manage.configure()
        self.assertEqual((self.root / 'secrets/db-password').read_text(), password)
        self.assertEqual((self.root / 'secrets/api-token').read_text(), token)
        self.assertEqual((self.root / 'secrets').stat().st_mode & 0o777, 0o700)

    def test_conflicting_role_and_lost_secret_are_refused(self):
        with patch.object(manage, 'sql', side_effect=['someone else', '1']):
            with self.assertRaisesRegex(RuntimeError, 'unmanaged'):
                manage.configure()
        with patch.object(manage, 'sql', side_effect=['RegCount read-only search v1', '1']):
            with self.assertRaisesRegex(RuntimeError, 'Restore'):
                manage.configure()
        self.assertFalse((self.root / 'secrets').exists())

    def test_wrong_dns_does_not_publish(self):
        with patch.object(manage.socket, 'getaddrinfo', return_value=[(None,None,None,None,('192.0.2.1',443))]), patch.object(manage.subprocess,'check_output',return_value='[]'), patch.object(manage.subprocess,'run') as run:
            with self.assertRaisesRegex(RuntimeError, 'DNS must point'):
                manage.publish('data.regcount.com')
            run.assert_not_called()
        self.assertFalse((self.root / '.env').exists())

    def test_hostname_validation_and_initial_empty_env(self):
        (self.root / '.env').write_text('')
        self.assertIsNone(manage.host())
        for value in ['localhost','https://example.com','$(id).example.com','example.com\nBAD=x']:
            with self.assertRaises(RuntimeError):
                manage.publish(value)

    def test_private_readiness_runs_inside_container(self):
        payload = {'status': 'ready', 'coverage': {'zones': []}}
        result = subprocess.CompletedProcess([], 0, stdout=json.dumps(payload), stderr='')
        with patch.object(manage.subprocess, 'run', return_value=result) as run, patch.object(manage, 'private_file') as secret, patch.object(manage.urllib.request, 'build_opener') as network:
            self.assertEqual(manage.request('/v1/status'), payload)
            call = run.call_args
            self.assertEqual(call.args[0], manage.COMPOSE + ['exec', '-T', 'api', 'node', '--input-type=module', '-'])
            self.assertIn('/v1/status', call.kwargs['input'])
            self.assertIn('readFileSync', call.kwargs['input'])
            self.assertIn("redirect: 'error'", call.kwargs['input'])
            self.assertTrue(call.kwargs['capture_output'])
            self.assertEqual(call.kwargs['timeout'], 20)
            secret.assert_not_called()
            network.assert_not_called()

    def test_private_readiness_errors_are_safe_and_specific(self):
        for code, expected in [(1, 'could not run'), (2, 'database readiness'), (3, 'authentication token')]:
            with self.subTest(code=code), patch.object(manage.subprocess, 'run', return_value=subprocess.CompletedProcess([], code, stdout='sensitive-output', stderr='sensitive-output')):
                with self.assertRaisesRegex(RuntimeError, expected) as error:
                    manage.request('/v1/status')
                self.assertNotIn('sensitive-output', str(error.exception))
        with patch.object(manage.subprocess, 'run', side_effect=subprocess.TimeoutExpired([], 20)):
            with self.assertRaisesRegex(RuntimeError, 'timed out'):
                manage.request('/v1/status')
        for body in ['not JSON', '{}', '[]']:
            with self.subTest(body=body), patch.object(manage.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, stdout=body)):
                with self.assertRaisesRegex(RuntimeError, 'invalid readiness'):
                    manage.request('/v1/status')

if __name__ == '__main__':
    unittest.main()
