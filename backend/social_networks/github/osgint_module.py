import subprocess
import json
import asyncio
import os
import logging
async def run_osgint(username, socketio, namespace):
    script_path = os.path.join(os.path.dirname(__file__), 'project_source', 'osgint.py')
    process = await asyncio.create_subprocess_exec(
        'python3', script_path, '-u', username, '--json',
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    stdout, stderr = await process.communicate()

    if process.returncode != 0:
        socketio.emit({'error': stderr.decode()}, namespace=namespace)
        return  # Exit if there's an error

    parsed_output = parse_osgint_output(stdout.decode())
    if 'error' in parsed_output:
        logging.debug(parsed_output)
        socketio.emit('search_result', {'error': parsed_output['error']}, namespace=namespace)
        return
    
    result = {'module': 'github', 'results': parsed_output}
    socketio.emit('search_result', {'result': result}, namespace=namespace)

def parse_osgint_output(output):
    try:
        # Find the start and end of the JSON part
        json_start = output.find('{')
        json_end = output.rfind('}') + 1
        json_data = output[json_start:json_end]
        
        data = json.loads(json_data)  # Load the JSON data
        return data
    except (json.JSONDecodeError, ValueError):
        return {'error': 'Failed to parse JSON output.'}