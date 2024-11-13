import json
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError
from socid_extractor import extract
import logging

def check_site(site, username, headers, socketio, namespace, site_index, total_sites):
    site_name = site["name"]
    uri_check = site["uri_check"].format(account=username)
    try:
        res = requests.get(uri_check, headers=headers, timeout=10)
        estring_pos = site["e_string"] in res.text
        estring_neg = site["m_string"] in res.text

        if res.status_code == site["e_code"] and estring_pos and not estring_neg:
            result = {
                'module': 'whatsmyname',
                'type': 'site_found',
                'data': {
                    "site_name": site_name,
                    "uri_check": uri_check,
                    "progress": {
                        "current": site_index + 1,
                        "total": total_sites
                    }
                }
            }
            
            try:
                extracted_info = extract(res.text)
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

            # Emit result immediately when found
            socketio.emit('search_result', {'result': result}, namespace=namespace)
            return site_name, uri_check, result['data'].get('extracted_info')
    except Exception as e:
        logging.error(f"Error checking site {site_name}: {str(e)}")
        pass
    return None

async def run_whatsmyname(username, socketio, namespace, singlesearch=None, countsites=False, fulllist=False):
    headers = {
        "Accept": "text/html, application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US;q=0.9,en,q=0,8",
        "accept-encoding": "gzip, deflate",
        "user-Agent": "Mozilla/5.0 (Windows NT 10.0;Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
    }
    
    # Fetch wmn-data from WhatsMyName repository
    response = requests.get("https://raw.githubusercontent.com/WebBreacher/WhatsMyName/main/wmn-data.json")
    data = response.json()
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
    }, namespace=namespace)

    try:
        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = {
                executor.submit(
                    check_site, 
                    site, 
                    username, 
                    headers, 
                    socketio, 
                    namespace, 
                    idx, 
                    total_sites
                ): site for idx, site in enumerate(sites)
            }

            for future in as_completed(futures):
                try:
                    result = future.result()
                    if result:
                        site_name, uri_check, extracted_info = result
                        site_data = {
                            "site_name": site_name,
                            "uri_check": uri_check
                        }
                        if extracted_info:
                            site_data["extracted_info"] = extracted_info
                        found_sites.append(site_data)
                except Exception as e:
                    logging.error(f"Error processing result: {str(e)}")
                    continue

    except TimeoutError:
        pass

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
    }, namespace=namespace)
