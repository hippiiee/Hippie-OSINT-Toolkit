import requests
import asyncio
import logging
from core.base_module import OsintModule

class IpModule(OsintModule):
    """Module for IP intelligence lookups using Shodan InternetDB"""

    def __init__(self):
        super().__init__("ip")
        self.api_url = "https://internetdb.shodan.io"

    async def search(self, ip: str, socketio, namespace: str, **kwargs) -> dict:
        """
        Search for IP intelligence information using Shodan InternetDB.

        Args:
            ip: IP address to look up
            socketio: SocketIO instance
            namespace: SocketIO namespace

        Returns:
            Dict containing the search results
        """
        self.logger.info(f"Starting IP intelligence lookup for: {ip}")
        room = kwargs.get('room')
        cancel_event = kwargs.get('cancel_event')

        try:
            self.emit_progress(socketio, namespace, 10, "Querying Shodan InternetDB...", room=room)

            if self.handle_cancellation(cancel_event):
                return {'error': 'Search cancelled'}

            # Use asyncio.to_thread to run blocking requests call
            response = await asyncio.to_thread(
                requests.get, f"{self.api_url}/{ip}", timeout=15
            )

            if self.handle_cancellation(cancel_event):
                return {'error': 'Search cancelled'}

            self.emit_progress(socketio, namespace, 60, "Processing results...", room=room)

            if response.status_code == 404:
                # No information available for this IP
                result = {
                    'result': {
                        'module': 'ip',
                        'results': {
                            'ip': ip,
                            'found': False,
                            'ports': [],
                            'hostnames': [],
                            'cpes': [],
                            'vulns': [],
                            'tags': []
                        }
                    }
                }
                self.emit_progress(socketio, namespace, 100, "Complete", room=room)
                self.emit_result(socketio, namespace, result, room=room)
                self.logger.info(f"No information found for IP: {ip}")
                return result

            response.raise_for_status()
            data = response.json()

            self.emit_progress(socketio, namespace, 80, "Formatting results...", room=room)

            result = {
                'result': {
                    'module': 'ip',
                    'results': {
                        'ip': data.get('ip', ip),
                        'found': True,
                        'ports': data.get('ports', []),
                        'hostnames': data.get('hostnames', []),
                        'cpes': data.get('cpes', []),
                        'vulns': data.get('vulns', []),
                        'tags': data.get('tags', [])
                    }
                }
            }

            self.emit_progress(socketio, namespace, 100, "Complete", room=room)
            self.emit_result(socketio, namespace, result, room=room)
            self.logger.info(f"IP intelligence lookup completed for: {ip}")

            return result

        except requests.exceptions.Timeout:
            error_msg = "Request timed out while querying Shodan InternetDB"
            self.logger.error(error_msg)
            self.emit_error(socketio, namespace, error_msg, room=room)
            return {'error': error_msg}

        except requests.exceptions.ConnectionError:
            error_msg = "Could not connect to Shodan InternetDB"
            self.logger.error(error_msg)
            self.emit_error(socketio, namespace, error_msg, room=room)
            return {'error': error_msg}

        except Exception as e:
            error_msg = f"Error in IP intelligence lookup: {str(e)}"
            self.logger.error(error_msg)
            self.emit_error(socketio, namespace, error_msg, room=room)
            return {'error': error_msg}


# Create a singleton instance for import
ip_module = IpModule()
