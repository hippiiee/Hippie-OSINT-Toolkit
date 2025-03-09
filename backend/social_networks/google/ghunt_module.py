import subprocess
import json
import os
import logging
import asyncio
from core.base_module import OsintModule
import tempfile

class GoogleModule(OsintModule):
    """Module for Google account lookups using GHunt"""
    
    def __init__(self):
        super().__init__("google")
        self.ghunt_path = '/root/.local/bin/ghunt'
    
    async def search(self, email: str, socketio, namespace: str, **kwargs) -> dict:
        """
        Search for Google account information
        
        Args:
            email: Google email address
            socketio: SocketIO instance
            namespace: SocketIO namespace
            
        Returns:
            Dict containing the search results
        """
        self.logger.info(f"Starting GHunt lookup for email: {email}")
        
        try:
            self.logger.info("Executing GHunt for Google account...")
            
            # Create a temporary file for the output
            with tempfile.NamedTemporaryFile(suffix='.json', delete=False) as temp_file:
                output_file = temp_file.name
            
            # Run the GHunt command
            cmd = [self.ghunt_path, 'email', '--json', output_file, email]
            process = await asyncio.create_subprocess_exec(
                *cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )
            await process.wait()
            
            self.logger.info("Processing Google account data...")
            
            # Check if the command was successful
            if process.returncode != 0:
                error_msg = "Failed to retrieve information from Google"
                self.logger.error(f"GHunt error: {error_msg}")
                self.emit_error(socketio, namespace, error_msg)
                return {'error': error_msg}
            
            # Read the output file
            try:
                with open(output_file, 'r') as f:
                    email_info = json.load(f)
                
                # Clean up the temporary file
                if os.path.exists(output_file):
                    os.remove(output_file)
                
                # Emit the result
                result = {
                    'result': {
                        'module': 'google',
                        'found': email_info
                    }
                }
                self.emit_result(socketio, namespace, result)
                
                self.logger.info("Google account lookup completed")
                
                return result
            except (json.JSONDecodeError, FileNotFoundError) as e:
                error_msg = f"Failed to parse GHunt output: {str(e)}"
                self.logger.error(error_msg)
                self.emit_error(socketio, namespace, error_msg)
                return {'error': error_msg}
                
        except Exception as e:
            error_msg = f"Error in Google lookup: {str(e)}"
            self.logger.error(error_msg)
            self.emit_error(socketio, namespace, error_msg)
            
            # Clean up the output file if it exists
            if os.path.exists(output_file):
                os.remove(output_file)
                
            return {'error': error_msg}


# Create a singleton instance for import
google_module = GoogleModule()