import whois
import json
from datetime import datetime
import logging

logging.basicConfig(level=logging.DEBUG)

async def run_whois(domain, socketio, namespace):
    logging.debug(f"Starting WHOIS lookup for domain: {domain}")
    # Retrieve WHOIS information
    whois_info = whois.whois(domain)
    
    # Prepare the result
    result = {'module': 'whois', "results": {}}
    
    # Convert all values to JSON serializable format
    for key, value in whois_info.items():
        if isinstance(value, datetime):
            result['results'][key] = value.isoformat()  # Convert datetime to ISO string
        elif isinstance(value, list):
            # Handle lists that might contain datetime objects
            result['results'][key] = [
                item.isoformat() if isinstance(item, datetime) else item 
                for item in value
            ]
        else:
            result['results'][key] = value

    logging.debug(f"WHOIS lookup completed for domain: {domain}")
    logging.debug(result)

    # Emit the result via socketio
    socketio.emit('search_result', {'result': result}, namespace=namespace)
