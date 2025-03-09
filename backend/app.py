import eventlet
eventlet.monkey_patch()

from flask import Flask, request
from flask_socketio import SocketIO
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import asyncio
import re
import json
import logging
import os
from functools import wraps
import time
import threading

# Import all modules
from domain.whois.whois_module import whois_module
from social_networks.github.osgint_module import github_module
from social_networks.reddit.reddit_module import run_reddit
from social_networks.mastodon.mastodon_module import mastodon_module
from social_networks.tiktok.tiktok_module import tiktok_module
from social_networks.google.ghunt_module import google_module
from username.whatsmyname.whatsmyname_module import whatsmyname_module
from social_networks.discord.discord_module import discord_module
from domain.subdomains.crtsh_module import crtsh_module

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask application
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Initialize SocketIO with eventlet
io = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='eventlet',
    logger=True,
    engineio_logger=True,
    ping_timeout=60,
    ping_interval=25
)

# Initialize the rate limiter
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["10 per minute"],
    storage_uri="memory://"
)

# Connection tracking
connected_clients = {}

# Dictionary to track running tasks
active_tasks = {
    '/email': None,
    '/domain': None,
    '/username': None,
    '/discord': None,
    '/github': None,
    '/mastodon': None,
    '/tiktok': None,
    '/reddit': None,
    '/whois': None,
    '/google': None,
    '/subdomains': None,
    '/phone': None
}

# Thread pool for managing async tasks
thread_pool = []
MAX_THREADS = 10

# Function to cancel previous task for a namespace
def cancel_previous_task(namespace):
    """
    Cancel any existing task for the given namespace
    """
    if namespace in active_tasks and active_tasks[namespace] is not None:
        logger.info(f"Cancelling task for namespace {namespace}")
        # Set the cancellation event
        active_tasks[namespace].set()
        # Allow some time for the task to clean up
        time.sleep(0.1)
        # Reset the event after cancellation
        active_tasks[namespace] = None
        logger.info(f"Reset active_tasks for {namespace} to None")

# Validation functions with error messages
def is_valid_email(email):
    regex = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
    return (re.match(regex, email) is not None, "Invalid email format")

def is_valid_phone(phone):
    regex = r'^\+?[1-9]\d{1,14}$'
    return (re.match(regex, phone) is not None, "Invalid phone number format")

def is_valid_domain(domain):
    regex = r'^(?!-)[A-Za-z0-9-]{1,63}(?<!-)\.[A-Za-z]{2,6}$'
    return (re.match(regex, domain) is not None, "Invalid domain format")

def is_valid_username(username):
    return (bool(username), "Username is required")

def is_valid_url(url):
    regex = r'^https?://[^\s]+'
    return (re.match(regex, url) is not None, "Invalid URL format")

