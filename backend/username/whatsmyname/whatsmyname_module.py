import json
import logging
import eventlet
from socid_extractor import extract
from core.base_module import OsintModule

class WhatsmynameModule(OsintModule):
    """Module for username lookups across multiple platforms using WhatsMyName"""
    
    def __init__(self):
        super().__init__("whatsmyname")
        logging.getLogger('urllib3').setLevel(logging.CRITICAL)
    
    def search(self, username: str, socketio, namespace: str, **kwargs) -> dict:
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
        room = kwargs.get('room')
        
        try:
            return self.run_whatsmyname(username, socketio, namespace, room)
        except Exception as e:
            error_msg = f"Error in WhatsMyName lookup: {str(e)}"
            self.logger.error(error_msg)
            self.emit_error(socketio, namespace, error_msg, room=room)
            return {'error': error_msg}
    
    def check_site(self, site, username, headers, socketio, namespace, site_index, total_sites, room, cancel_event=None):
        """Check a single site for the username"""
        # Check if the search was cancelled
        if cancel_event and cancel_event.is_set():
            return None
            
        site_name = site["name"]
        uri_check = site["uri_check"].format(account=username)
        
        try:
            with eventlet.Timeout(10):
                # Check if the search was cancelled
                if cancel_event and cancel_event.is_set():
                    return None
                    
                http = eventlet.import_patched('urllib3').PoolManager()
                res = http.request('GET', uri_check, headers=headers)
                text = res.data.decode('utf-8')
                
                estring_pos = site["e_string"] in text
                estring_neg = site["m_string"] in text if "m_string" in site else False

                if res.status == site["e_code"] and estring_pos and not estring_neg:
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
                    
                    try:
                        extracted_info = extract(text)
                        if extracted_info:
                            serializable_info = {}
                            for key, value in extracted_info.items():
                                if isinstance(value, (str, int, float, bool, list, dict)):
                                    serializable_info[key] = value
                                else:
                                    serializable_info[key] = str(value)
                            found_message['data']['extracted_info'] = serializable_info
                    except Exception as e:
                        self.logger.error(f"Error extracting additional info: {str(e)}")

                    self.emit_result(socketio, namespace, found_message, room=room)
                    return {
                        'site_name': site_name,
                        'uri': uri_check,
                        'extracted_info': found_message['data'].get('extracted_info', {})
                    }
        except Exception as e:
            self.logger.error(f"Error checking site {site_name}: {str(e)}")
        
        return None
    
    def run_whatsmyname(self, username, socketio, namespace, room=None):
        """Run the WhatsMyName search using eventlet greenlets"""
        headers = {
            "Accept": "text/html, application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "accept-language": "en-US;q=0.9,en,q=0,8",
            "accept-encoding": "gzip, deflate",
            "user-Agent": "Mozilla/5.0 (Windows NT 10.0;Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
        }
        
        # Fetch wmn-data from WhatsMyName repository
        http = eventlet.import_patched('urllib3').PoolManager()
        response = http.request('GET', "https://raw.githubusercontent.com/WebBreacher/WhatsMyName/main/wmn-data.json")
        data = json.loads(response.data.decode('utf-8'))
        sites = data["sites"]
        total_sites = len(sites)
        found_sites = []

        # Emit start message
        start_message = {
            'module': 'whatsmyname',
            'status': 'start',
            'data': {
                'total_sites': total_sites
            }
        }
        self.emit_result(socketio, namespace, start_message, room=room)
        
        self.logger.info(f"Searching {total_sites} sites for username...")

        # Create a pool of greenlets
        pool = eventlet.GreenPool(size=20)
        results = []
        
        for idx, site in enumerate(sites):
            result = pool.spawn(
                self.check_site,
                site,
                username,
                headers,
                socketio,
                namespace,
                idx,
                total_sites,
                room
            )
            results.append(result)
        
        # Wait for all greenlets to complete and collect results
        for result in results:
            site_result = result.wait()
            if site_result:
                found_sites.append({"site": site_result['site_name'], "url": site_result['uri']})
        
        # Send completion message
        self.logger.info(f"Search completed. Found {len(found_sites)} sites.")
        
        completion_message = {
            'result': {
                'module': 'whatsmyname',
                'status': 'complete',
                'data': {
                    'found_sites': found_sites,
                    'total_sites': total_sites,
                    'message': f"Search completed. Found {len(found_sites)} sites for user {username}."
                }
            }
        }
        self.emit_result(socketio, namespace, completion_message, room=room)
        
        return completion_message


# Create a singleton instance for import
whatsmyname_module = WhatsmynameModule()