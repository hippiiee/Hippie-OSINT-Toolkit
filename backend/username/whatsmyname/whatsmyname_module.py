import json
import eventlet
import logging
from socid_extractor import extract

logging.getLogger('urllib3').setLevel(logging.CRITICAL)

def check_site(site, username, headers, socketio, namespace, site_index, total_sites, request_sid):
    site_name = site["name"]
    uri_check = site["uri_check"].format(account=username)
    uri_pretty = site.get("uri_pretty", "").format(account=username)

    try:
        with eventlet.Timeout(10):
            http = eventlet.import_patched('urllib3').PoolManager()
            res = http.request('GET', uri_check, headers=headers)
            text = res.data.decode('utf-8')
            
            estring_pos = site["e_string"] in text
            estring_neg = site["m_string"] in text

            if res.status == site["e_code"] and estring_pos and not estring_neg:
                result = {
                    'module': 'whatsmyname',
                    'type': 'site_found',
                    'data': {
                        "site_name": site_name,
                        "uri_check": uri_check,
                        "uri_pretty": uri_pretty,
                        "progress": {
                            "current": site_index + 1,
                            "total": total_sites
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
                        result['data']['extracted_info'] = serializable_info
                except Exception as e:
                    logging.error(f"Error extracting additional info: {str(e)}")

                uri_to_use = uri_pretty if uri_pretty else uri_check

                socketio.emit('search_result', {'result': result}, namespace=namespace, room=request_sid)
                return site_name, uri_to_use, result['data'].get('extracted_info')
    except Exception as e:
        logging.error(f"Error checking site {site_name}: {str(e)}")
    return None

def run_whatsmyname(username, socketio, namespace, singlesearch=None, countsites=False, fulllist=False, request_sid=None):
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
    socketio.emit('search_result', {
        'result': {
            'module': 'whatsmyname',
            'status': 'start',
            'data': {
                'total_sites': total_sites
            }
        }
    }, namespace=namespace, room=request_sid)

    # Create a pool of greenlets
    pool = eventlet.GreenPool(size=20)
    for idx, site in enumerate(sites):
        pool.spawn_n(
            check_site,
            site,
            username,
            headers,
            socketio,
            namespace,
            idx,
            total_sites,
            request_sid
        )
    
    # Wait for all greenlets to complete
    pool.waitall()

    # Send completion message
    socketio.emit('search_result', {
        'result': {
            'module': 'whatsmyname',
            'type': 'complete',
            'data': {
                'total_found': len(found_sites),
                'total_sites': total_sites,
                'message': f"Search completed. Found {len(found_sites)} sites for user {username}."
            }
        }
    }, namespace=namespace, room=request_sid)