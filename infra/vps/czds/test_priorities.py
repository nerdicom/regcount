"""Coverage planning must never mistake approval for an indexed extension."""
import unittest

import priorities
from limits import MEDIUM
import test_automation as queue_helpers
from test_czds import client


class PriorityTests(unittest.TestCase):
    setUp = queue_helpers.QueueTests.setUp
    configure = queue_helpers.QueueTests.configure
    attempt = queue_helpers.QueueTests.attempt
    fake_download = queue_helpers.QueueTests.fake_download
    fake_import = queue_helpers.QueueTests.fake_import

    def test_plan_separates_access_capacity_and_external_sources(self):
        rows = {row['tld']: row['status'] for row in priorities.plan(
            {'com', 'net', 'top'}, [{'tld': 'name', 'profile': 'medium'}], {'dev': {}})}
        self.assertEqual(rows['dev'], 'indexed')
        self.assertEqual(rows['com'], 'capacity-review')
        self.assertEqual(rows['net'], 'ready-to-queue')
        self.assertEqual(rows['top'], 'ready-to-queue')
        self.assertEqual(rows['name'], 'queued-awaiting-access')
        self.assertEqual(rows['ai'], 'external-source-required')
        self.assertEqual(rows['si'], 'external-source-required')

    def test_read_only_plan_and_failed_access_never_mutate(self):
        before = (self.root / 'queue.json').read_bytes()
        self.links.return_value = {'net': 'net-url', 'top': 'top-url'}
        priorities.reconcile(client)
        self.assertEqual((self.root / 'queue.json').read_bytes(), before)
        self.assertFalse(list(self.root.glob('queue-before-*')))
        self.auth.side_effect = client.TransientError('Unavailable')
        with self.assertRaises(client.TransientError):
            priorities.reconcile(client, apply=True)
        self.assertEqual((self.root / 'queue.json').read_bytes(), before)
        self.download.assert_not_called()

    def test_apply_only_approved_bounded_additions_preserves_all_state(self):
        self.links.return_value = {'com': 'com-url', 'net': 'net-url', 'top': 'top-url', 'club': 'club-url', 'brand': 'brand-url'}
        self.attempt('app', 123456)
        client.save_json(self.root / 'queue-state.json', {'version': 1, 'paused': True, 'zones': {'app': {'status': 'review'}}})
        before = {p.name: p.read_bytes() for p in [self.root / 'queue.json', self.root / 'queue-state.json', self.root / 'cache/app.attempt.json']}
        priorities.reconcile(client, apply=True, limit=2)
        configured = client.private_json(self.root / 'queue.json')['zones']
        self.assertEqual([z['tld'] for z in configured], ['app', 'xyz', 'net', 'top'])
        self.assertEqual(configured[-2:], [{'tld': 'net', 'profile': 'medium'}, {'tld': 'top', 'profile': 'medium'}])
        self.assertEqual((self.root / 'queue-state.json').read_bytes(), before['queue-state.json'])
        self.assertEqual((self.root / 'cache/app.attempt.json').read_bytes(), before['app.attempt.json'])
        self.assertEqual(next(self.root.glob('queue-before-*')).read_bytes(), before['queue.json'])
        self.disk.assert_called_with(MEDIUM.start_free)
        self.download.assert_not_called()

    def test_failed_capacity_keeps_queue(self):
        self.links.return_value = {'top': 'top-url'}
        self.disk.side_effect = client.DiskSpaceError('Insufficient capacity')
        before = (self.root / 'queue.json').read_bytes()
        with self.assertRaises(client.DiskSpaceError):
            priorities.reconcile(client, apply=True)
        self.assertEqual((self.root / 'queue.json').read_bytes(), before)
        self.assertFalse(list(self.root.glob('queue-before-*')))

    def test_repeating_plan_does_not_duplicate_existing_entries(self):
        self.links.return_value = {'net': 'net-url', 'top': 'top-url'}
        priorities.reconcile(client, apply=True)
        first = (self.root / 'queue.json').read_bytes()
        priorities.reconcile(client, apply=True)
        self.assertEqual((self.root / 'queue.json').read_bytes(), first)
        self.assertEqual(len(list(self.root.glob('queue-before-*'))), 1)

    def test_invalid_batch_and_full_queue(self):
        for limit in (0, 11):
            with self.assertRaises(client.SafeError):
                priorities.reconcile(client, apply=True, limit=limit)
        self.configure(*('test' + str(n) for n in range(50)))
        self.links.return_value = {'top': 'top-url'}
        priorities.reconcile(client, apply=True)
        self.assertEqual(len(client.private_json(self.root / 'queue.json')['zones']), 50)
        self.download.assert_not_called()

    def test_reindex_uses_only_committed_cache_and_does_not_download(self):
        self.fake_download('app', 'url', 'token', MEDIUM)
        self.fake_import('app', MEDIUM)
        before = (self.root / 'cache/app.attempt.json').read_bytes()
        priorities.reindex(client, 'app')
        self.importer.assert_called_once_with('app', limits=MEDIUM)
        self.auth.assert_not_called()
        self.download.assert_not_called()
        self.assertEqual((self.root / 'cache/app.attempt.json').read_bytes(), before)
        self.current['app']['sha256'] = 'b' * 64
        with self.assertRaisesRegex(client.SafeError, 'differs'):
            priorities.reindex(client, 'app')
        self.assertEqual(self.importer.call_count, 1)

    def test_reindex_refuses_unknown_or_missing_cache(self):
        with self.assertRaises(client.SafeError):
            priorities.reindex(client, 'com')
        self.current['app'] = {'sha256': 'a' * 64, 'downloaded_at': 123}
        with self.assertRaisesRegex(client.SafeError, 'No committed'):
            priorities.reindex(client, 'app')
        self.importer.assert_not_called()

    def test_reindex_accepts_only_timestamp_rounding_not_another_snapshot(self):
        self.fake_download('app', 'url', 'token', MEDIUM)
        path = self.root / 'cache/app.json'
        metadata = client.private_json(path)
        metadata['downloaded_at'] = 1790880320.1234567
        client.save_json(path, metadata)
        self.current['app'] = {**metadata, 'downloaded_at': 1790880320.123457}
        priorities.reindex(client, 'app')
        self.assertEqual(self.importer.call_count, 1)
        self.current['app']['downloaded_at'] = metadata['downloaded_at'] + 1
        with self.assertRaises(client.SafeError):
            priorities.reindex(client, 'app')


if __name__ == '__main__':
    unittest.main()
