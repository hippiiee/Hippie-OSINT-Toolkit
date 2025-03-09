import requests
import logging
import asyncio
from core.base_module import OsintModule

class CrtshModule(OsintModule):
    """Module for subdomain enumeration using crt.sh"""
    
    def __init__(self):
        super().__init__("crtsh")
        self.api_url = 'https://crt.sh/?q={}&output=json'
    
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
        
        try:
            self.logger.info("Contacting crt.sh API...")
            
            url = self.api_url.format(domain)
            
            # Use asyncio.to_thread to run blocking code
            response = await asyncio.to_thread(
                lambda: requests.get(url, timeout=10)
            )
            
            response.raise_for_status()
            
            self.logger.info("Processing results...")
            
            subdomains = {entry['name_value'] for entry in response.json()}
            sorted_subdomains = sorted(subdomains)
            
            result = {
                'result': {
                    'module': 'crtsh',
                    'results': sorted_subdomains
                }
            }
            
            # Emit result
            self.emit_result(socketio, namespace, result)
            self.logger.info("crt.sh lookup completed")
            
            return result
            
        except requests.exceptions.RequestException as e:
            error_msg = f"Error in crt.sh lookup: {str(e)}"
            self.logger.error(error_msg)
            self.emit_error(socketio, namespace, error_msg)
            return {'error': error_msg}


# Create a singleton instance for import
crtsh_module = CrtshModule()
