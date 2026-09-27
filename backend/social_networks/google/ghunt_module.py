"""Run GHunt in its isolated environment with bounded, private diagnostics."""
import asyncio
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

from core.base_module import OsintModule


class GoogleModule(OsintModule):
    def __init__(self):
        super().__init__("google")
        self.ghunt_path = os.environ.get("GHUNT_EXECUTABLE") or shutil.which("ghunt") or "/root/.local/bin/ghunt"
        self.timeout = 180

    @staticmethod
    def _failure_message(output):
        """Classify failures without exposing raw output, tokens or account data."""
        if "KeyError: 'container'" in output:
            return "GHunt could not parse Google's response. Update the backend's pinned GHunt dependency."
        if any(marker in output for marker in (
            "GHuntInvalidSession", "GHuntLoginError", "GHuntAndroidAppOAuth2Error",
            "GHuntAndroidMasterAuthError", "No stored session", "ghunt login",
        )):
            return "GHunt's Google session is missing, invalid or expired. Reauthenticate GHunt and update the server session."
        if any(marker in output for marker in (
            "The target wasn't found", "does not match a public Google Account",
        )):
            return "No public Google account was found for this email address."
        if any(marker in output for marker in ("TimeoutException", "ReadTimeout", "ConnectTimeout", "ConnectError")):
            return "GHunt could not reach a Google service. Please try again later."
        return "GHunt failed while processing Google's response. No complete result was returned."

    @staticmethod
    async def _stop_process(process):
        if process is None or process.returncode is not None:
            return
        try:
            process.terminate()
        except ProcessLookupError:
            pass
        try:
            await asyncio.wait_for(process.wait(), timeout=5)
        except asyncio.TimeoutError:
            try:
                process.kill()
            except ProcessLookupError:
                pass
            await process.wait()

    async def search(self, email, socketio, namespace, **kwargs):
        room = kwargs.get("room")
        cancel_event = kwargs.get("cancel_event")
        process = None
        self.logger.info("Starting GHunt lookup")
        try:
            if self.is_cancelled(cancel_event):
                return {"cancelled": True}
            # Directory permissions keep credentials/account data out of shared /tmp
            # and remove both output files on success, failure and cancellation.
            with tempfile.TemporaryDirectory(prefix="ghunt-") as temp_dir:
                output_file = Path(temp_dir) / "result.json"
                log_file = Path(temp_dir) / "diagnostic.log"
                with log_file.open("wb") as diagnostic:
                    process = await asyncio.create_subprocess_exec(
                        self.ghunt_path, "email", "--json", str(output_file), email,
                        stdin=subprocess.DEVNULL, stdout=diagnostic, stderr=diagnostic,
                    )
                    try:
                        deadline = asyncio.get_running_loop().time() + self.timeout
                        while process.returncode is None:
                            if self.is_cancelled(cancel_event):
                                return {"cancelled": True}
                            remaining = deadline - asyncio.get_running_loop().time()
                            if remaining <= 0:
                                raise TimeoutError("GHunt lookup timed out. Please try again later.")
                            try:
                                await asyncio.wait_for(process.wait(), timeout=min(0.2, remaining))
                            except asyncio.TimeoutError:
                                continue
                    finally:
                        await self._stop_process(process)

                if self.is_cancelled(cancel_event):
                    return {"cancelled": True}
                if process.returncode != 0:
                    with log_file.open("rb") as diagnostic:
                        diagnostic.seek(0, os.SEEK_END)
                        diagnostic.seek(max(0, diagnostic.tell() - 65536))
                        message = self._failure_message(diagnostic.read().decode("utf-8", errors="replace"))
                    self.logger.warning("GHunt exited with status %s", process.returncode)
                    self.emit_error(socketio, namespace, message, room=room)
                    return {"error": message}

                try:
                    email_info = json.loads(output_file.read_text(encoding="utf-8"))
                    if not isinstance(email_info, dict) or not email_info:
                        raise ValueError("Empty GHunt result")
                except (OSError, ValueError):
                    message = "GHunt returned an empty or invalid JSON result."
                    self.emit_error(socketio, namespace, message, room=room)
                    return {"error": message}

                result = {"result": {"module": "google", "found": email_info}}
                self.emit_result(socketio, namespace, result, room=room)
                self.logger.info("GHunt lookup completed")
                return result
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            if self.is_cancelled(cancel_event):
                return {"cancelled": True}
            if isinstance(exc, FileNotFoundError):
                message = "GHunt executable is missing from the backend. Rebuild the backend image."
            elif isinstance(exc, TimeoutError):
                message = "GHunt lookup timed out. Please try again later."
            else:
                message = "Unable to run GHunt. Check the backend installation."
            # Exception type is useful diagnostically; exception text may contain secrets.
            self.logger.error("GHunt runner failed (%s)", type(exc).__name__)
            self.emit_error(socketio, namespace, message, room=room)
            return {"error": message}


google_module = GoogleModule()
