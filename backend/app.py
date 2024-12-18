import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import asyncio
import re
import json
import logging
from domain.whois.whois_module import run_whois
from social_networks.github.osgint_module import run_osgint
from social_networks.reddit.reddit_module import run_reddit
from social_networks.mastodon.mastodon_module import run_mastodon_username_search, run_mastodon_instance_search
from social_networks.tiktok.tiktok_module import run_tiktok_module
from social_networks.google.ghunt_module import run_ghunt
from username.whatsmyname.whatsmyname_module import run_whatsmyname
from domain.subdomains.crtsh_module import run_crtsh
from threading import Thread

logging.basicConfig(level=logging.INFO)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # Permettre toutes les origines
#io = SocketIO(app, cors_allowed_origins="*")
io = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='eventlet',
    logger=True,
    engineio_logger=True
)

#TODO: Make the rate limiter working bc its not
#TODO: Drop the websocket if the user leaves the page  
# Initialize the rate limiter
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["10 per minute"]  # Set limit to 10 requests per minute
)

# Connection status flag
connected_clients = {}
tasks = {}  # To keep track of running tasks

# Validation functions
def is_valid_email(email):
    regex = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
    return re.match(regex, email) is not None

def is_valid_phone(phone):
    regex = r'^\+?[1-9]\d{1,14}$'
    return re.match(regex, phone) is not None

def is_valid_domain(domain):
    regex = r'^(?!-)[A-Za-z0-9-]{1,63}(?<!-)\.[A-Za-z]{2,6}$'
    return re.match(regex, domain) is not None

# Rate-limited event handlers
@limiter.limit("10 per minute", key_func=get_remote_address)
@io.on('search_email', namespace='/email')
async def handle_search_email(data):
    logging.info(f"email search request: {data}")
    email = data['input']
    if is_valid_email(email):
        cancel_event = asyncio.Event()
        tasks[request.sid] = cancel_event
        await run_parallel_search_email(email, io, cancel_event)
    else:
        logging.warning(f"Invalid email format received: {email}")
        emit('search_result', {'result': 'Invalid email format.'}, namespace='/email')

@limiter.limit("10 per minute", key_func=get_remote_address)
@io.on('search_phone', namespace='/phone')
async def handle_search_phone(data):
    phone = data['input']
    if not is_valid_phone(phone):
        emit('search_result', {'result': 'Invalid phone number format.'}, namespace='/phone')
        return

    result = json.dumps({'result': 'Phone number search not implemented yet.'})
    emit('search_result', {'result': result}, namespace='/phone')

@limiter.limit("10 per minute", key_func=get_remote_address)
@io.on('search_domain', namespace='/domain')
def handle_search_domain(data):
    logging.info(f"domain search request: {data}")
    domain = data['input']
    if not is_valid_domain(domain):
        logging.warning(f"Invalid domain format received: {domain}")
        emit('search_result', {'result': 'error', 'message': 'Invalid domain format.'}, namespace='/domain')
    else:
        cancel_event = asyncio.Event()
        tasks[request.sid] = cancel_event
        asyncio.run(run_parallel_search_domain(domain, io, cancel_event))

async def run_parallel_search_domain(domain, io, cancel_event):
    try:
        await asyncio.gather(
            run_whois(domain, io, '/domain'),
            run_crtsh(domain, io, '/domain')
        )
        logging.info(f"Completed domain search for: {domain}")
    except Exception as e:
        logging.error(f"Error in domain search for {domain}: {str(e)}")
        emit('search_result', {'result': 'error', 'message': str(e)}, namespace='/domain')

@io.on('search_username', namespace='/username')
def handle_search_username(data):
    username = data['input']
    if not username:
        emit('search_result', {'result': json.dumps({'error': 'Username is required'})}, namespace='/username')
        return
    
    cancel_event = asyncio.Event()
    sid = request.sid
    tasks[sid] = cancel_event
    
    def run_search():
        import eventlet
        eventlet.spawn(
            run_whatsmyname, 
            username, 
            io, 
            '/username', 
            request_sid=sid
        )
    
    io.start_background_task(run_search)

def run_parallel_search_username(username, socketio, cancel_event):
    logging.info(f"Running parallel username search tasks for: {username}")
    try:
        asyncio.run(run_whatsmyname(username, socketio, '/username', request_sid=request.sid))
        logging.info(f"Completed username search for: {username}")
    except Exception as e:
        logging.error(f"Error in parallel username search: {str(e)}")
        raise
@limiter.limit("10 per minute", key_func=get_remote_address)
@io.on('search_name', namespace='/name')
def handle_search_name(data):
    name = data['input']
    logging.info(f"name search request: {name}")
    #asyncio.run(run_societeninja(name, io, '/name'))

@limiter.limit("10 per minute", key_func=get_remote_address)
@io.on('search_reddit', namespace='/reddit')
def handle_search_reddit(data):
    username = data['input']
    logging.info(f"reddit search request: {username}")
    io.start_background_task(run_reddit, username, io, '/reddit')

@limiter.limit("10 per minute", key_func=get_remote_address)
@io.on('search_github', namespace='/github')
def handle_search_github(data):
    username = data['input']
    logging.info(f"github search request: {username}")
    io.start_background_task(run_osgint, username, io, '/github')

@limiter.limit("10 per minute", key_func=get_remote_address)
@io.on('search_mastodon_username', namespace='/mastodon')
def handle_search_mastodon_username(data):
    username = data['input']
    logging.info(f"mastodon username search request: {username}")
    io.start_background_task(run_mastodon_username_search, username, io, '/mastodon')

@limiter.limit("10 per minute", key_func=get_remote_address)
@io.on('search_mastodon_instance', namespace='/mastodon')
def handle_search_mastodon_instance(data):
    instance = data['input']
    logging.info(f"mastodon instance search request: {data}")
    io.start_background_task(run_mastodon_instance_search, instance, io, '/mastodon')

@limiter.limit("10 per minute", key_func=get_remote_address)
@io.on('search_tiktok', namespace='/tiktok')
def handle_search_tiktok(data):
    logging.info(f"tiktok search request: {data}")
    url = data['input']
    io.start_background_task(run_tiktok_module, url, io, '/tiktok')

@limiter.limit("10 per minute", key_func=get_remote_address)
@io.on('search_google', namespace='/google')
def handle_search_google(data):
    email = data['input']
    logging.info(f"google search request: {email}")
    io.start_background_task(run_ghunt, email, io, '/google')

# Handle WebSocket connection
@io.on('connect')
def handle_connect():
    logging.info(f"client connected: {request.sid}")
    connected_clients[request.sid] = True

# Handle WebSocket disconnection
@io.on('disconnect')
def handle_disconnect():
    logging.info(f"client disconnected: {request.sid}")
    connected_clients.pop(request.sid, None)

    if request.sid in tasks:
        tasks[request.sid].set()
        del tasks[request.sid]

async def run_parallel_search_email(email, io, cancel_event):
    # Simulate a long-running task
    for i in range(10):
        if cancel_event.is_set():
            logging.info(f"email search for {email} cancelled.")
            return
        await asyncio.sleep(1)  # Simulate work
    emit('search_result', {'result': f'Search completed for {email}'}, namespace='/email')

@io.on_error('/username')
def error_handler(e):
    logging.error(f"[USERNAME SEARCH] SocketIO error: {str(e)}")

if __name__ == '__main__':
    logging.info("server started")
    io.run(app, debug=True)
    
