import requests
import logging
import asyncio
from core.base_module import OsintModule

class CrtshModule(OsintModule):
    """Module for subdomain enumeration using crt.sh"""
    
    def __init__(self):
        super().__init__("crtsh")
        self.api_url = 'https://crt.sh/'
    
    async def search(self, domain: str, socketio, namespace: str, **kwargs) -> dict:
        """
        Search for subdomains using crt.sh
        
        Args:
            domain: Domain to search
            socketio: SocketIO instance
            namespace: SocketIO namespace
            
        Returns:
            Dict containing the search results
        """
        self.logger.info(f"Starting crt.sh lookup for domain: {domain}")
        room = kwargs.get('room')

        try:
            self.logger.info("Contacting crt.sh API...")
            
            # Include certificates issued only for subdomains of the query.
            params = {'q': f'%.{domain}', 'output': 'json'}
            
            # Use asyncio.to_thread to run blocking code
            response = await asyncio.to_thread(
                lambda: requests.get(self.api_url, params=params, timeout=15)
            )
            
            response.raise_for_status()
            
            self.logger.info("Processing results...")
            
            subdomains = {
                name.strip()
                for entry in response.json()
                for name in entry.get('name_value', '').split('\n')
                if name.strip()
            }
            sorted_subdomains = sorted(subdomains)
            
            result = {
                'result': {
                    'module': 'crtsh',
                    'results': sorted_subdomains
                }
            }
            
            # Emit result
            self.emit_result(socketio, namespace, result, room=room)
            self.logger.info("crt.sh lookup completed")
            
            return result
            
        except requests.exceptions.RequestException as e:
            error_msg = f"Error in crt.sh lookup: {str(e)}"
            self.logger.error(error_msg)
            self.emit_error(socketio, namespace, error_msg, room=room)
            return {'error': error_msg}


# Create a singleton instance for import
crtsh_module = CrtshModule()
