"""Run with GHunt's isolated Python, not the application's Python.

python -m unittest discover -s tests -p ghunt_dependency_checks.py -v
"""
import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import AsyncMock, Mock, patch

from ghunt.parsers.people import Person, PersonSourceIds
from ghunt.modules import email


class GhuntDependencyTests(unittest.IsolatedAsyncioTestCase):
    async def test_cover_photo_without_container_preserves_other_data(self):
        person = Person()
        await person._scrape(AsyncMock(), {
            'personId': 'fixture',
            'email': [{'value': 'fixture@example.invalid', 'metadata': {'container': 'PROFILE'}}],
            'coverPhoto': [{'imageUrl': 'https://example.invalid/cover=s1600', 'metadata': {}}],
        })
        self.assertEqual(person.personId, 'fixture')
        self.assertEqual(person.emails['PROFILE'].value, 'fixture@example.invalid')
        self.assertNotIn('PROFILE', person.coverPhotos)
        self.assertEqual(person.coverPhotos['unknown'].url, 'https://example.invalid/cover')

    async def test_json_export_with_missing_edit_date_and_maps_details(self):
        person = Person()
        person.personId = 'fixture'
        person.sourceIds['PROFILE'] = PersonSourceIds()  # lastUpdated is absent
        people = Mock()
        people.people_lookup = AsyncMock(return_value=(True, person))
        with tempfile.TemporaryDirectory() as folder, contextlib.redirect_stdout(io.StringIO()), \
             patch.object(email.auth, 'load_and_auth', AsyncMock()), \
             patch.object(email, 'PeoplePaHttp', return_value=people), \
             patch.object(email.playgames, 'search_player', AsyncMock(return_value=[])), \
             patch.object(email.gmaps, 'get_reviews', AsyncMock(return_value=(None, {}))), \
             patch.object(email.gmaps, 'output'), \
             patch.object(email.gcalendar, 'fetch_all', AsyncMock(return_value=(False, None, None))):
            output = Path(folder) / 'result.json'
            await email.hunt(AsyncMock(), 'fixture@example.invalid', output)
            data = json.loads(output.read_text())
        self.assertEqual(data['PROFILE_CONTAINER']['profile']['personId'], 'fixture')
        self.assertIsNone(data['PROFILE_CONTAINER']['maps']['photos'])
        self.assertIsNone(data['PROFILE_CONTAINER']['maps']['reviews'])


if __name__ == '__main__':
    unittest.main()
