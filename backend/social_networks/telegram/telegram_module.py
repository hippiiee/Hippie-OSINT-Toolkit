import os
import re
import asyncio
import logging
import traceback
import aiohttp
from bs4 import BeautifulSoup
from core.base_module import OsintModule


class TelegramModule(OsintModule):
    """Module for Telegram username lookups via Bot API and t.me scraping"""

    def __init__(self):
        super().__init__("telegram")
        self.bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
        self.user_agent = (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _sanitize_username(raw: str) -> str:
        """Strip leading '@' or a t.me URL prefix and return the bare username."""
        username = raw.strip()
        # Handle full URLs like https://t.me/username or t.me/username
        username = re.sub(r"^https?://", "", username)
        username = re.sub(r"^t\.me/", "", username)
        # Strip leading @
        username = username.lstrip("@")
        # Remove trailing slashes or query params
        username = username.split("/")[0].split("?")[0]
        return username

    # ------------------------------------------------------------------
    # Bot API lookup
    # ------------------------------------------------------------------

    async def _bot_api_lookup(self, username: str, cancel_event=None) -> dict | None:
        """Use the Telegram Bot API getChat endpoint.

        Returns a dict of extracted fields or None on failure / missing token.
        """
        if not self.bot_token:
            self.logger.debug("No TELEGRAM_BOT_TOKEN configured, skipping Bot API")
            return None

        if self.handle_cancellation(cancel_event):
            return None

        url = f"https://api.telegram.org/bot{self.bot_token}/getChat"
        params = {"chat_id": f"@{username}"}

        try:
            timeout = aiohttp.ClientTimeout(total=15)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url, params=params) as resp:
                    data = await resp.json()

            if not data.get("ok"):
                self.logger.info(
                    f"Bot API returned ok=false for @{username}: "
                    f"{data.get('description', 'unknown error')}"
                )
                return None

            chat = data["result"]
            result: dict = {
                "source": "bot_api",
                "id": chat.get("id"),
                "type": chat.get("type"),  # private, group, supergroup, channel
                "title": chat.get("title"),
                "username": chat.get("username"),
                "first_name": chat.get("first_name"),
                "last_name": chat.get("last_name"),
                "bio": chat.get("bio"),
                "description": chat.get("description"),
                "invite_link": chat.get("invite_link"),
                "member_count": None,
            }

            # Attempt to get member count for groups/channels
            if chat.get("type") in ("supergroup", "channel", "group"):
                count_url = f"https://api.telegram.org/bot{self.bot_token}/getChatMemberCount"
                try:
                    async with aiohttp.ClientSession(timeout=timeout) as session:
                        async with session.get(count_url, params=params) as resp2:
                            count_data = await resp2.json()
                    if count_data.get("ok"):
                        result["member_count"] = count_data["result"]
                except Exception:
                    self.logger.debug("Could not fetch member count via Bot API")

            # Profile photo — get file path if available
            photo = chat.get("photo")
            if photo:
                file_id = photo.get("big_file_id") or photo.get("small_file_id")
                if file_id:
                    file_url = f"https://api.telegram.org/bot{self.bot_token}/getFile"
                    try:
                        async with aiohttp.ClientSession(timeout=timeout) as session:
                            async with session.get(file_url, params={"file_id": file_id}) as resp3:
                                file_data = await resp3.json()
                        if file_data.get("ok"):
                            file_path = file_data["result"]["file_path"]
                            result["photo_url"] = (
                                f"https://api.telegram.org/file/bot{self.bot_token}/{file_path}"
                            )
                    except Exception:
                        self.logger.debug("Could not resolve profile photo via Bot API")

            return result

        except asyncio.CancelledError:
            raise
        except Exception as e:
            self.logger.error(f"Bot API error: {e}")
            self.logger.debug(traceback.format_exc())
            return None

    # ------------------------------------------------------------------
    # t.me scraping
    # ------------------------------------------------------------------

    async def _scrape_tme(self, username: str, cancel_event=None) -> dict | None:
        """Scrape the public t.me/<username> page for profile info."""
        if self.handle_cancellation(cancel_event):
            return None

        url = f"https://t.me/{username}"
        headers = {
            "User-Agent": self.user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }

        try:
            timeout = aiohttp.ClientTimeout(total=15)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url, headers=headers) as resp:
                    if resp.status != 200:
                        self.logger.info(f"t.me returned status {resp.status} for @{username}")
                        return None
                    html = await resp.text()

            soup = BeautifulSoup(html, "html.parser")

            # --- Open-Graph meta tags ---
            og_title = self._meta(soup, "og:title")
            og_description = self._meta(soup, "og:description")
            og_image = self._meta(soup, "og:image")

            # --- Determine entity type from page content ---
            page_text = soup.get_text(" ", strip=True).lower()
            entity_type = "user"
            if "subscribers" in page_text or "subscriber" in page_text:
                entity_type = "channel"
            elif "members" in page_text or "member" in page_text:
                entity_type = "group"
            # Check for bot indicator
            if soup.find("a", class_="tgme_action_button_new"):
                btn_text = soup.find("a", class_="tgme_action_button_new")
                if btn_text and "send message" in btn_text.get_text(strip=True).lower():
                    pass  # could be user or bot
            # Look for explicit bot marker
            if username.lower().endswith("bot"):
                entity_type = "bot"

            # --- Extract member / subscriber count ---
            member_count = None
            extra_div = soup.find("div", class_="tgme_page_extra")
            if extra_div:
                extra_text = extra_div.get_text(strip=True)
                # Match patterns like "12 345 subscribers", "1 234 members", "42 members"
                count_match = re.search(r"([\d\s]+)\s*(subscribers?|members?|online)", extra_text, re.IGNORECASE)
                if count_match:
                    count_str = count_match.group(1).replace(" ", "").replace("\xa0", "")
                    try:
                        member_count = int(count_str)
                    except ValueError:
                        pass

            # --- Bio / description from page ---
            bio = None
            bio_div = soup.find("div", class_="tgme_page_description")
            if bio_div:
                bio = bio_div.get_text(strip=True)

            # --- Display name ---
            display_name = None
            name_div = soup.find("div", class_="tgme_page_title")
            if name_div:
                display_name = name_div.get_text(strip=True)
            if not display_name:
                display_name = og_title

            # --- Check if profile actually exists ---
            # t.me returns a page with a specific class when the user doesn't exist
            not_found = soup.find("div", class_="tgme_page_additional")
            page_action = soup.find("a", class_="tgme_action_button_new")
            if not display_name and not page_action and not not_found:
                # Likely a 200 page but no actual profile
                return None

            result = {
                "source": "tme_scrape",
                "display_name": display_name,
                "username": username,
                "bio": bio or og_description,
                "photo_url": og_image,
                "type": entity_type,
                "member_count": member_count,
                "profile_url": f"https://t.me/{username}",
            }
            return result

        except asyncio.CancelledError:
            raise
        except Exception as e:
            self.logger.error(f"t.me scrape error: {e}")
            self.logger.debug(traceback.format_exc())
            return None

    @staticmethod
    def _meta(soup: BeautifulSoup, prop: str) -> str | None:
        tag = soup.find("meta", property=prop)
        if tag:
            return tag.get("content")
        return None

    # ------------------------------------------------------------------
    # Combine results
    # ------------------------------------------------------------------

    @staticmethod
    def _merge_results(bot_data: dict | None, scrape_data: dict | None) -> dict:
        """Merge Bot API and scrape results, preferring Bot API for structured fields."""
        merged: dict = {
            "id": None,
            "type": "user",
            "display_name": None,
            "username": None,
            "first_name": None,
            "last_name": None,
            "bio": None,
            "description": None,
            "photo_url": None,
            "member_count": None,
            "invite_link": None,
            "profile_url": None,
            "bot_api_available": bot_data is not None,
        }

        # Layer scrape data first (lower priority)
        if scrape_data:
            merged["display_name"] = scrape_data.get("display_name")
            merged["username"] = scrape_data.get("username")
            merged["bio"] = scrape_data.get("bio")
            merged["photo_url"] = scrape_data.get("photo_url")
            merged["type"] = scrape_data.get("type", "user")
            merged["member_count"] = scrape_data.get("member_count")
            merged["profile_url"] = scrape_data.get("profile_url")

        # Layer Bot API data on top (higher priority)
        if bot_data:
            merged["id"] = bot_data.get("id")
            if bot_data.get("type"):
                merged["type"] = bot_data["type"]
            if bot_data.get("title"):
                merged["display_name"] = bot_data["title"]
            elif bot_data.get("first_name"):
                parts = [bot_data.get("first_name", ""), bot_data.get("last_name", "")]
                merged["display_name"] = " ".join(p for p in parts if p)
            merged["first_name"] = bot_data.get("first_name")
            merged["last_name"] = bot_data.get("last_name")
            if bot_data.get("username"):
                merged["username"] = bot_data["username"]
            if bot_data.get("bio"):
                merged["bio"] = bot_data["bio"]
            if bot_data.get("description"):
                merged["description"] = bot_data["description"]
            if bot_data.get("photo_url"):
                merged["photo_url"] = bot_data["photo_url"]
            if bot_data.get("member_count") is not None:
                merged["member_count"] = bot_data["member_count"]
            if bot_data.get("invite_link"):
                merged["invite_link"] = bot_data["invite_link"]

        # Ensure profile URL is always set
        if not merged["profile_url"] and merged["username"]:
            merged["profile_url"] = f"https://t.me/{merged['username']}"

        return merged

    # ------------------------------------------------------------------
    # Main search entry point
    # ------------------------------------------------------------------

    async def search(self, query: str, socketio, namespace: str, **kwargs) -> dict:
        """
        Search for a Telegram username/channel/group.

        Args:
            query: Telegram username, @handle, or t.me URL
            socketio: SocketIO instance
            namespace: SocketIO namespace

        Returns:
            Dict containing combined search results
        """
        cancel_event = kwargs.get("cancel_event")
        room = kwargs.get("room")

        username = self._sanitize_username(query)
        if not username:
            self.emit_error(socketio, namespace, "Please provide a valid Telegram username.", room=room)
            return {"error": "Empty username"}

        self.logger.info(f"Starting Telegram lookup for: @{username}")

        try:
            # Emit initial progress
            self.emit_progress(socketio, namespace, 10, "Starting Telegram lookup...", room=room)

            if self.handle_cancellation(cancel_event):
                return {"cancelled": True}

            # Run Bot API and t.me scrape concurrently
            self.emit_progress(socketio, namespace, 30, "Querying Telegram sources...", room=room)

            bot_task = asyncio.create_task(self._bot_api_lookup(username, cancel_event))
            scrape_task = asyncio.create_task(self._scrape_tme(username, cancel_event))

            await asyncio.wait([bot_task, scrape_task], return_when=asyncio.ALL_COMPLETED)

            if self.handle_cancellation(cancel_event):
                return {"cancelled": True}

            bot_data = bot_task.result()
            scrape_data = scrape_task.result()

            self.emit_progress(socketio, namespace, 70, "Processing results...", room=room)

            # If both sources returned nothing, the profile likely doesn't exist
            if bot_data is None and scrape_data is None:
                self.emit_error(
                    socketio,
                    namespace,
                    f"Telegram profile @{username} not found or is private.",
                    room=room,
                )
                return {"error": f"Profile @{username} not found"}

            # Merge results
            merged = self._merge_results(bot_data, scrape_data)

            self.emit_progress(socketio, namespace, 90, "Finalizing...", room=room)

            result = {
                "result": {
                    "module": "telegram",
                    "data": merged,
                }
            }

            if self.handle_cancellation(cancel_event):
                return {"cancelled": True}

            self.emit_result(socketio, namespace, result, room=room)
            self.logger.info("Telegram lookup completed")
            return result

        except asyncio.CancelledError:
            self.logger.info("Telegram search was cancelled")
            return {"cancelled": True}
        except Exception as e:
            error_msg = f"Error in Telegram lookup: {str(e)}"
            self.logger.error(error_msg)
            self.logger.error(traceback.format_exc())
            self.emit_error(socketio, namespace, error_msg, room=room)
            return {"error": error_msg}


# Create a singleton instance for import
telegram_module = TelegramModule()
