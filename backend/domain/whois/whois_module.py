import whois
import json
from datetime import datetime
import logging
import asyncio
from core.base_module import OsintModule

class WhoisModule(OsintModule):
    """Module for WHOIS domain lookups"""
    
    def __init__(self):
        super().__init__("whois")
    
    async def search(self, domain: str, socketio, namespace: str, **kwargs) -> dict:
        """
        Search for WHOIS information for a domain
        
        Args:
            domain: Domain to search
            socketio: SocketIO instance
            namespace: SocketIO namespace
            
        Returns:
            Dict containing the WHOIS information
        """
        self.logger.info(f"Starting WHOIS lookup for domain: {domain}")
        
        try:
            self.logger.info("Retrieving WHOIS information...")
            
            # Use asyncio.to_thread to run blocking code
            whois_info = await asyncio.to_thread(whois.whois, domain)
            
            self.logger.info("Processing results...")
            
            # Prepare the result
            processed_results = {}
            
            # Convert all values to JSON serializable format
            for key, value in whois_info.items():
                if isinstance(value, datetime):
                    processed_results[key] = value.isoformat()  # Convert datetime to ISO string
                elif isinstance(value, list):
                    # Handle lists that might contain datetime objects
                    processed_results[key] = [
                        item.isoformat() if isinstance(item, datetime) else item 
                        for item in value
                    ]
                else:
                    processed_results[key] = value
            
            result = {
                'result': {
                    'module': 'whois',
                    'results': processed_results
                }
            }
            
            # Emit result
            self.emit_result(socketio, namespace, result)
            self.logger.info("WHOIS lookup completed")
            
            return result
            
        except Exception as e:
            error_msg = f"Error in WHOIS lookup: {str(e)}"
            self.logger.error(error_msg)
            self.emit_error(socketio, namespace, error_msg)
            return {'error': error_msg}


# Create a singleton instance for import
whois_module = WhoisModule()
