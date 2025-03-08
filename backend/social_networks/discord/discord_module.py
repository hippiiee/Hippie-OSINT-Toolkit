import logging
from datetime import datetime
import requests
from core.base_module import OsintModule

class DiscordModule(OsintModule):
    """Module for Discord user ID lookups"""
    
    def __init__(self):
        super().__init__("discord")
    
    async def search(self, user_id: str, socketio, namespace: str, **kwargs) -> dict:
        """
        Search for Discord user by their ID
        
        Args:
            user_id: Discord user ID to search
            socketio: SocketIO instance
            namespace: SocketIO namespace
            
        Returns:
            Dict containing the search results
        """
        self.logger.info(f"Starting Discord lookup for user ID: {user_id}")
        cancel_event = kwargs.get('cancel_event')
        
        try:
            # Check if the search was cancelled
            if self.handle_cancellation(cancel_event):
                return {'cancelled': True}
                
            response = requests.get(
                f'https://discordlookup.mesalytic.moe/v1/user/{user_id}'
            )
            
            if response.status_code != 200:
                error_msg = f"Error: HTTP {response.status_code}"
                self.emit_error(socketio, namespace, error_msg)
                return {'error': error_msg}

            data = response.json()
            
            user_data = {
                'result': {
                    'module': 'discord',
                    'results': {
                        'user_id': data['id'],
                        'username': data['username'],
                        'global_name': data.get('global_name'),
                        'created_at': data['created_at'],
                        'avatar_url': data['avatar']['link'] if data.get('avatar') else None,
                        'is_avatar_animated': data.get('avatar', {}).get('is_animated', False),
                        'accent_color': data.get('accent_color'),
                        'banner_color': data.get('banner', {}).get('color') or data.get('banner_color'),
                        'banner_url': data.get('banner', {}).get('link'),
                        'discriminator': data.get('raw', {}).get('discriminator', '0'),
                        'badges': data['badges'],
                        'public_flags': data['raw']['public_flags'],
                        'flags': data.get('raw', {}).get('flags', 0),
                        'raw_data': {
                            'avatar_hash': data.get('avatar', {}).get('id'),
                            'avatar_decoration': data.get('avatar_decoration')
                        }
                    }
                }
            }
            
            # Emit the result using the base class method
            self.emit_result(socketio, namespace, user_data)
            
            return user_data

        except Exception as e:
            error_msg = f"Error in Discord lookup: {str(e)}"
            self.logger.error(error_msg)
            self.emit_error(socketio, namespace, error_msg)
            return {'error': error_msg}

    @staticmethod
    def calculate_creation_date(discord_id):
        """Calculate the creation date from a Discord snowflake ID."""
        try:
            timestamp = ((int(discord_id) >> 22) + 1420070400000) / 1000
            return datetime.utcfromtimestamp(timestamp).isoformat()
        except:
            return None

# Create a singleton instance for import
discord_module = DiscordModule()
