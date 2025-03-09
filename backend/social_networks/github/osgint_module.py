import subprocess
import json
import asyncio
import os
import logging
from core.base_module import OsintModule

class GitHubModule(OsintModule):
    """Module for GitHub user lookups using OSGINT"""
    
    def __init__(self):
        super().__init__("github")
        self.script_path = os.path.join(os.path.dirname(__file__), 'project_source', 'osgint.py')
    
    async def search(self, username: str, socketio, namespace: str, **kwargs) -> dict:
        """
        Search for GitHub user information
        
        Args:
            username: GitHub username
            socketio: SocketIO instance
            namespace: SocketIO namespace
            
        Returns:
            Dict containing the search results
        """
        self.logger.info(f"Starting GitHub lookup for username: {username}")
        
        try:
            # Execute the OSGINT script as a subprocess
            process = await asyncio.create_subprocess_exec(
                'python3', self.script_path, '-u', username, '--json',
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                error_msg = stderr.decode()
                self.logger.error(f"OSGINT error: {error_msg}")
                self.emit_error(socketio, namespace, error_msg)
                return {'error': error_msg}
            
            # Parse the output
            parsed_output = self.parse_osgint_output(stdout.decode())
            if 'error' in parsed_output:
                self.logger.error(f"Parse error: {parsed_output['error']}")
                self.emit_error(socketio, namespace, parsed_output['error'])
                return parsed_output
            
            # Format result
            result = {
                'result': {
                    'module': 'github',
                    'data': parsed_output
                }
            }
            
            # Emit result
            self.emit_result(socketio, namespace, result)
            
            self.logger.info("GitHub lookup completed")
            
            return result
        
        except Exception as e:
            error_msg = f"Error in GitHub lookup: {str(e)}"
            self.logger.error(error_msg)
            self.emit_error(socketio, namespace, error_msg)
            return {'error': error_msg}
    
    def parse_osgint_output(self, output):
        """Parse the JSON output from OSGINT script"""
        try:
            # Find the start and end of the JSON part
            json_start = output.find('{')
            json_end = output.rfind('}') + 1
            
            if json_start == -1 or json_end == 0:
                self.logger.error("No valid JSON found in output")
                return {'error': 'No valid JSON found in output'}
            
            json_data = output[json_start:json_end]
            data = json.loads(json_data)  # Load the JSON data
            return data
        except (json.JSONDecodeError, ValueError) as e:
            self.logger.error(f"JSON parse error: {str(e)}")
            return {'error': f'Failed to parse JSON output: {str(e)}'}


# Create a singleton instance for import
github_module = GitHubModule()