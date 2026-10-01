"""Public profile parsing and provider failure regressions; no network required."""
import json
import threading
import unittest
from unittest.mock import Mock, patch

import requests

from social_networks.tiktok.tiktok_module import TikTokModule


def page(user=None, stats=None, status=0):
    detail = {'statusCode': status, 'userInfo': {
        'user': user if user is not None else {'id': '123', 'uniqueId': 'fixture'},
        'stats': stats,
    }}
    return ('<script>unrelated</script><script type="application/json" '
            'id="__UNIVERSAL_DATA_FOR_REHYDRATION__">'
            + json.dumps({'__DEFAULT_SCOPE__': {'webapp.user-detail': detail}})
            + '</script>')


class TikTokTests(unittest.IsolatedAsyncioTestCase):
    def test_profile_maps_existing_frontend_contract(self):
        result = TikTokModule.parse_public_profile(page({
            'id': '7123456789012345678', 'uniqueId': 'fixture', 'nickname': 'Example',
            'signature': 'A & B', 'avatarLarger': 'https://example.com/avatar.jpg',
            'region': 'FR', 'language': 'fr', 'createTime': 1609459200,
        }, {'followerCount': 42, 'followingCount': 0, 'heartCount': 80,
            'videoCount': 3, 'friendCount': 0}))
        self.assertEqual(result['userId'], '7123456789012345678')
        self.assertEqual(result['nickname'], 'Example')
        self.assertEqual(result['about'], 'A & B')
        self.assertEqual(result['region'], 'FR')
        self.assertEqual(result['accountCreated'], '2021-01-01T00:00:00+00:00')
        self.assertEqual(result['stats'], {
            'followers': '42', 'following': '0', 'hearts': '80', 'videos': '3', 'friends': '0',
        })

    def test_missing_fields_are_not_invented(self):
        result = TikTokModule.parse_public_profile(page())
        self.assertEqual(result['nickname'], 'fixture')
        self.assertEqual(result['region'], '')
        self.assertEqual(result['accountCreated'], 'Unknown')
        self.assertEqual(result['stats']['followers'], 'Unknown')

    def test_unavailable_or_changed_pages_fail_cleanly(self):
        for html in [page(status=10221), page(user={}), '<html>Challenge</html>',
                     '<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">{bad</script>',
                     '<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">[]</script>']:
            with self.subTest(html=html), self.assertRaises(ValueError):
                TikTokModule.parse_public_profile(html)

    async def test_lookup_normalizes_username_and_routes_result(self):
        io = Mock()
        with patch('requests.get', return_value=Mock(status_code=200, text=page())) as get:
            result = await TikTokModule().search(' @fixture ', io, '/tiktok', search_type='profile', room='owner')
        self.assertEqual(get.call_args.args[0], 'https://www.tiktok.com/@fixture')
        self.assertEqual(result['result']['profile']['username'], 'fixture')
        io.emit.assert_called_once_with('search_result', result, namespace='/tiktok', room='owner')

    async def test_provider_failures_emit_errors_not_profiles(self):
        for response in [Mock(status_code=403), Mock(status_code=429), Mock(status_code=302),
                         Mock(status_code=200, text='<html>Unavailable</html>')]:
            io = Mock()
            with patch('requests.get', return_value=response):
                result = await TikTokModule().profile_search('fixture', io, '/tiktok', room='owner')
            self.assertIn('error', result)
            self.assertEqual(io.emit.call_args.kwargs['room'], 'owner')
        with patch('requests.get', side_effect=requests.Timeout('Timed out')):
            result = await TikTokModule().profile_search('fixture', Mock(), '/tiktok')
        self.assertIn('error', result)

    async def test_invalid_username_never_requests_a_page(self):
        with patch('requests.get') as get:
            for username in ['https://example.com', 'a/b', '', 'x' * 25]:
                result = await TikTokModule().profile_search(username, Mock(), '/tiktok')
                self.assertIn('error', result)
        get.assert_not_called()

    async def test_cancellation_does_not_publish_profile(self):
        cancel = threading.Event()
        def response(*args, **kwargs):
            cancel.set()
            return Mock(status_code=200, text=page())
        io = Mock()
        with patch('requests.get', side_effect=response):
            result = await TikTokModule().profile_search('fixture', io, '/tiktok', cancel_event=cancel)
        self.assertEqual(result, {'cancelled': True})
        io.emit.assert_not_called()


if __name__ == '__main__':
    unittest.main()
