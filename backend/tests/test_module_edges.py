"""Provider boundary regressions using synthetic responses and credentials."""
import json
import unittest
from unittest.mock import AsyncMock, Mock, patch

from social_networks.discord.discord_module import DiscordModule
from social_networks.telegram.telegram_module import TelegramModule
from social_networks.tiktok.tiktok_module import TikTokModule


class ModuleEdgeTests(unittest.IsolatedAsyncioTestCase):
    async def test_subdomain_query_includes_certificates_without_an_apex_name(self):
        from domain.subdomains.crtsh_module import CrtshModule
        response = Mock(status_code=200)
        response.json.return_value = [
            {'name_value': 'api.example.com\nwww.example.com'},
            {'name_value': 'api.example.com'},
        ]
        def provider(url, params, timeout):
            # The fixture has certificates for subdomains only, not the apex.
            self.assertEqual(params['q'], '%.example.com')
            return response
        io = Mock()
        with patch('requests.get', side_effect=provider):
            result = await CrtshModule().search('example.com', io, '/subdomains', room='owner')
        self.assertEqual(result['result']['results'], ['api.example.com', 'www.example.com'])
        self.assertEqual(io.emit.call_args.kwargs['room'], 'owner')

    async def test_discord_accepts_missing_optional_profile_fields(self):
        response = Mock(status_code=200)
        response.json.return_value = {'id': 'fixture', 'username': 'fixture', 'created_at': '2020-01-01', 'avatar': None, 'banner': None, 'raw': None}
        io = Mock()
        with patch('requests.get', return_value=response) as get:
            result = await DiscordModule().search('fixture', io, '/discord', room='owner')
        self.assertNotIn('error', result)
        self.assertIsNone(result['result']['results']['avatar_url'])
        self.assertIsNone(result['result']['results']['banner_url'])
        self.assertEqual(get.call_args.kwargs['timeout'], 15)
        self.assertEqual(io.emit.call_args.kwargs['room'], 'owner')

    async def test_tiktok_request_has_timeout_and_routes_result(self):
        response = Mock(status_code=200)
        response.json.return_value = {'username': 'fixture'}
        io = Mock()
        with patch('requests.post', return_value=response) as post:
            result = await TikTokModule().search('fixture', io, '/tiktok', search_type='profile', room='owner')
        self.assertNotIn('error', result)
        self.assertEqual(post.call_args.kwargs['timeout'], 15)
        self.assertEqual(io.emit.call_args.kwargs['room'], 'owner')

    async def test_telegram_photo_never_exposes_bot_token(self):
        module = TelegramModule()
        module.bot_token = 'fixture-secret-token'
        response = AsyncMock()
        response.json.return_value = {'ok': True, 'result': {'id': 1, 'type': 'private', 'username': 'fixture', 'photo': {'big_file_id': 'fixture-photo'}}}
        context = AsyncMock()
        context.__aenter__.return_value = response
        session = AsyncMock()
        session.get = Mock(return_value=context)
        session.__aenter__.return_value = session
        with patch('aiohttp.ClientSession', return_value=session):
            result = await module._bot_api_lookup('fixture')
        session.get.assert_called_once()
        self.assertNotIn(module.bot_token, json.dumps(result))
        merged = module._merge_results(result, {'username': 'fixture', 'photo_url': 'https://cdn.example.invalid/public-photo.jpg'})
        self.assertEqual(merged['photo_url'], 'https://cdn.example.invalid/public-photo.jpg')
        self.assertNotIn(module.bot_token, json.dumps(merged))

    async def test_telegram_network_error_does_not_log_token(self):
        module = TelegramModule()
        module.bot_token = 'fixture-secret-token'
        with patch('aiohttp.ClientSession', side_effect=RuntimeError('https://api.telegram.org/botfixture-secret-token/getChat')), self.assertLogs(module.logger, level='WARNING') as logs:
            self.assertIsNone(await module._bot_api_lookup('fixture'))
        self.assertNotIn(module.bot_token, '\n'.join(logs.output))


if __name__ == '__main__':
    unittest.main()
