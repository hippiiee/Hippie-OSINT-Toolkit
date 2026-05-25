import requests
import logging
import asyncio
from datetime import datetime
from core.base_module import OsintModule


class WaybackModule(OsintModule):
    """Module for querying the Internet Archive Wayback Machine CDX API."""

    def __init__(self):
        super().__init__("wayback")
        self.cdx_url = "https://web.archive.org/cdx/search/cdx"

    @staticmethod
    def _format_timestamp(ts: str) -> str:
        """Convert a CDX timestamp (YYYYMMDDHHmmss) to a human-readable string."""
        try:
            dt = datetime.strptime(ts, "%Y%m%d%H%M%S")
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except (ValueError, TypeError):
            return ts

    async def search(self, query, socketio, namespace, **kwargs):
        return self.search_sync(query, socketio, namespace, **kwargs)

    def search_sync(self, query: str, socketio, namespace: str, **kwargs) -> dict:
        """
        Search the Wayback Machine for archived snapshots of a domain.

        Args:
            query: Domain or URL to search
            socketio: SocketIO instance
            namespace: SocketIO namespace

        Returns:
            Dict containing snapshot results
        """
        self.logger.info(f"Starting Wayback Machine lookup for: {query}")
        cancel_event = kwargs.get("cancel_event")
        room = kwargs.get("room")

        try:
            # --- Stage 1: Query the CDX API ---
            self.emit_progress(socketio, namespace, 10, "Querying Wayback Machine CDX API...", room=room)

            if self.handle_cancellation(cancel_event):
                return {"cancelled": True}

            params = {
                "url": query,
                "output": "json",
                "fl": "timestamp,original,statuscode,mimetype,digest,length",
                "collapse": "digest",
                "limit": 500,
                "matchType": "domain",
                "filter": "statuscode:200",
            }

            response = requests.get(self.cdx_url, params=params, timeout=30)

            if self.handle_cancellation(cancel_event):
                return {"cancelled": True}

            response.raise_for_status()

            # --- Stage 2: Parse the response ---
            self.emit_progress(socketio, namespace, 40, "Parsing CDX response...", room=room)

            data = response.json()

            if not data or len(data) < 2:
                self.emit_error(
                    socketio, namespace,
                    "No archived snapshots found for this domain.",
                    room=room,
                )
                return {"error": "No snapshots found"}

            # First row is headers, the rest is data
            headers = data[0]
            rows = data[1:]

            if self.handle_cancellation(cancel_event):
                return {"cancelled": True}

            # --- Stage 3: Process snapshots ---
            self.emit_progress(socketio, namespace, 60, "Processing snapshots...", room=room)

            snapshots = []
            unique_urls = set()
            all_timestamps = []

            for row in rows:
                entry = dict(zip(headers, row))

                timestamp_raw = entry.get("timestamp", "")
                original_url = entry.get("original", "")
                status_code = entry.get("statuscode", "")
                mimetype = entry.get("mimetype", "")
                length = entry.get("length", "")

                formatted_date = self._format_timestamp(timestamp_raw)
                archive_url = f"https://web.archive.org/web/{timestamp_raw}/{original_url}"

                unique_urls.add(original_url)
                all_timestamps.append(timestamp_raw)

                snapshots.append({
                    "timestamp": timestamp_raw,
                    "date": formatted_date,
                    "original_url": original_url,
                    "status_code": status_code,
                    "mimetype": mimetype,
                    "length": length,
                    "archive_url": archive_url,
                })

            if self.handle_cancellation(cancel_event):
                return {"cancelled": True}

            # --- Stage 4: Compute summary ---
            self.emit_progress(socketio, namespace, 80, "Computing summary...", room=room)

            sorted_timestamps = sorted(all_timestamps)
            first_snapshot = self._format_timestamp(sorted_timestamps[0]) if sorted_timestamps else "N/A"
            last_snapshot = self._format_timestamp(sorted_timestamps[-1]) if sorted_timestamps else "N/A"
            sorted_unique_urls = sorted(unique_urls)

            result = {
                "result": {
                    "module": "wayback",
                    "results": {
                        "total_snapshots": len(snapshots),
                        "unique_url_count": len(sorted_unique_urls),
                        "unique_urls": sorted_unique_urls,
                        "first_snapshot": first_snapshot,
                        "last_snapshot": last_snapshot,
                        "snapshots": snapshots[:200],
                    },
                }
            }

            self.emit_progress(socketio, namespace, 100, "Done!", room=room)
            self.emit_result(socketio, namespace, result, room=room)
            self.logger.info(
                f"Wayback lookup completed: {len(snapshots)} snapshots, "
                f"{len(sorted_unique_urls)} unique URLs"
            )

            return result

        except requests.exceptions.Timeout:
            error_msg = "Wayback Machine CDX API request timed out. The service may be slow — please try again later."
            self.logger.error(error_msg)
            self.emit_error(socketio, namespace, error_msg, room=room)
            return {"error": error_msg}
        except requests.exceptions.RequestException as e:
            error_msg = f"Error querying Wayback Machine: {str(e)}"
            self.logger.error(error_msg)
            self.emit_error(socketio, namespace, error_msg, room=room)
            return {"error": error_msg}
        except Exception as e:
            error_msg = f"Unexpected error in Wayback Machine lookup: {str(e)}"
            self.logger.error(error_msg)
            self.emit_error(socketio, namespace, error_msg, room=room)
            return {"error": error_msg}


# Create a singleton instance for import
wayback_module = WaybackModule()
