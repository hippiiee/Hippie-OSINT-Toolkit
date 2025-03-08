"""
Utility functions for OSINT modules

This module provides common utility functions that can be used across all OSINT modules.
"""

import re
import json
import logging
import asyncio
from typing import Dict, Any, List, Tuple, Optional
import aiohttp
from aiohttp import ClientSession, ClientTimeout

logger = logging.getLogger(__name__)

# Common validation functions
def is_valid_email(email: str) -> Tuple[bool, str]:
    """Validate email format"""
    regex = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
    return (re.match(regex, email) is not None, "Invalid email format")

def is_valid_phone(phone: str) -> Tuple[bool, str]:
    """Validate phone number format"""
    regex = r'^\+?[1-9]\d{1,14}$'
    return (re.match(regex, phone) is not None, "Invalid phone number format")

def is_valid_domain(domain: str) -> Tuple[bool, str]:
    """Validate domain format"""
    regex = r'^(?!-)[A-Za-z0-9-]{1,63}(?<!-)\.[A-Za-z]{2,6}$'
    return (re.match(regex, domain) is not None, "Invalid domain format")

def is_valid_username(username: str) -> Tuple[bool, str]:
    """Validate username is not empty"""
    return (bool(username), "Username is required")

def is_valid_url(url: str) -> Tuple[bool, str]:
    """Validate URL format"""
    regex = r'^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$'
    return (re.match(regex, url) is not None, "Invalid URL format")

# HTTP request utilities
async def make_http_request(url: str, method: str = 'GET', headers: Dict = None, 
                           data: Any = None, timeout: int = 30, 
                           json_response: bool = True) -> Tuple[bool, Any]:
    """
    Make an HTTP request with error handling.
    
    Args:
        url: The URL to request
        method: HTTP method (GET, POST, etc.)
        headers: Request headers
        data: Request data/payload
        timeout: Request timeout in seconds
        json_response: Whether to parse response as JSON
        
    Returns:
        Tuple of (success, response_data)
    """
    if headers is None:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    
    client_timeout = ClientTimeout(total=timeout)
    
    try:
        async with ClientSession(headers=headers, timeout=client_timeout) as session:
            if method.upper() == 'GET':
                async with session.get(url) as response:
                    if not response.ok:
                        return False, f"HTTP error: {response.status}"
                    
                    if json_response:
                        return True, await response.json()
                    return True, await response.text()
                    
            elif method.upper() == 'POST':
                async with session.post(url, data=data) as response:
                    if not response.ok:
                        return False, f"HTTP error: {response.status}"
                    
                    if json_response:
                        return True, await response.json()
                    return True, await response.text()
            else:
                return False, f"Unsupported HTTP method: {method}"
                
    except aiohttp.ClientError as e:
        logger.error(f"HTTP request error: {str(e)}")
        return False, f"Request error: {str(e)}"
    except asyncio.TimeoutError:
        logger.error(f"Request to {url} timed out after {timeout}s")
        return False, "Request timed out"
    except Exception as e:
        logger.error(f"Unexpected error during HTTP request: {str(e)}")
        return False, f"Error: {str(e)}"

# Data processing utilities
def format_response(module_name: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format a response in a standardized structure
    
    Args:
        module_name: Name of the module generating the response
        data: Response data
        
    Returns:
        Formatted response dictionary
    """
    return {
        'result': {
            'module': module_name,
            'data': data
        }
    }

def safe_json_loads(text: str) -> Tuple[bool, Any]:
    """
    Safely parse JSON with error handling
    
    Args:
        text: JSON string to parse
        
    Returns:
        Tuple of (success, parsed_data)
    """
    try:
        return True, json.loads(text)
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {str(e)}")
        return False, f"JSON decode error: {str(e)}"
    except Exception as e:
        logger.error(f"Error parsing JSON: {str(e)}")
        return False, f"Error: {str(e)}"
