"""Offline regressions for search concurrency, delivery and cancellation."""
import asyncio
import sys
import threading
import time
import unittest
from unittest.mock import Mock, patch

import requests
import app as server
from username.whatsmyname.whatsmyname_module import WhatsmynameModule


class RuntimeTests(unittest.TestCase):
    def tearDown(self):
        with server._tasks_lock:
            for event in server._active_tasks.values():
                event.set()
            server._active_tasks.clear()

    def test_overlapping_async_searches_with_executor_and_subprocess(self):
        count = 8
        barrier = threading.Barrier(count)
        results = []

        async def search(*, room, cancel_event):
            await asyncio.to_thread(barrier.wait, 5)
            process = await asyncio.create_subprocess_exec(
                sys.executable, '-c', 'print("ok")', stdout=asyncio.subprocess.PIPE)
            stdout, _ = await process.communicate()
            await asyncio.sleep(0.01)
            results.append((room, stdout.strip(), asyncio.get_running_loop()))

        with patch.object(server.io, 'emit') as emit:
            jobs = [server._spawn_async(search, namespace='/reddit', room=str(i),
                    cancel_event=server._register_task('/reddit', str(i))) for i in range(count)]
            for job in jobs:
                job.join(10)
                self.assertFalse(job.is_alive())
            self.assertEqual(len(results), count)
            self.assertTrue(all(value == b'ok' and loop.is_closed() for _, value, loop in results))
            self.assertEqual(len({id(loop) for _, _, loop in results}), count)
            emit.assert_not_called()
        self.assertFalse(server._active_tasks)

    def test_errors_only_reach_requesting_client(self):
        async def fail(*, room, cancel_event):
            raise ValueError('test failure')
        with patch.object(server.io, 'emit') as emit, self.assertLogs('app', level='ERROR'):
            job = server._spawn_async(fail, namespace='/domain', room='owner',
                                     cancel_event=threading.Event())
            job.join(5)
            emit.assert_called_once_with('search_result', {'error': 'test failure'},
                                         namespace='/domain', room='owner')

    def test_old_completion_does_not_remove_replacement(self):
        old = server._register_task('/reddit', 'client')
        new = server._register_task('/reddit', 'client')
        server._finish_task('/reddit', 'client', old)
        self.assertTrue(old.is_set())
        self.assertIs(server._active_tasks[('/reddit', 'client')], new)

    def test_namespaced_disconnect_cancels_search(self):
        client = server.io.test_client(server.app, namespace='/reddit')
        sid = server.io.server.manager.sid_from_eio_sid(client.eio_sid, '/reddit')
        event = server._register_task('/reddit', sid)
        client.disconnect(namespace='/reddit')
        self.assertTrue(event.is_set())
        self.assertNotIn(('/reddit', sid), server._active_tasks)

    def test_socket_requests_are_private_and_health_stays_available(self):
        clients = [server.io.test_client(server.app, namespace='/email') for _ in range(2)]
        try:
            clients[0].emit(server.se.event('email', 'search'), {'input': 'test@example.com'}, namespace='/email')
            messages = []
            deadline = time.monotonic() + 3
            while not messages and time.monotonic() < deadline:
                messages = clients[0].get_received('/email')
                time.sleep(0.01)
            self.assertTrue(messages)
            self.assertNotIn('error', messages[0]['args'][0])
            self.assertEqual(clients[1].get_received('/email'), [])
            self.assertEqual(server.app.test_client().get('/health').status_code, 200)
            self.assertEqual(server.app.test_client().get('/missing').status_code, 404)
        finally:
            for client in clients:
                client.disconnect(namespace='/email')


class UsernameTests(unittest.TestCase):
    def setUp(self):
        self.module = WhatsmynameModule()
        self.io = Mock()
        self.site = {'name': 'Fixture', 'uri_check': 'https://example.invalid/{account}',
                     'e_string': 'caf\u00e9', 'e_code': 200}

    def check(self, event=None):
        return self.module.check_site(self.site, 'fixture', {}, self.io, '/username', 0, 1, 'owner', event)

    def test_malformed_site_does_not_crash_the_worker(self):
        self.site.pop('uri_check')
        with self.assertLogs('osint.whatsmyname', level='ERROR'):
            self.assertIsNone(self.check())

    def test_timeout_is_handled_without_crashing(self):
        with patch('requests.get', side_effect=requests.Timeout('fixture timeout')), self.assertLogs('osint.whatsmyname', level='WARNING'):
            self.assertIsNone(self.check())
        self.io.emit.assert_not_called()

    def test_non_utf8_response_is_decoded(self):
        response = requests.Response()
        response.status_code = 200
        response._content = 'caf\u00e9'.encode('cp1252')
        response.encoding = 'cp1252'
        response._content_consumed = True
        with patch('requests.get', return_value=response), patch('username.whatsmyname.whatsmyname_module.extract', return_value={}):
            self.assertEqual(self.check()['site_name'], 'Fixture')
        self.io.emit.assert_called_once()

    def test_cancelled_search_makes_no_requests(self):
        event = threading.Event()
        event.set()
        with patch('requests.get') as get:
            result = self.module.search('fixture', self.io, '/username', room='owner', cancel_event=event)
            self.assertEqual(result, {'cancelled': True})
            get.assert_not_called()
        self.io.emit.assert_not_called()

    def test_cancellation_during_request_suppresses_result(self):
        event = threading.Event()
        response = Mock()
        response.__enter__ = Mock(side_effect=lambda: (event.set(), response)[1])
        response.__exit__ = Mock(return_value=False)
        with patch('requests.get', return_value=response):
            self.assertIsNone(self.check(event))
        self.io.emit.assert_not_called()

    def test_unavailable_site_does_not_prevent_completion(self):
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.json.return_value = {'sites': [self.site]}
        with patch('requests.get', side_effect=[response, requests.Timeout('fixture')]), self.assertLogs('osint.whatsmyname', level='WARNING'):
            result = self.module.search('fixture', self.io, '/username', room='owner')
        self.assertEqual(result['result']['status'], 'complete')
        self.assertEqual(result['result']['data']['found_sites'], [])


if __name__ == '__main__':
    unittest.main()
