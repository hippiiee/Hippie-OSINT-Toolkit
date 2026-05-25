"""Load the shared socket event manifest (single source of truth with the frontend)."""

import json
import os
from typing import Any, Dict

_MANIFEST_PATH = os.path.join(os.path.dirname(__file__), "..", "socket_events.json")

with open(_MANIFEST_PATH, "r", encoding="utf-8") as _f:
    _MANIFEST: Dict[str, Any] = json.load(_f)

NAMESPACES: Dict[str, Dict[str, str]] = _MANIFEST["namespaces"]
SERVER_EVENTS: Dict[str, str] = _MANIFEST["serverEvents"]


def event(namespace: str, key: str) -> str:
    """Return the socket event name for a (namespace, key) pair, e.g. ('discord', 'search')."""
    return NAMESPACES[namespace][key]


def ns(namespace: str) -> str:
    """Return the slash-prefixed socket.io namespace string."""
    return f"/{namespace}"
