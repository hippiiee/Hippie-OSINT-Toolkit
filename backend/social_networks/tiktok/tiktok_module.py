from datetime import datetime
import re
import logging
import asyncio
def extract_id_from_url(url):
    # Regular expression to extract the TikTok video ID from the URL
    match = re.search(r'tiktok\.com\/.*\/(\d+)', url)
    if match:
        return int(match.group(1))
    return None

async def run_tiktok_module(url, socketio, namespace):
    urlid = extract_id_from_url(url)
    if urlid is None:
        socketio.emit('search_result', {'result': {'module': 'tiktok', 'error': 'Invalid TikTok URL.'}}, namespace=namespace)
        logging.error("Invalid TikTok URL.")
        return
    
    binary = "{0:b}".format(urlid)  # Conversion to binary
    bits = binary[:31]  # Get the first 31 bits
    timestamp = int(bits, 2)  # Convert these bits to an int which is our timestamp
    dt_object = datetime.fromtimestamp(timestamp)
    dt_string = dt_object.isoformat()  # Convert datetime to string
    
    socketio.emit('search_result', {'result': {'module': 'tiktok', 'timestamp': dt_string}}, namespace=namespace)  # Emit string instead of datetime
    logging.info("TikTok video ID extracted and timestamp calculated.")