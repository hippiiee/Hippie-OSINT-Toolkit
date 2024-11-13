import requests
from bs4 import BeautifulSoup
import json
from w3lib.html import remove_tags
import time
import asyncio

def instance_search(instance):
    headers = {
        "Accept": "text/html, application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US;q=0.9,en;q=0.8",
        "accept-encoding": "gzip, deflate",
        "user-Agent": "Mozilla/5.0 (Windows NT 10.0;Win64; x64) AppleWebKit/537.36 (HTML, like Gecko) "
                      "Chrome/104.0.0.0 Safari/537.36",
    }
    inst_url = f"https://{instance}/api/v1/instance"
    try:
        response = requests.get(inst_url, headers=headers)
        inst_data = response.json()
    except Exception as e:
        return {"error": f"Error fetching instance data: {e}"}

    if not inst_data:
        return {"error": f"Mastodon instance [{instance}] NOT found!"}

    return format_instance_info(inst_data)

def format_instance_info(inst_data):
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
        "admin_info": format_admin_info(inst_data["contact_account"]),
    }
    return instance_info

def format_admin_info(admin_data):
    return {key: admin_data.get(key) for key in [
        "id", "username", "acct", "display_name", "followers_count",
        "following_count", "statuses_count", "last_status_at", "locked",
        "bot", "discoverable", "group", "created_at", "url", "avatar", "header",
    ]}

def username_search_api(username):
    url = f"https://mastodon.social/api/v2/search?q={username}"
    response = requests.get(url)
    data = response.json()

    if not data["accounts"]:
        return {"error": "username not found on Mastodon API"}

    time.sleep(1)
    return format_user_info(data["accounts"], username)

def format_user_info(accounts, username):
    for intelligence in accounts:
        if intelligence["username"].lower() == username.lower():
            return format_account_details(intelligence)

    return {"error": f"Target username: [{username}] NOT found!"}

def format_account_details(intelligence):
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

def username_search(username):
    headers = {
        "Accept": "text/html, application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US;q=0.9,en;q=0.8",
        "accept-encoding": "gzip, deflate",
        "user-Agent": "Mozilla/5.0 (Windows NT 10.0;Win64; x64) AppleWebKit/537.36 (HTML, like Gecko) "
                      "Chrome/104.0.0.0 Safari/537.36",
    }

    response = requests.get("https://raw.githubusercontent.com/C3n7ral051nt4g3ncy/Masto/master/fediverse_instances.json")
    sites = response.json()["sites"]
    matched_sites = []

    for site in sites:
        uri_check = site["uri_check"].format(account=username)
        try:
            res = requests.get(uri_check, headers=headers)
            estring_pos = res.text.find(site["e_string"]) > 0
        except Exception:
            continue

        if res.status_code == 200 and estring_pos:
            matched_sites.append({
                "name": site['name'],
                "profile_url": uri_check
            })

    if not matched_sites:
        return {"error": "Username not found on the server database"}

    return {"matched_sites": matched_sites}

async def run_mastodon_username_search(username, socketio, namespace):
    result = await asyncio.to_thread(username_search_api, username)  # Use asyncio.to_thread to run blocking code
    socketio.emit('search_result', {'result': json.dumps(result)}, namespace=namespace)
    
    result = await asyncio.to_thread(username_search, username)  # Use asyncio.to_thread to run blocking code
    socketio.emit('search_result', {'result': json.dumps(result)}, namespace=namespace)

def run_mastodon_instance_search(instance, socketio, namespace):
    result = instance_search(instance)
    socketio.emit('search_result', {'result': json.dumps(result)}, namespace=namespace)