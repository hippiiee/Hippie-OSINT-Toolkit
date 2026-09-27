"""Runner tests use local subprocess fixtures, never Google or real credentials."""
import asyncio
import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import Mock, patch

from social_networks.google.ghunt_module import GoogleModule


class GhuntRunnerTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.module = GoogleModule()
        self.module.timeout = 2
        self.io = Mock()
        self.event = threading.Event()
        self.output_paths = []
        self.processes = []

    def tearDown(self):
        self.directory.cleanup()

    async def run_fixture(self, body):
        script = self.root / 'fixture.py'
        script.write_text(body)
        spawn = asyncio.create_subprocess_exec
        async def launch(*args, **kwargs):
            output_path = args[args.index('--json') + 1]
            self.output_paths.append(Path(output_path))
            process = await spawn(sys.executable, str(script), output_path, **kwargs)
            self.processes.append(process)
            return process
        with patch('asyncio.create_subprocess_exec', side_effect=launch):
            result = await self.module.search('fixture@example.invalid', self.io, '/google',
                                              room='owner', cancel_event=self.event)
        for process in self.processes:
            self.assertIsNotNone(process.returncode, "Child process leaked")
        for output_path in self.output_paths:
            self.assertFalse(output_path.parent.exists(), 'Temporary directory leaked')
        return result

    async def test_success_delivers_json_to_owner_and_cleans_files(self):
        data = {'PROFILE_CONTAINER': {'profile': {'personId': 'fixture'}}}
        result = await self.run_fixture('import pathlib, sys\npathlib.Path(sys.argv[1]).write_text(' + repr(json.dumps(data)) + ')\n')
        self.assertEqual(result['result']['found'], data)
        self.io.emit.assert_called_once_with('search_result', result, namespace='/google', room='owner')

    async def test_container_error_is_actionable_and_does_not_leak_output(self):
        result = await self.run_fixture('import sys\nprint("secret-token-fixture", file=sys.stderr)\nprint("KeyError: \'container\'", file=sys.stderr)\nsys.exit(1)\n')
        self.assertIn('pinned GHunt dependency', result['error'])
        self.assertNotIn('secret-token-fixture', str(self.io.mock_calls))

    async def test_invalid_credentials_are_classified(self):
        result = await self.run_fixture('import sys\nprint("GHuntInvalidSession: secret fixture", file=sys.stderr)\nsys.exit(1)\n')
        self.assertIn('Reauthenticate', result['error'])

    async def test_no_public_account_is_classified(self):
        result = await self.run_fixture('import sys\nprint("Given information does not match a public Google Account.")\nsys.exit(1)\n')
        self.assertIn('No public Google account', result['error'])

    async def test_invalid_json_is_rejected(self):
        result = await self.run_fixture('import pathlib, sys\npathlib.Path(sys.argv[1]).write_text("not json")\n')
        self.assertIn('invalid JSON', result['error'])

    async def test_missing_output_is_rejected(self):
        result = await self.run_fixture('pass\n')
        self.assertIn('invalid JSON', result['error'])

    async def test_timeout_terminates_subprocess_and_cleans_files(self):
        self.module.timeout = 0.1
        result = await self.run_fixture('import time\ntime.sleep(10)\n')
        self.assertIn('timed out', result['error'])

    async def test_cancelled_search_does_not_launch_process(self):
        self.event.set()
        result = await self.run_fixture('raise RuntimeError("should not run")\n')
        self.assertEqual(result, {'cancelled': True})
        self.assertFalse(self.output_paths)
        self.io.emit.assert_not_called()

    async def test_cancel_during_search_stops_child_without_emitting(self):
        async def cancel():
            await asyncio.sleep(0.1)
            self.event.set()
        cancellation = asyncio.create_task(cancel())
        result = await self.run_fixture('import time\ntime.sleep(10)\n')
        await cancellation
        self.assertEqual(result, {'cancelled': True})
        self.io.emit.assert_not_called()

    async def test_task_cancellation_stops_child_and_cleans_files(self):
        task = asyncio.create_task(self.run_fixture('import time\ntime.sleep(10)\n'))
        while not self.processes:
            await asyncio.sleep(0.01)
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertIsNotNone(self.processes[0].returncode)
        self.assertFalse(self.output_paths[0].parent.exists())
        self.io.emit.assert_not_called()

    async def test_missing_executable_reports_installation_error(self):
        self.module.ghunt_path = str(self.root/'not-installed')
        result = await self.module.search('fixture@example.invalid', self.io, '/google', room='owner')
        self.assertIn('executable is missing', result['error'])


if __name__ == '__main__':
    unittest.main()
