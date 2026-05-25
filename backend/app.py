import eventlet
eventlet.monkey_patch()

import asyncio
import logging
import os
import threading
from functools import wraps
from typing import Callable, Dict, Optional, Tuple

from flask import Flask, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_socketio import SocketIO

from core import socket_events as se
from core.validators import (
    is_valid_domain,
    is_valid_email,
    is_valid_phone,
    is_valid_url,
    is_valid_username,
)
from domain.subdomains.crtsh_module import crtsh_module
from domain.whois.whois_module import whois_module
from social_networks.discord.discord_module import discord_module
from social_networks.github.osgint_module import github_module
from social_networks.google.ghunt_module import google_module
from social_networks.mastodon.mastodon_module import mastodon_module
from social_networks.reddit.reddit_module import run_reddit
from social_networks.tiktok.tiktok_module import tiktok_module
from username.whatsmyname.whatsmyname_module import whatsmyname_module

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

io = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="eventlet",
    logger=True,
    engineio_logger=True,
    ping_timeout=60,
    ping_interval=25,
)

limiter = Limiter(get_remote_address, app=app, default_limits=["10 per minute"], storage_uri="memory://")


# ---------------------------------------------------------------------------
# Per-client task tracking
# ---------------------------------------------------------------------------
# Keyed by (namespace, sid) so two clients on the same namespace don't cancel
# each other. Modules cooperate via the threading.Event we pass in.
_active_tasks: Dict[Tuple[str, str], threading.Event] = {}


def _cancel_task(namespace: str, sid: str) -> None:
    event = _active_tasks.pop((namespace, sid), None)
    if event is not None:
        logger.info(f"Cancelling task for {namespace} sid={sid}")
        event.set()


def _register_task(namespace: str, sid: str) -> threading.Event:
    _cancel_task(namespace, sid)
    event = threading.Event()
    _active_tasks[(namespace, sid)] = event
    return event


def _clear_client(sid: str) -> None:
    for key in [k for k in _active_tasks if k[1] == sid]:
        _active_tasks.pop(key).set()


# ---------------------------------------------------------------------------
# Background execution (eventlet-cooperative, single model)
# ---------------------------------------------------------------------------
def _spawn_async(coro_fn: Callable, *args, namespace: str, **kwargs) -> None:
    """Run an async coroutine in an eventlet-backed background task.

    One asyncio loop per task — sufficient for the modest concurrency here and
    drastically simpler than the old thread+loop juggling.
    """

    def runner() -> None:
        loop = asyncio.new_event_loop()
        try:
            asyncio.set_event_loop(loop)
            loop.run_until_complete(coro_fn(*args, **kwargs))
        except asyncio.CancelledError:
            logger.info(f"Async task cancelled for {namespace}")
        except Exception as exc:
            logger.exception(f"Async task failed for {namespace}: {exc}")
            io.emit(se.SERVER_EVENTS["result"], {"error": str(exc)}, namespace=namespace, room=kwargs.get("room"))
        finally:
            loop.close()

    io.start_background_task(runner)


def _spawn_sync(fn: Callable, *args, namespace: str, **kwargs) -> None:
    """Run a sync callable in an eventlet-backed background task."""

    def runner() -> None:
        try:
            fn(*args, **kwargs)
        except Exception as exc:
            logger.exception(f"Sync task failed for {namespace}: {exc}")
            io.emit(se.SERVER_EVENTS["result"], {"error": str(exc)}, namespace=namespace, room=kwargs.get("room"))

    io.start_background_task(runner)


# ---------------------------------------------------------------------------
# Handler glue
# ---------------------------------------------------------------------------
def _extract_input(data):
    if isinstance(data, dict):
        return data.get("query") or data.get("input") or data
    return data


def _emit_error(namespace: str, message: str, room: Optional[str] = None) -> None:
    io.emit(se.SERVER_EVENTS["result"], {"error": message}, namespace=namespace, room=room)


def _validated_handler(validator: Optional[Callable], namespace: str, runner: Callable):
    """Wrap a runner with input extraction, validation, and per-client task tracking."""

    @wraps(runner)
    def handler(data=None):
        sid = request.sid
        room = sid
        value = _extract_input(data)

        if validator is not None:
            if not value:
                _emit_error(namespace, "No input provided", room=room)
                return
            ok, err = validator(value)
            if not ok:
                _emit_error(namespace, err, room=room)
                return

        cancel_event = _register_task(namespace, sid)
        try:
            runner(value, data, cancel_event, room)
        except Exception as exc:
            logger.exception(f"Handler error on {namespace}: {exc}")
            _emit_error(namespace, str(exc), room=room)

    return handler


def _cancel_handler(namespace: str):
    def handler():
        sid = request.sid
        _cancel_task(namespace, sid)
        io.emit(
            se.SERVER_EVENTS["result"],
            {"status": "cancelled", "message": "Search cancelled by user"},
            namespace=namespace,
            room=sid,
        )

    return handler


