"""Exercise real HTTP/WebSocket transport using the production worker class."""
import asyncio
import socket
import subprocess
import tempfile
import time
import unittest

import requests
import socketio


class TransportTests(unittest.TestCase):
    def test_concurrent_websocket_clients_with_gunicorn(self):
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            port = listener.getsockname()[1]
        url = f'http://127.0.0.1:{port}'
        with tempfile.TemporaryFile(mode='w+') as logs:
            process = subprocess.Popen([
                'gunicorn', '--worker-class', 'gthread', '--threads', '100',
                '-w', '1', '--bind', f'127.0.0.1:{port}', 'wsgi:app',
            ], stdout=logs, stderr=logs)
            try:
                deadline = time.monotonic() + 15
                while time.monotonic() < deadline:
                    try:
                        if requests.get(url + '/health', timeout=1).status_code == 200:
                            break
                    except requests.ConnectionError:
                        pass
                    if process.poll() is not None:
                        self.fail('Gunicorn exited during startup')
                    time.sleep(0.1)
                else:
                    self.fail('Gunicorn did not become healthy')

                async def client_search():
                    client = socketio.AsyncClient()
                    result = asyncio.get_running_loop().create_future()
                    @client.on('search_result', namespace='/email')
                    async def receive(data):
                        if not result.done():
                            result.set_result(data)
                    try:
                        await client.connect(url, namespaces=['/email'], transports=['websocket'])
                        self.assertEqual(client.transport(), 'websocket')
                        await client.emit('search_email', {'input': 'fixture@example.com'}, namespace='/email')
                        payload = await asyncio.wait_for(result, 5)
                        self.assertNotIn('error', payload)
                        self.assertEqual(payload['result']['module'], 'email')
                    finally:
                        await client.disconnect()

                async def concurrent_clients():
                    await asyncio.gather(*(client_search() for _ in range(8)))
                asyncio.run(concurrent_clients())
                self.assertEqual(requests.get(url + '/health', timeout=2).status_code, 200)
            finally:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
            logs.seek(0)
            output = logs.read()
            self.assertNotIn('Traceback', output)
            self.assertNotIn('Cannot run the event loop', output)


if __name__ == '__main__':
    unittest.main()
