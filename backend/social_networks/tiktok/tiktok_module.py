from datetime import datetime
import re
import logging
import asyncio
import requests
import json
from core.base_module import OsintModule

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
        
        try:
            # Check if the search was cancelled
            if self.handle_cancellation(cancel_event):
                return {'cancelled': True}
                
            if search_type == 'profile':
                self.logger.info(f"Performing profile lookup for username: {query}")
                return await self.profile_search(query, socketio, namespace, cancel_event=cancel_event)
            else:
                self.logger.info("Analyzing TikTok URL...")
                return await self.video_timestamp(query, socketio, namespace, cancel_event=cancel_event)
        
        except Exception as e:
            error_msg = f"Error in TikTok analysis: {str(e)}"
            self.logger.error(error_msg)
            self.emit_error(socketio, namespace, error_msg)
            return {'error': error_msg}
    
    async def video_timestamp(self, url: str, socketio, namespace: str, **kwargs) -> dict:
        """Extract timestamp from TikTok video URL"""
        cancel_event = kwargs.get('cancel_event')
        
        try:
            # Check if the search was cancelled
            if self.handle_cancellation(cancel_event):
                return {'cancelled': True}
                
            # Extract the ID from the URL
            urlid = self.extract_id_from_url(url)
            if urlid is None:
                error_msg = "Invalid TikTok URL format"
                self.logger.error(error_msg)
                self.emit_error(socketio, namespace, error_msg)
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
            self.emit_result(socketio, namespace, result)
            self.logger.info("TikTok video timestamp analysis completed")
            
            return result
            
        except Exception as e:
            error_msg = f"Error in TikTok video analysis: {str(e)}"
            self.logger.error(error_msg)
            self.emit_error(socketio, namespace, error_msg)
            return {'error': error_msg}
    
    async def profile_search(self, username: str, socketio, namespace: str, **kwargs) -> dict:
        """Get TikTok profile information for a username"""
        cancel_event = kwargs.get('cancel_event')
        
        try:
            # Check if the search was cancelled
            if self.handle_cancellation(cancel_event):
                return {'cancelled': True}
                
            self.logger.info(f"Requesting profile data for username: {username}")
            
            # Make request to nopean.click API
            response = requests.post(
                'https://nopean.click',
                json={'username': username},
                headers={'Content-Type': 'application/json', 'Origin': 'https://omar-thing.nekoweb.org'}
            )
            
            # Check if the search was cancelled
            if self.handle_cancellation(cancel_event):
                return {'cancelled': True}
                
            if response.status_code != 200:
                error_msg = f"Error: HTTP {response.status_code} when retrieving TikTok profile"
                self.logger.error(error_msg)
                self.emit_error(socketio, namespace, error_msg)
                return {'error': error_msg}
            
            profile_data = response.json()
            
            # Format result
            result = {
                'result': {
                    'module': 'tiktok',
                    'search_type': 'profile',
                    'profile': profile_data
                }
            }
            
            # Emit result
            self.emit_result(socketio, namespace, result)
            self.logger.info("TikTok profile lookup completed")
            
            return result
            
        except Exception as e:
            error_msg = f"Error in TikTok profile lookup: {str(e)}"
            self.logger.error(error_msg)
            self.emit_error(socketio, namespace, error_msg)
            return {'error': error_msg}
    
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