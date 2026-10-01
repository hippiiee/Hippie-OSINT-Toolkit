from datetime import datetime, timezone
from html.parser import HTMLParser
import re
import logging
import asyncio
import requests
import json
from core.base_module import OsintModule


class _ProfileDataParser(HTMLParser):
    """Read the public profile JSON embedded in TikTok's HTML."""

    def __init__(self):
        super().__init__()
        self.collecting = False
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag == 'script':
            self.collecting = dict(attrs).get('id') == '__UNIVERSAL_DATA_FOR_REHYDRATION__'

    def handle_endtag(self, tag):
        if tag == 'script':
            self.collecting = False

    def handle_data(self, data):
        if self.collecting:
            self.parts.append(data)


class TikTokModule(OsintModule):
    """Module for TikTok video timestamp extraction and profile lookup"""
    
    def __init__(self):
        super().__init__("tiktok")
    
    async def search(self, query: str, socketio, namespace: str, **kwargs) -> dict:
        """
        Search for TikTok data - either extract timestamp from a video URL or get profile information
        
        Args:
            query: TikTok video URL or username
            socketio: SocketIO instance
            namespace: SocketIO namespace
            
        Returns:
            Dict containing the TikTok data
        """
        self.logger.info(f"Starting TikTok analysis for query: {query}")
        cancel_event = kwargs.get('cancel_event')
        search_type = kwargs.get('search_type', 'video')  # Default to video URL analysis
        room = kwargs.get('room')

        try:
            # Check if the search was cancelled
            if self.handle_cancellation(cancel_event):
                return {'cancelled': True}

            if search_type == 'profile':
                self.logger.info(f"Performing profile lookup for username: {query}")
                return await self.profile_search(query, socketio, namespace, cancel_event=cancel_event, room=room)
            else:
                self.logger.info("Analyzing TikTok URL...")
                return await self.video_timestamp(query, socketio, namespace, cancel_event=cancel_event, room=room)
        
        except Exception as e:
            error_msg = f"Error in TikTok analysis: {str(e)}"
            self.logger.error(error_msg)
            self.emit_error(socketio, namespace, error_msg, room=room)
            return {'error': error_msg}
    
    async def video_timestamp(self, url: str, socketio, namespace: str, **kwargs) -> dict:
        """Extract timestamp from TikTok video URL"""
        cancel_event = kwargs.get('cancel_event')
        room = kwargs.get('room')


        try:
            # Check if the search was cancelled
            if self.handle_cancellation(cancel_event):
                return {'cancelled': True}
                
            # Extract the ID from the URL
            urlid = self.extract_id_from_url(url)
            if urlid is None:
                error_msg = "Invalid TikTok URL format"
                self.logger.error(error_msg)
                self.emit_error(socketio, namespace, error_msg, room=room)
                return {'error': error_msg}
            
            self.logger.info("Extracting timestamp...")
            
            # Convert the ID to a timestamp
            binary = "{0:b}".format(urlid)  # Conversion to binary
            bits = binary[:31]  # Get the first 31 bits
            timestamp = int(bits, 2)  # Convert these bits to an int which is our timestamp
            dt_object = datetime.fromtimestamp(timestamp)
            dt_string = dt_object.isoformat()  # Convert datetime to string
            
            # Format result
            result = {
                'result': {
                    'module': 'tiktok',
                    'search_type': 'video',
                    'video_id': urlid,
                    'timestamp': dt_string,
                    'binary': binary,
                    'creation_time': {
                        'iso': dt_string,
                        'unix': timestamp
                    }
                }
            }
            
            # Emit result
            self.emit_result(socketio, namespace, result, room=room)
            self.logger.info("TikTok video timestamp analysis completed")
            
            return result
            
        except Exception as e:
            error_msg = f"Error in TikTok video analysis: {str(e)}"
            self.logger.error(error_msg)
            self.emit_error(socketio, namespace, error_msg, room=room)
            return {'error': error_msg}
    
    async def profile_search(self, username: str, socketio, namespace: str, **kwargs) -> dict:
        """Get TikTok profile information for a username"""
        cancel_event = kwargs.get('cancel_event')
        room = kwargs.get('room')


        try:
            # Check if the search was cancelled
            if self.handle_cancellation(cancel_event):
                return {'cancelled': True}
                
            username = username.strip().lstrip('@')
            if not re.fullmatch(r'[A-Za-z0-9._]{1,24}', username):
                raise ValueError('Enter a TikTok username (letters, numbers, dots and underscores).')

            self.logger.info(f"Requesting public profile data for username: {username}")
            response = requests.get(
                f'https://www.tiktok.com/@{username}',
                headers={'User-Agent': 'Hippie-OSINT-Toolkit/1.0 (public profile lookup)'},
                timeout=15,
                allow_redirects=False,
            )
            
            # Check if the search was cancelled
            if self.handle_cancellation(cancel_event):
                return {'cancelled': True}
                
            if response.status_code != 200:
                error_msg = f"Error: HTTP {response.status_code} when retrieving TikTok profile"
                self.logger.error(error_msg)
                self.emit_error(socketio, namespace, error_msg, room=room)
                return {'error': error_msg}
            
            profile_data = self.parse_public_profile(response.text)
            
            # Format result
            result = {
                'result': {
                    'module': 'tiktok',
                    'search_type': 'profile',
                    'profile': profile_data
                }
            }
            
            # Emit result
            self.emit_result(socketio, namespace, result, room=room)
            self.logger.info("TikTok profile lookup completed")
            
            return result
            
        except Exception as e:
            error_msg = f"Error in TikTok profile lookup: {str(e)}"
            self.logger.error(error_msg)
            self.emit_error(socketio, namespace, error_msg, room=room)
            return {'error': error_msg}

    @staticmethod
    def parse_public_profile(html: str) -> dict:
        parser = _ProfileDataParser()
        parser.feed(html)
        if not parser.parts:
            raise ValueError('TikTok did not return public profile data. Please try again later.')
        try:
            data = json.loads(''.join(parser.parts))
            detail = data['__DEFAULT_SCOPE__']['webapp.user-detail']
            if detail.get('statusCode') != 0:
                raise ValueError('TikTok profile was not found or is unavailable.')
            info = detail['userInfo']
            user = info['user']
            stats = info.get('stats') or {}
            if not user.get('uniqueId') or not user.get('id'):
                raise KeyError('profile identity')

            def date(value):
                if not value:
                    return 'Unknown'
                try:
                    return datetime.fromtimestamp(int(value), timezone.utc).isoformat()
                except (ValueError, TypeError, OverflowError, OSError):
                    return 'Unknown'

            def count(key):
                value = stats.get(key)
                return str(value) if value is not None else 'Unknown'

            return {
                'username': user['uniqueId'],
                'nickname': user.get('nickname') or user['uniqueId'],
                'userId': str(user['id']),
                'avatar': user.get('avatarLarger') or user.get('avatarMedium') or '',
                'about': user.get('signature') or '',
                'region': user.get('region') or '',
                'language': user.get('language') or '',
                'accountCreated': date(user.get('createTime')),
                'nicknameModified': date(user.get('nickNameModifyTime')),
                'stats': {
                    'followers': count('followerCount'),
                    'following': count('followingCount'),
                    'hearts': count('heartCount'),
                    'videos': count('videoCount'),
                    'friends': count('friendCount'),
                },
            }
        except (KeyError, TypeError, AttributeError, json.JSONDecodeError) as exc:
            raise ValueError('TikTok returned an unrecognized public profile format.') from exc
    
    @staticmethod
    def extract_id_from_url(url):
        """Extract the TikTok video ID from the URL"""
        # Regular expression to extract the TikTok video ID from the URL
        match = re.search(r'tiktok\.com\/.*\/(\d+)', url)
        if match:
            return int(match.group(1))
        return None


# Create a singleton instance for import
tiktok_module = TikTokModule()
