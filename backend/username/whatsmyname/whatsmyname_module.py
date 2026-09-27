import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
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
            return self.run_whatsmyname(username, socketio, namespace, room, cancel_event)
        except Exception as e:
            if self.is_cancelled(cancel_event):
                return {"cancelled": True}
            error_msg = f"Error in WhatsMyName lookup: {str(e)}"
            self.logger.error(error_msg)
            self.emit_error(socketio, namespace, error_msg, room=room)
            return {'error': error_msg}
    
    def check_site(self, site, username, headers, socketio, namespace, site_index, total_sites, room, cancel_event=None):
        """Check a single site for the username"""
        # Check if the search was cancelled
        if cancel_event and cancel_event.is_set():
            return None
            
        site_name = site.get("name", "unknown")

        try:
            uri_check = site["uri_check"].format(account=username)
            with requests.get(uri_check, headers=headers, timeout=(5, 10)) as res:
                # Check if the search was cancelled
                if cancel_event and cancel_event.is_set():
                    return None
                    
                text = res.text
                
                estring_pos = site["e_string"] in text
                estring_neg = site["m_string"] in text if "m_string" in site else False

                if res.status_code == site["e_code"] and estring_pos and not estring_neg:
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

                    if self.is_cancelled(cancel_event):
                        return None
                    self.emit_result(socketio, namespace, found_message, room=room)
                    return {
                        'site_name': site_name,
                        'uri': uri_check,
                        'extracted_info': found_message['data'].get('extracted_info', {})
                    }
        except requests.RequestException as e:
            self.logger.warning("Skipping unavailable site %s: %s", site_name, e)
        except Exception as e:
            self.logger.error(f"Error checking site {site_name}: {str(e)}")
        
        return None
    
    def run_whatsmyname(self, username, socketio, namespace, room=None, cancel_event=None):
        """Run checks in a bounded pool with request timeouts and cancellation."""
        if self.is_cancelled(cancel_event):
            return {"cancelled": True}
        headers = {
            "Accept": "text/html, application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "accept-language": "en-US;q=0.9,en,q=0,8",
            "accept-encoding": "gzip, deflate",
            "user-Agent": "Mozilla/5.0 (Windows NT 10.0;Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
        }
        
        # Fetch wmn-data from WhatsMyName repository
        with requests.get("https://raw.githubusercontent.com/WebBreacher/WhatsMyName/main/wmn-data.json", timeout=(5, 15)) as response:
            response.raise_for_status()
            data = response.json()
        if self.is_cancelled(cancel_event):
            return {"cancelled": True}
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

        with ThreadPoolExecutor(max_workers=20) as pool:
            futures = []
            for idx, site in enumerate(sites):
                if self.is_cancelled(cancel_event):
                    break
                futures.append(pool.submit(
                    self.check_site, site, username, headers, socketio,
                    namespace, idx, total_sites, room, cancel_event,
                ))
            for future in as_completed(futures):
                if self.is_cancelled(cancel_event):
                    for pending in futures:
                        pending.cancel()
                    break
                site_result = future.result()
                if site_result:
                    found_sites.append({"site": site_result['site_name'], "url": site_result['uri']})

        if self.is_cancelled(cancel_event):
            return {"cancelled": True}

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