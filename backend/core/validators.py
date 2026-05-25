"""
Input validators for OSINT modules.

Each validator returns (is_valid: bool, error_message: str).

`is_valid_url` and `is_valid_domain` reject private/loopback/link-local hosts
so modules that fetch the URL/domain server-side can't be coerced into SSRF.
"""

import ipaddress
import re
import socket
from typing import Tuple
from urllib.parse import urlparse

import tldextract

_EMAIL_RE = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
_PHONE_RE = re.compile(r"^\+?[1-9]\d{1,14}$")
_HOSTNAME_LABEL_RE = re.compile(r"^(?!-)[A-Za-z0-9-]{1,63}(?<!-)$")
_ALLOWED_URL_SCHEMES = {"http", "https"}

# Use a tldextract instance with the bundled snapshot so it works offline
# in containers without reaching out to publicsuffix.org on first call.
_tld = tldextract.TLDExtract(suffix_list_urls=())


def is_valid_email(email: str) -> Tuple[bool, str]:
    if not isinstance(email, str) or not _EMAIL_RE.match(email):
        return False, "Invalid email format"
    return True, ""


def is_valid_phone(phone: str) -> Tuple[bool, str]:
    if not isinstance(phone, str) or not _PHONE_RE.match(phone):
        return False, "Invalid phone number format"
    return True, ""


def is_valid_username(username: str) -> Tuple[bool, str]:
    if not username or not isinstance(username, str):
        return False, "Username is required"
    if len(username) > 100:
        return False, "Username too long"
    return True, ""


def _hostname_is_public(hostname: str) -> Tuple[bool, str]:
    """Reject IPs and hostnames that resolve to private/loopback/link-local ranges."""
    try:
        ip = ipaddress.ip_address(hostname)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            return False, "Host resolves to a non-public address"
        return True, ""
    except ValueError:
        pass

    if hostname.lower() in {"localhost", "ip6-localhost", "ip6-loopback"}:
        return False, "Host resolves to a non-public address"

    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        return False, "Host could not be resolved"

    for info in infos:
        addr = info[4][0]
        try:
            ip = ipaddress.ip_address(addr)
        except ValueError:
            continue
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            return False, "Host resolves to a non-public address"

    return True, ""


def is_valid_domain(domain: str) -> Tuple[bool, str]:
    if not isinstance(domain, str) or not domain or len(domain) > 253:
        return False, "Invalid domain format"

    extracted = _tld.extract_str(domain)
    if not extracted.domain or not extracted.suffix:
        return False, "Invalid domain format"

    full = ".".join(p for p in (extracted.subdomain, extracted.domain, extracted.suffix) if p)
    if full.lower() != domain.lower().rstrip("."):
        return False, "Invalid domain format"

    for label in full.split("."):
        if not _HOSTNAME_LABEL_RE.match(label):
            return False, "Invalid domain format"

    ok, err = _hostname_is_public(full)
    if not ok:
        return False, err

    return True, ""


def is_valid_ip(ip: str) -> Tuple[bool, str]:
    if not isinstance(ip, str) or not ip:
        return False, "Invalid IP address"
    try:
        addr = ipaddress.ip_address(ip.strip())
        if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved or addr.is_multicast:
            return False, "Only public IP addresses are allowed"
        return True, ""
    except ValueError:
        return False, "Invalid IP address format"


_BTC_RE = re.compile(r"^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{25,90})$")
_ETH_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")


def is_valid_crypto_address(address: str) -> Tuple[bool, str]:
    if not isinstance(address, str) or not address:
        return False, "Crypto address is required"
    address = address.strip()
    if _BTC_RE.match(address) or _ETH_RE.match(address):
        return True, ""
    return False, "Invalid Bitcoin or Ethereum address format"


def is_valid_url(url: str) -> Tuple[bool, str]:
    if not isinstance(url, str) or len(url) > 2048:
        return False, "Invalid URL format"

    try:
        parsed = urlparse(url)
    except ValueError:
        return False, "Invalid URL format"

    if parsed.scheme not in _ALLOWED_URL_SCHEMES:
        return False, "Only http(s) URLs are allowed"

    if not parsed.hostname:
        return False, "Invalid URL format"

    # If host is an IP literal, validate it directly; otherwise resolve via getaddrinfo.
    ok, err = _hostname_is_public(parsed.hostname)
    if not ok:
        return False, err

    return True, ""
