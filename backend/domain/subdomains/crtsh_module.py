import requests

async def run_crtsh(domain, socketio, namespace):
    try:
        url = f"https://crt.sh/?q={domain}&output=json"
        response = requests.get(url, timeout=10)
        
        response.raise_for_status()
        
        subdomains = {entry['name_value'] for entry in response.json()}
        sorted_subdomains = sorted(subdomains)
        socketio.emit('search_result', 
                     {'result': {'module': 'crtsh', 'results': sorted_subdomains}}, 
                     namespace=namespace)
    
    except requests.exceptions.RequestException as e:
        error_message = f"crt.sh: {str(e)}"
        socketio.emit('search_result', 
                     {'error': error_message}, 
                     namespace=namespace)