# ---------------------------------------------------------------------------
# Per-namespace search runners
# ---------------------------------------------------------------------------
async def _run_domain(query, _data, cancel_event, room):
    namespace = se.ns("domain")
    await crtsh_module.search(query, io, namespace, cancel_event=cancel_event, room=room)
    if not cancel_event.is_set():
        await whois_module.search(query, io, namespace, cancel_event=cancel_event, room=room)


async def _run_email(_query, _data, _cancel_event, room):
    io.emit(
        se.SERVER_EVENTS["result"],
        {"result": {"module": "email", "message": "Email search functionality will be implemented soon."}},
        namespace=se.ns("email"),
        room=room,
    )


async def _run_phone(_query, _data, _cancel_event, room):
    io.emit(
        se.SERVER_EVENTS["result"],
        {"result": {"module": "phone", "message": "Phone search functionality will be implemented soon."}},
        namespace=se.ns("phone"),
        room=room,
    )


def _async_runner(coro_fn, namespace: str, **extra_kwargs):
    def runner(value, _data, cancel_event, room):
        _spawn_async(
            coro_fn,
            value,
            io,
            namespace,
            cancel_event=cancel_event,
            room=room,
            namespace=namespace,
            **extra_kwargs,
        )

    return runner


def _domain_runner(value, _data, cancel_event, room):
    _spawn_async(_run_domain, value, None, cancel_event, room, namespace=se.ns("domain"))


def _email_runner(value, data, cancel_event, room):
    _spawn_async(_run_email, value, data, cancel_event, room, namespace=se.ns("email"))


def _phone_runner(value, data, cancel_event, room):
    _spawn_async(_run_phone, value, data, cancel_event, room, namespace=se.ns("phone"))


def _whatsmyname_runner(value, _data, cancel_event, room):
    _spawn_sync(
        whatsmyname_module.search,
        value,
        io,
        se.ns("username"),
        cancel_event=cancel_event,
        room=room,
        namespace=se.ns("username"),
    )


# ---------------------------------------------------------------------------
# Handler table — single source of truth for what gets registered.
# ---------------------------------------------------------------------------
SEARCH_HANDLERS = [
    # (namespace_key, event_key, validator, runner)
    ("email",      "search",         is_valid_email,    _email_runner),
    ("domain",     "search",         is_valid_domain,   _domain_runner),
    ("whois",      "search",         is_valid_domain,
        _async_runner(whois_module.search, se.ns("whois"))),
    ("subdomains", "search",         is_valid_domain,
        _async_runner(crtsh_module.search, se.ns("subdomains"))),
    ("username",   "search",         is_valid_username, _whatsmyname_runner),
    ("discord",    "search",         None,
        _async_runner(discord_module.search, se.ns("discord"))),
    ("github",     "search",         None,
        _async_runner(github_module.search, se.ns("github"))),
    ("google",     "search",         None,
        _async_runner(google_module.search, se.ns("google"))),
    ("reddit",     "search",         is_valid_username,
        _async_runner(run_reddit, se.ns("reddit"))),
    ("tiktok",     "searchVideo",    is_valid_url,
        _async_runner(tiktok_module.search, se.ns("tiktok"), search_type="video")),
    ("tiktok",     "searchProfile",  is_valid_username,
        _async_runner(tiktok_module.search, se.ns("tiktok"), search_type="profile")),
    ("mastodon",   "searchUsername", is_valid_username,
        _async_runner(mastodon_module.search, se.ns("mastodon"), search_type="username")),
    ("mastodon",   "searchInstance", None,
        _async_runner(mastodon_module.search, se.ns("mastodon"), search_type="instance")),
    ("phone",      "search",         is_valid_phone,    _phone_runner),
]


def _register_handlers() -> None:
    for ns_key, event_key, validator, runner in SEARCH_HANDLERS:
        namespace = se.ns(ns_key)
        event_name = se.event(ns_key, event_key)
        handler = _validated_handler(validator, namespace, runner)
        io.on(event_name, namespace=namespace)(handler)
        logger.info(f"Registered handler {namespace}:{event_name}")

    for ns_key, channels in se.NAMESPACES.items():
        cancel_event_name = channels.get("cancel")
        if not cancel_event_name:
            continue
        namespace = se.ns(ns_key)
        io.on(cancel_event_name, namespace=namespace)(_cancel_handler(namespace))
        logger.info(f"Registered cancel handler {namespace}:{cancel_event_name}")


_register_handlers()


# ---------------------------------------------------------------------------
# Connection lifecycle
# ---------------------------------------------------------------------------
@io.on("connect")
def handle_connect():
    logger.info(f"Client connected: {request.sid}")
    io.emit("connection_success", {"status": "connected"}, room=request.sid)


@io.on("disconnect")
def handle_disconnect():
    sid = request.sid
    logger.info(f"Client disconnected: {sid}")
    _clear_client(sid)


@app.errorhandler(Exception)
def error_handler(e):
    logger.exception(f"Server error: {e}")
    return "Internal server error", 500


if __name__ == "__main__":
    logger.info("OSINT Toolkit server started")
    io.run(app, debug=os.environ.get("DEBUG", "False").lower() == "true")
