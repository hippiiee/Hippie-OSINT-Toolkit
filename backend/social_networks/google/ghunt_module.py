import subprocess
import json
import os
import logging
async def run_ghunt(email, socketio, namespace):
    output_file = "result.json"

    try:
        result = subprocess.run(
            ['ghunt', 'email', '--json', output_file, email],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        logging.debug(result)
        if result.returncode != 0:
            socketio.emit('search_result', {'result': {'module': 'ghunt', 'error': 'failed to retrieve information'}}, namespace=namespace)


        else:
            with open(output_file, 'r') as file:
                email_info = json.load(file)
            os.remove(output_file)
            logging.debug(email_info)
            result = {"module": "ghunt", "found": email_info}
            socketio.emit('search_result', {'result': result}, namespace=namespace)
    except Exception as e:
        socketio.emit('search_result', {'result': {'module': 'ghunt', 'error': 'failed to retrieve information'}}, namespace=namespace)