# Helper function to run an async function
def run_async_task(coro, *args, **kwargs):
    """
    Run an async coroutine directly in a new thread with its own event loop.
    """
    namespace = kwargs.get('namespace', '')
    logger.info(f"Starting task for {namespace}")
    
    def run_in_thread():
        # Create a new event loop for this thread
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Run the coroutine
            result = loop.run_until_complete(coro(*args, **kwargs))
            logger.info(f"Task completed for {namespace} with result: {result}")
            return result
        except asyncio.CancelledError:
            logger.info(f"Task cancelled for {namespace}")
        except Exception as e:
            logger.error(f"Error in task: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            if namespace:
                emit_error(str(e), namespace)
        finally:
            # Clean up the event loop
            loop.close()
            logger.info(f"Event loop closed for {namespace}")
    
    # Start a new thread for this task
    thread = threading.Thread(target=run_in_thread)
    thread.daemon = True
    thread.start()
    logger.info(f"Started thread for {namespace}: {thread.name}")
    
    # Keep track of threads
    global thread_pool
    thread_pool.append(thread)
    
    # Clean up finished threads
    thread_pool = [t for t in thread_pool if t.is_alive()]
    if len(thread_pool) > MAX_THREADS:
        logger.warning(f"Thread pool has {len(thread_pool)} threads, which exceeds the maximum of {MAX_THREADS}")

# Decorator for rate limiting and input validation
def rate_limited_endpoint(validator=None, namespace=None):
    def decorator(f):
        @wraps(f)
        def decorated_function(data):
            logger.info(f"Received data for {namespace}: {data}")
            
            # Always create a new event for potential cancellation
            # instead of reusing potentially set events
            cancel_event = threading.Event()
            logger.info(f"Created new cancel_event for {namespace}, is_set = {cancel_event.is_set()}")
            
            # Apply input validation if a validator was provided
            if validator:
                input_value = None
                if isinstance(data, dict):
                    input_value = data.get('query', '') or data.get('input', '')
                else:
                    input_value = data
                
                if not input_value:
                    error_message = "No input provided"
                    logger.warning(error_message)
                    emit_error(error_message, namespace)
                    return
                
                is_valid, error_message = validator(input_value)
                if not is_valid:
                    logger.warning(f"Invalid input: {input_value} - {error_message}")
                    emit_error(error_message, namespace)
                    return
            
            # Call the handler with the input data and cancel event
            try:
                if isinstance(data, dict):
                    if 'query' in data:
                        return f(data['query'], cancel_event)
                    elif 'input' in data:
                        return f(data['input'], cancel_event)
                    else:
                        return f(data, cancel_event)
                else:
                    return f(data, cancel_event)
            except Exception as e:
                error_msg = f"Error processing request: {str(e)}"
                logger.error(error_msg)
                import traceback
                logger.error(traceback.format_exc())
                emit_error(error_msg, namespace)
        
        # Register the socket event handler
        event_name = f"{namespace.replace('/', '')}_search" if namespace else "search"
        logger.info(f"Registering event handler for {event_name} on namespace {namespace}")
        io.on(event_name, namespace=namespace)(decorated_function)
        
        return decorated_function
    return decorator

# Helper function to emit errors in consistent format
def emit_error(message, namespace):
    logger.info(f"Emitting error to {namespace}: {message}")
    io.emit('search_result', {'error': message}, namespace=namespace)

# Helper function to start a background task using eventlet
def start_background_task(func, *args, **kwargs):
    def run_task():
        import eventlet
        eventlet.spawn(func, *args, **kwargs)
    
    io.start_background_task(run_task)

# Email search handler
@io.on('search_email', namespace='/email')
@rate_limited_endpoint(validator=is_valid_email, namespace='/email')
def handle_search_email(email, cancel_event):
    # Cancel any existing search for this namespace
    cancel_previous_task('/email')
    # Create a new cancellation event and store it
    active_tasks['/email'] = cancel_event
    run_async_task(run_parallel_search_email, email, io, cancel_event, namespace='/email')

# Domain search handler
@io.on('search_domain', namespace='/domain')
@rate_limited_endpoint(validator=is_valid_domain, namespace='/domain')
def handle_search_domain(domain, cancel_event):
    # Cancel any existing search for this namespace
    cancel_previous_task('/domain')
    # Create a new cancellation event and store it
    active_tasks['/domain'] = cancel_event
    run_async_task(run_parallel_search_domain, domain, io, cancel_event, namespace='/domain')

# Username search handler
@io.on('search_username', namespace='/username')
@rate_limited_endpoint(validator=is_valid_username, namespace='/username')
def handle_search_username(username, cancel_event):
    # Cancel any existing search for this namespace
    cancel_previous_task('/username')
    # Create a new cancellation event and store it
    active_tasks['/username'] = cancel_event
    start_background_task(
        whatsmyname_module.search,
        username,
        io,
        '/username',
        cancel_event=cancel_event,
        room=request.sid
    )

# Discord search handler
@io.on('search_discord', namespace='/discord')
@rate_limited_endpoint(namespace='/discord')
def handle_search_discord(user_id, cancel_event):
    # Cancel any existing search for this namespace
    cancel_previous_task('/discord')
    # Create a new cancellation event and store it
    active_tasks['/discord'] = cancel_event
    run_async_task(discord_module.search, user_id, io, cancel_event=cancel_event, namespace='/discord')

# GitHub search handler
@io.on('search_github', namespace='/github')
@rate_limited_endpoint(namespace='/github')
def handle_search_github(username, cancel_event):
    # Cancel any existing search for this namespace
    cancel_previous_task('/github')
    # Create a new cancellation event and store it
    active_tasks['/github'] = cancel_event
    run_async_task(github_module.search, username, io, cancel_event=cancel_event, namespace='/github')

# Mastodon username search handler
@io.on('search_mastodon_username', namespace='/mastodon')
@rate_limited_endpoint(validator=is_valid_username, namespace='/mastodon')
def handle_search_mastodon_username(username, cancel_event):
    logger.info(f"Starting Mastodon username search for: {username}")
    # Cancel any existing search for this namespace
    cancel_previous_task('/mastodon')
    # Create a new cancellation event and store it
    active_tasks['/mastodon'] = cancel_event
    run_async_task(mastodon_module.search, username, io, namespace='/mastodon', search_type='username', cancel_event=cancel_event)

# Mastodon instance search handler
@io.on('search_mastodon_instance', namespace='/mastodon')
@rate_limited_endpoint(namespace='/mastodon')
def handle_search_mastodon_instance(instance, cancel_event):
    logger.info(f"Starting Mastodon instance search for: {instance}")
    # Cancel any existing search for this namespace
    cancel_previous_task('/mastodon')
    # Create a new cancellation event and store it
    active_tasks['/mastodon'] = cancel_event
    run_async_task(mastodon_module.search, instance, io, namespace='/mastodon', search_type='instance', cancel_event=cancel_event)

# TikTok video URL analysis handler
@io.on('search_tiktok', namespace='/tiktok')
@rate_limited_endpoint(validator=is_valid_url, namespace='/tiktok')
def handle_search_tiktok(url, cancel_event):
    logger.info(f"Starting TikTok video URL analysis for: {url}")
    # Cancel any existing search for this namespace
    cancel_previous_task('/tiktok')
    # Create a new cancellation event and store it
    active_tasks['/tiktok'] = cancel_event
    run_async_task(tiktok_module.search, url, io, search_type='video', cancel_event=cancel_event, namespace='/tiktok')

# TikTok profile search handler
@io.on('search_tiktok_profile', namespace='/tiktok')
@rate_limited_endpoint(validator=is_valid_username, namespace='/tiktok')
def handle_search_tiktok_profile(username, cancel_event):
    logger.info(f"Starting TikTok profile search for: {username}")
    # Cancel any existing search for this namespace
    cancel_previous_task('/tiktok')
    # Create a new cancellation event and store it
    active_tasks['/tiktok'] = cancel_event
    run_async_task(tiktok_module.search, username, io, search_type='profile', cancel_event=cancel_event, namespace='/tiktok')

# Reddit search handler
@io.on('search_reddit', namespace='/reddit')
@rate_limited_endpoint(validator=is_valid_username, namespace='/reddit')
def handle_search_reddit(username, cancel_event):
    # Cancel any existing search for this namespace
    cancel_previous_task('/reddit')
    # Create a new cancellation event and store it
    active_tasks['/reddit'] = cancel_event
    run_async_task(run_reddit, username, io, cancel_event=cancel_event, namespace='/reddit')

# Google search handler
@io.on('search_google', namespace='/google')
@rate_limited_endpoint(namespace='/google')
def handle_search_google(email, cancel_event):
    # Cancel any existing search for this namespace
    cancel_previous_task('/google')
    # Create a new cancellation event and store it
    active_tasks['/google'] = cancel_event
    run_async_task(google_module.search, email, io, cancel_event=cancel_event, namespace='/google')

# Phone search handler
@io.on('search_phone', namespace='/phone')
@rate_limited_endpoint(validator=is_valid_phone, namespace='/phone')
def handle_search_phone(phone, cancel_event):
    # Cancel any existing search for this namespace
    cancel_previous_task('/phone')
    # Create a new cancellation event and store it
    active_tasks['/phone'] = cancel_event
    run_async_task(run_phonesearch, phone, io, cancel_event, namespace='/phone')

# Subdomain search handler (crt.sh)
@io.on('search_subdomains', namespace='/subdomains')
@rate_limited_endpoint(validator=is_valid_domain, namespace='/subdomains')
def handle_search_subdomains(domain, cancel_event):
    # Cancel any existing search for this namespace
    cancel_previous_task('/subdomains')
    # Create a new cancellation event and store it
    active_tasks['/subdomains'] = cancel_event
    run_async_task(crtsh_module.search, domain, io, cancel_event=cancel_event, namespace='/subdomains')

# WHOIS search handler
@io.on('search_whois', namespace='/whois')
@rate_limited_endpoint(validator=is_valid_domain, namespace='/whois')
def handle_search_whois(domain, cancel_event):
    # Cancel any existing search for this namespace
    cancel_previous_task('/whois')
    # Create a new cancellation event and store it
    active_tasks['/whois'] = cancel_event
    run_async_task(whois_module.search, domain, io, cancel_event=cancel_event, namespace='/whois')

# WebSocket connection handler
@io.on('connect')
def handle_connect():
    connected_clients[request.sid] = {'connected': True}
    logger.info(f"Client connected: {request.sid}")
    io.emit('connection_success', {'status': 'connected'})

# WebSocket disconnection handler
@io.on('disconnect')
def handle_disconnect():
    logger.info(f"Client disconnected: {request.sid}")
    
    # Cancel any running tasks for this client
    for namespace in active_tasks:
        if active_tasks[namespace] is not None:
            active_tasks[namespace].set()
            active_tasks[namespace] = None

    # Remove client from tracking
    if request.sid in connected_clients:
        del connected_clients[request.sid]

# Handle explicit cancel request
@io.on('cancel_search_username', namespace='/username')
def handle_cancel_search_username():
    logger.info("Cancellation requested for username search")
    cancel_previous_task('/username')
    io.emit('search_result', {'status': 'cancelled', 'message': 'Search cancelled by user'}, namespace='/username')

@io.on('cancel_search_discord', namespace='/discord')
def handle_cancel_search_discord():
    logger.info("Cancellation requested for discord search")
    cancel_previous_task('/discord')
    io.emit('search_result', {'status': 'cancelled', 'message': 'Search cancelled by user'}, namespace='/discord')

@io.on('cancel_search_github', namespace='/github')
def handle_cancel_search_github():
    logger.info("Cancellation requested for github search")
    cancel_previous_task('/github')
    io.emit('search_result', {'status': 'cancelled', 'message': 'Search cancelled by user'}, namespace='/github')

@io.on('cancel_search_domain', namespace='/domain')
def handle_cancel_search_domain():
    logger.info("Cancellation requested for domain search")
    cancel_previous_task('/domain')
    io.emit('search_result', {'status': 'cancelled', 'message': 'Search cancelled by user'}, namespace='/domain')

@io.on('cancel_search_whois', namespace='/whois')
def handle_cancel_search_whois():
    logger.info("Cancellation requested for whois search")
    cancel_previous_task('/whois')
    io.emit('search_result', {'status': 'cancelled', 'message': 'Search cancelled by user'}, namespace='/whois')

@io.on('cancel_search_subdomains', namespace='/subdomains')
def handle_cancel_search_subdomains():
    logger.info("Cancellation requested for subdomains search")
    cancel_previous_task('/subdomains')
    io.emit('search_result', {'status': 'cancelled', 'message': 'Search cancelled by user'}, namespace='/subdomains')

@io.on('cancel_search_mastodon', namespace='/mastodon')
def handle_cancel_search_mastodon():
    logger.info("Cancellation requested for mastodon search")
    cancel_previous_task('/mastodon')
    io.emit('search_result', {'status': 'cancelled', 'message': 'Search cancelled by user'}, namespace='/mastodon')

@io.on('cancel_search_tiktok', namespace='/tiktok')
def handle_cancel_search_tiktok():
    logger.info("Cancellation requested for tiktok search")
    cancel_previous_task('/tiktok')
    io.emit('search_result', {'status': 'cancelled', 'message': 'Search cancelled by user'}, namespace='/tiktok')

@io.on('cancel_search_reddit', namespace='/reddit')
def handle_cancel_search_reddit():
    logger.info("Cancellation requested for reddit search")
    cancel_previous_task('/reddit')
    io.emit('search_result', {'status': 'cancelled', 'message': 'Search cancelled by user'}, namespace='/reddit')

@io.on('cancel_search_google', namespace='/google')
def handle_cancel_search_google():
    logger.info("Cancellation requested for google search")
    cancel_previous_task('/google')
    io.emit('search_result', {'status': 'cancelled', 'message': 'Search cancelled by user'}, namespace='/google')

# Parallel processing functions
async def run_parallel_search_email(email, io, cancel_event, namespace='/email'):
    logger.info(f"Starting parallel email search for {email}")
    
    try:
        io.emit('search_result', {'result': {'module': 'email', 'message': 'Email search functionality will be implemented soon.'}}, namespace=namespace)
    except Exception as e:
        logger.error(f"Error in email search: {str(e)}")
        emit_error(str(e), namespace)

async def run_parallel_search_domain(domain, io, cancel_event, namespace='/domain'):
    logger.info(f"Starting parallel domain search for {domain}")
    
    try:
        # Run crtsh module
        await crtsh_module.search(domain, io, namespace, cancel_event=cancel_event)
        
        # Run whois module if search wasn't cancelled
        if not cancel_event.is_set():
            await whois_module.search(domain, io, namespace, cancel_event=cancel_event)
    except Exception as e:
        logger.error(f"Error in domain search: {str(e)}")
        emit_error(str(e), namespace)

async def run_phonesearch(phone, io, cancel_event, namespace='/phone'):
    logger.info(f"Starting phone search for {phone}")
    
    try:
        io.emit('search_result', {'result': {'module': 'phone', 'message': 'Phone search functionality will be implemented soon.'}}, namespace=namespace)
    except Exception as e:
        logger.error(f"Error in phone search: {str(e)}")
        emit_error(str(e), namespace)

# Error handler
@app.errorhandler(Exception)
def error_handler(e):
    logger.error(f"Server error: {str(e)}")
    return str(e), 500

if __name__ == '__main__':
    logger.info("OSINT Toolkit server started")
    io.run(app, debug=os.environ.get('DEBUG', 'False').lower() == 'true')
