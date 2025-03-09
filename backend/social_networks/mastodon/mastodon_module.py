import requests
from bs4 import BeautifulSoup
import json
from w3lib.html import remove_tags
import asyncio
import logging
import concurrent.futures
import traceback
import aiohttp
from core.base_module import OsintModule

class MastodonModule(OsintModule):
    """Module for Mastodon user and instance lookups"""
    
    def __init__(self):
        super().__init__("mastodon")
        # Create a thread pool executor for running blocking functions that can't be async
        self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=3)
    
    async def run_in_executor(self, func, *args, **kwargs):
        """Run a blocking function in a thread pool executor"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self.executor, lambda: func(*args, **kwargs))
    
    def handle_cancellation(self, cancel_event):
        """Check if the search has been cancelled"""
        if cancel_event and cancel_event.is_set():
            self.logger.info("Search cancelled")
            return True
        return False
    
    async def search(self, query: str, socketio, namespace: str, **kwargs) -> dict:
        """
        Search for Mastodon user or instance
        
        Args:
            query: Username or instance to search
            socketio: SocketIO instance
            namespace: SocketIO namespace
            
        Returns:
            Dict containing the Mastodon data
        """
        search_type = kwargs.get('search_type', 'username')
        cancel_event = kwargs.get('cancel_event')
        self.logger.info(f"Starting Mastodon {search_type} lookup for: {query}")
        
        try:
            # Check for cancellation at the start
            if self.handle_cancellation(cancel_event):
                self.logger.info("Search cancelled at start")
                return {'cancelled': True}
                
            if search_type == 'instance':
                self.logger.info(f"Performing instance search for: {query}")
                result = await self.instance_search(query, cancel_event)
                
                # Check for cancellation after instance search
                if self.handle_cancellation(cancel_event):
                    return {'cancelled': True}
            else:  # username search by default
                self.logger.info(f"Performing username search for: {query}")
                
                api_task = asyncio.create_task(self.username_search_api(query, cancel_event))
                instances_task = asyncio.create_task(self.username_search(query, cancel_event))
                
                done, pending = await asyncio.wait(
                    [api_task, instances_task],
                    return_when=asyncio.ALL_COMPLETED
                )
                
                if self.handle_cancellation(cancel_event):
                    for task in pending:
                        task.cancel()
                    self.logger.info("Search cancelled after tasks")
                    return {'cancelled': True}
                
                api_result = api_task.result()
                instances_result = instances_task.result()
                
                if api_result.get('cancelled') or instances_result.get('cancelled'):
                    return {'cancelled': True}
                
                # Combine results
                result = {
                    'result': {
                        'module': 'mastodon',
                        'results': {
                            'api_data': api_result,
                            'instances': instances_result
                        }
                    }
                }
            
            # Check for cancellation before emitting result
            if self.handle_cancellation(cancel_event):
                self.logger.info("Search cancelled before emitting result")
                return {'cancelled': True}
                
            # Emit result
            self.emit_result(socketio, namespace, result)
            self.logger.info("Mastodon lookup completed")
            
            return result
            
        except asyncio.CancelledError:
            self.logger.info("Mastodon search was cancelled")
            return {'cancelled': True}
        except Exception as e:
            error_msg = f"Error in Mastodon lookup: {str(e)}"
            self.logger.error(error_msg)
            self.logger.error(traceback.format_exc())
            self.emit_error(socketio, namespace, error_msg)
            return {'error': error_msg}
    
    async def instance_search(self, instance, cancel_event=None):
        """Search for a Mastodon instance"""
        self.logger.info(f"Searching for instance: {instance}")
        headers = {
            "Accept": "text/html, application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "accept-language": "en-US;q=0.9,en;q=0.8",
            "accept-encoding": "gzip, deflate",
            "user-Agent": "Mozilla/5.0 (Windows NT 10.0;Win64; x64) AppleWebKit/537.36 (HTML, like Gecko) "
                        "Chrome/104.0.0.0 Safari/537.36",
        }
        inst_url = f"https://{instance}/api/v1/instance"
        try:
            # Check for cancellation before making request
            if self.handle_cancellation(cancel_event):
                return {"cancelled": True}
                
            self.logger.info(f"Making request to: {inst_url}")
            timeout = aiohttp.ClientTimeout(total=10)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(inst_url, headers=headers) as response:
                    inst_data = await response.json()
            self.logger.info("Instance data retrieved successfully")
            
            # Check for cancellation after getting data
            if self.handle_cancellation(cancel_event):
                return {"cancelled": True}
        except Exception as e:
            self.logger.error(f"Error fetching instance data: {e}")
            return {"error": f"Error fetching instance data: {e}"}

        if not inst_data:
            self.logger.warning(f"Mastodon instance [{instance}] NOT found!")
            return {"error": f"Mastodon instance [{instance}] NOT found!"}

        return self.format_instance_info(inst_data)
    
    def format_instance_info(self, inst_data):
        """Format instance information"""
        try:
            instance_info = {
                "instance": inst_data["uri"],
                "title": inst_data["title"],
                "description": remove_tags(inst_data["short_description"]),
                "detailed_description": remove_tags(inst_data["description"]),
                "email": inst_data["email"],
                "thumbnail": inst_data["thumbnail"],
                "languages": inst_data["languages"],
                "registrations": inst_data["registrations"],
                "approval_required": inst_data["approval_required"],
                "admin_info": self.format_admin_info(inst_data["contact_account"]),
            }
            return instance_info
        except Exception as e:
            self.logger.error(f"Error formatting instance info: {e}")
            return {"error": f"Error formatting instance info: {e}"}

    def format_admin_info(self, admin_data):
        """Format admin information"""
        try:
            return {key: admin_data.get(key) for key in [
                "id", "username", "acct", "display_name", "followers_count",
                "following_count", "statuses_count", "last_status_at", "locked",
                "bot", "discoverable", "group", "created_at", "url", "avatar", "header",
            ]}
        except Exception as e:
            self.logger.error(f"Error formatting admin info: {e}")
            return {"error": f"Error formatting admin info: {e}"}

    async def username_search_api(self, username, cancel_event=None):
        """Search for a username using the Mastodon API"""
        self.logger.info(f"Searching for username via API: {username}")
        try:
            # Check for cancellation before making request
            if self.handle_cancellation(cancel_event):
                return {"cancelled": True}
                
            url = f"https://mastodon.social/api/v2/search?q={username}"
            self.logger.info(f"Making request to: {url}")
            timeout = aiohttp.ClientTimeout(total=10)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url) as response:
                    data = await response.json()
            self.logger.info("API data retrieved successfully")
            
            # Check for cancellation after getting data
            if self.handle_cancellation(cancel_event):
                return {"cancelled": True}

            if not data.get("accounts"):
                self.logger.warning("Username not found on Mastodon API")
                return {"error": "Username not found on Mastodon API"}

            return self.format_user_info(data["accounts"], username)
        except Exception as e:
            self.logger.error(f"Error in API search: {e}")
            return {"error": f"Error in API search: {e}"}

    def format_user_info(self, accounts, username):
        """Format user information"""
        try:
            for intelligence in accounts:
                if intelligence["username"].lower() == username.lower():
                    return self.format_account_details(intelligence)

            self.logger.warning(f"Target username: [{username}] NOT found!")
            return {"error": f"Target username: [{username}] NOT found!"}
        except Exception as e:
            self.logger.error(f"Error formatting user info: {e}")
            return {"error": f"Error formatting user info: {e}"}

    def format_account_details(self, intelligence):
        """Format account details"""
        try:
            fields = []
            for field in intelligence.get("fields", []):
                name = field.get("name")
                value = field.get("value")
                if value and "</" not in value:
                    continue
                soup = BeautifulSoup(value, "html.parser")
                a = soup.find("a")
                if a:
                    fields.append({name: a.get("href")})

            account_details = {
                "user_id": intelligence["id"],
                "profile_url": intelligence["url"],
                "locked": intelligence["locked"],
                "username": intelligence["username"],
                "acct": intelligence["acct"],
                "display_name": intelligence["display_name"],
                "created_at": intelligence["created_at"],
                "bot": intelligence["bot"],
                "discoverable": intelligence["discoverable"],
                "followers_count": intelligence["followers_count"],
                "following_count": intelligence["following_count"],
                "statuses_count": intelligence["statuses_count"],
                "last_status_at": intelligence["last_status_at"],
                "group": intelligence["group"],
                "bio": remove_tags(intelligence["note"]),
                "fields": fields,
                "avatar": intelligence["avatar"],
            }
            return account_details
        except Exception as e:
            self.logger.error(f"Error formatting account details: {e}")
            return {"error": f"Error formatting account details: {e}"}

    async def username_search(self, username, cancel_event=None):
        """Search for a username across Mastodon instances"""
        self.logger.info(f"Searching for username across instances: {username}")
        headers = {
            "Accept": "text/html, application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "accept-language": "en-US;q=0.9,en;q=0.8",
            "accept-encoding": "gzip, deflate",
            "user-Agent": "Mozilla/5.0 (Windows NT 10.0;Win64; x64) AppleWebKit/537.36 (HTML, like Gecko) "
                        "Chrome/104.0.0.0 Safari/537.36",
        }

        try:
            # Check for cancellation before fetching instances
            if self.handle_cancellation(cancel_event):
                return {"cancelled": True}
                
            self.logger.info("Fetching list of Mastodon instances...")
            timeout = aiohttp.ClientTimeout(total=10)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get("https://raw.githubusercontent.com/C3n7ral051nt4g3ncy/Masto/master/fediverse_instances.json") as response:
                    text_content = await response.text()
                    sites_data = json.loads(text_content)
                    sites = sites_data["sites"]
            
            self.logger.info(f"Retrieved {len(sites)} instances to check")
            
            # Check for cancellation after fetching instances list
            if self.handle_cancellation(cancel_event):
                return {"cancelled": True}
            
            semaphore = asyncio.Semaphore(15)
            matched_sites = []
            
            async def check_instance(site):
                # Check for cancellation before checking each instance
                if cancel_event and cancel_event.is_set():
                    return None
                    
                uri_check = site["uri_check"].format(account=username)
                try:
                    async with semaphore:
                        if cancel_event and cancel_event.is_set():
                            return None
                            
                        self.logger.debug(f"Checking instance: {uri_check}")
                        timeout = aiohttp.ClientTimeout(total=5)
                        async with aiohttp.ClientSession(timeout=timeout) as session:
                            async with session.get(uri_check, headers=headers) as res:
                                if res.status == 200:
                                    text = await res.text()
                                    if site["e_string"] in text:
                                        self.logger.info(f"Found match on instance: {site['name']}")
                                        return {
                                            "name": site['name'],
                                            "profile_url": uri_check
                                        }
                except asyncio.TimeoutError:
                    self.logger.debug(f"Timeout checking {uri_check}")
                except asyncio.CancelledError:
                    self.logger.debug(f"Task cancelled for {uri_check}")
                    raise
                except Exception as e:
                    self.logger.debug(f"Error checking {uri_check}: {e}")
                return None
            
            tasks = []
            for site in sites:
                if self.handle_cancellation(cancel_event):
                    return {"cancelled": True}
                task = asyncio.create_task(check_instance(site))
                tasks.append(task)
            
            for future in asyncio.as_completed(tasks):
                if self.handle_cancellation(cancel_event):
                    for task in tasks:
                        if not task.done():
                            task.cancel()
                    return {"cancelled": True}
                
                try:
                    result = await future
                    if result:
                        matched_sites.append(result)
                        
                        if len(matched_sites) >= 5:
                            self.logger.info(f"Found {len(matched_sites)} matches, stopping early")
                            for task in tasks:
                                if not task.done():
                                    task.cancel()
                            break
                except asyncio.CancelledError:
                    continue
                except Exception as e:
                    self.logger.debug(f"Error processing task result: {e}")

            if self.handle_cancellation(cancel_event):
                return {"cancelled": True}

            if not matched_sites:
                self.logger.warning("Username not found on any instance")
                return {"error": "Username not found on the server database"}

            self.logger.info(f"Found {len(matched_sites)} matching instances")
            return {"matched_sites": matched_sites}
        except asyncio.CancelledError:
            self.logger.info("Instance search was cancelled")
            return {"cancelled": True}
        except Exception as e:
            self.logger.error(f"Error in instance search: {e}")
            return {"error": f"Error in instance search: {e}"}


# Create a singleton instance for import
mastodon_module = MastodonModule()