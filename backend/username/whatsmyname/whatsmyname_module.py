import json
import logging
import asyncio
from socid_extractor import extract
from core.base_module import OsintModule
import aiohttp

class WhatsmynameModule(OsintModule):
    """Module for username lookups across multiple platforms using WhatsMyName"""
    
    def __init__(self):
        super().__init__("whatsmyname")
        logging.getLogger('urllib3').setLevel(logging.CRITICAL)
    
    async def search(self, username: str, socketio, namespace: str, **kwargs) -> dict:
        """
        Search for username across multiple platforms
        
        Args:
            username: Username to search
            socketio: SocketIO instance
            namespace: SocketIO namespace
            
        Returns:
            Dict containing the search results
        """
        self.logger.info(f"Starting WhatsMyName lookup for username: {username}")
        cancel_event = kwargs.get('cancel_event')
        
        try:
            # Fetch wmn-data from WhatsMyName repository
            http_module = __import__('urllib3').PoolManager()
            response = http_module.request('GET', "https://raw.githubusercontent.com/WebBreacher/WhatsMyName/main/wmn-data.json")
            data = json.loads(response.data.decode('utf-8'))
            sites = data["sites"]
            total_sites = len(sites)
            found_sites = []
            
            # Check if the search was cancelled
            if cancel_event and cancel_event.is_set():
                self.logger.info("WhatsMyName search cancelled")
                return {'cancelled': True}
            
            # Emit start message
            start_message = {
                'module': 'whatsmyname',
                'status': 'start',
                'data': {
                    'total_sites': total_sites
                }
            }
            self.emit_result(socketio, namespace, start_message)
            
            self.logger.info(f"Searching {total_sites} sites for username...")
            
            # Create a pool of tasks
            tasks = []
            for idx, site in enumerate(sites):
                tasks.append(self.check_site(site, username, idx, total_sites, socketio, namespace, cancel_event))
            
            # Run tasks concurrently with a limit
            chunk_size = 20
            for i in range(0, len(tasks), chunk_size):
                chunk = tasks[i:i+chunk_size]
                
                # Check if the search was cancelled
                if cancel_event and cancel_event.is_set():
                    self.logger.info("WhatsMyName search cancelled during processing")
                    return {'cancelled': True}
                
                results = await asyncio.gather(*chunk)
                for uri in results:
                    if uri and isinstance(uri, dict):
                        site_name = uri.get('site_name')
                        uri_check = uri.get('uri')
                        if site_name and uri_check:
                            found_sites.append({"site": site_name, "url": uri_check})
            
            # Check if the search was cancelled
            if cancel_event and cancel_event.is_set():
                self.logger.info("WhatsMyName search cancelled after processing")
                return {'cancelled': True}
            
            # Send completion message
            self.logger.info(f"Search completed. Found {len(found_sites)} sites.")
            
            completion_message = {
                'result': {
                    'module': 'whatsmyname',
                    'status': 'complete',
                    'data': {
                        'found_sites': found_sites,
                        'total_sites': total_sites
                    }
                }
            }
            self.emit_result(socketio, namespace, completion_message)
            
            return completion_message
        except Exception as e:
            error_msg = f"Error in WhatsMyName lookup: {str(e)}"
            self.logger.error(error_msg)
            self.emit_error(socketio, namespace, error_msg)
            return {'error': error_msg}
    
    async def check_site(self, site, username, site_index, total_sites, socketio, namespace, cancel_event=None):
        """Check a single site for the username"""
        # Check if the search was cancelled
        if cancel_event and cancel_event.is_set():
            return None
            
        site_name = site["name"]
        uri_check = site["uri_check"].format(account=username)
        
        try:
            # For debugging: limit request rate
            # await asyncio.sleep(0.1)
            
            # Create an aiohttp session for this request
            async with aiohttp.ClientSession() as session:
                # Make the request to check the site
                async with session.get(uri_check, timeout=5) as response:
                    # Check if the search was cancelled
                    if cancel_event and cancel_event.is_set():
                        return None
                        
                    # If we got a good response, check if the account exists
                    if response.status == 200:
                        # Emit a site found message
                        found_message = {
                            'module': 'whatsmyname',
                            'type': 'site_found',
                            'data': {
                                'site_name': site_name,
                                'uri_check': uri_check,
                                'uri_pretty': site.get('uri_pretty', '').format(account=username),
                                'progress': {
                                    'current': site_index + 1,
                                    'total': total_sites
                                }
                            }
                        }
                        self.emit_result(socketio, namespace, found_message)
                        
                        return {
                            'site_name': site_name,
                            'uri': uri_check
                        }
        except Exception as e:
            # Ignore errors for individual sites
            pass
        
        # Account not found or error
        return None


# Create a singleton instance for import
whatsmyname_module = WhatsmynameModule()