"""
Base Module for OSINT Tools

This module provides a standardized architecture for all OSINT modules in the application.
It defines common patterns and interfaces that all modules should implement.
"""

import logging
import asyncio
import traceback
from typing import Dict, Any, Optional, List, Callable, Union, Awaitable
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)

class OsintModule(ABC):
    """Base class for all OSINT modules."""
    
    def __init__(self, module_name: str):
        """
        Initialize the OSINT module.
        
        Args:
            module_name: The name of the module, used for identification in logs and results
        """
        self.module_name = module_name
        self.logger = logging.getLogger(f"osint.{module_name}")
    
    @abstractmethod
    async def search(self, query: str, socketio, namespace: str, **kwargs) -> Dict[str, Any]:
        """
        Main search method that all modules must implement.
        
        Args:
            query: The search term to look up
            socketio: The SocketIO instance for emitting results
            namespace: The SocketIO namespace to emit results to
            kwargs: Additional parameters specific to each module
                cancel_event: An optional threading.Event for cancellation
            
        Returns:
            Dict containing the search results
        """
        pass
        
    def emit_result(self, socketio, namespace: str, data: Dict[str, Any], room: str = None):
        """
        Emit a result through SocketIO.
        
        Args:
            socketio: The SocketIO instance
            namespace: The namespace to emit to
            data: The data to emit
            room: Optional room SID to emit to a specific client
        """
        try:
            # Ensure the module name is included in results
            if 'result' in data and isinstance(data['result'], dict):
                if 'module' not in data['result']:
                    data['result']['module'] = self.module_name
            
            socketio.emit('search_result', data, namespace=namespace, room=room)
            self.logger.debug(f"Emitted result to {namespace}{' for room ' + room if room else ''}")
        except Exception as e:
            self.logger.error(f"Error emitting result: {e}")
    
    def emit_error(self, socketio, namespace: str, error_message: str, room: str = None):
        """
        Emit an error through SocketIO.
        
        Args:
            socketio: The SocketIO instance
            namespace: The namespace to emit to
            error_message: The error message
            room: Optional room SID to emit to a specific client
        """
        try:
            socketio.emit('search_result', {'error': error_message}, namespace=namespace, room=room)
            self.logger.error(f"Emitted error: {error_message}")
        except Exception as e:
            self.logger.error(f"Error emitting error: {e}")
    
    def emit_progress(self, socketio, namespace: str, progress: int, message: str = "", room: str = None):
        """
        Emit search progress through SocketIO.
        
        Args:
            socketio: The SocketIO instance
            namespace: The namespace to emit to
            progress: Progress percentage (0-100)
            message: Optional progress message
            room: Optional room SID to emit to a specific client
        """
        try:
            socketio.emit('search_progress', {
                'module': self.module_name,
                'progress': progress,
                'message': message
            }, namespace=namespace, room=room)
        except Exception as e:
            self.logger.error(f"Error emitting progress: {e}")
    
    def is_cancelled(self, cancel_event) -> bool:
        """
        Check if the search has been cancelled.
        
        Args:
            cancel_event: The cancellation event from kwargs
            
        Returns:
            True if the search should be cancelled, False otherwise
        """
        return cancel_event is not None and cancel_event.is_set()
        
    def handle_cancellation(self, cancel_event):
        """
        Check if the operation should be cancelled and log accordingly.
        
        Args:
            cancel_event: The cancellation event from kwargs
            
        Returns:
            True if the operation was cancelled, False otherwise
        """
        if self.is_cancelled(cancel_event):
            self.logger.info(f"{self.module_name} search was cancelled")
            return True
        return False
    
    @staticmethod
    async def safe_request(request_func: Callable[..., Awaitable], *args, **kwargs) -> Union[Dict[str, Any], None]:
        """
        Safely make a network request with error handling.
        
        Args:
            request_func: Async function to execute the request
            args: Arguments to pass to the request function
            kwargs: Keyword arguments to pass to the request function
            
        Returns:
            Response data if successful, None otherwise
        """
        try:
            response = await request_func(*args, **kwargs)
            return response
        except Exception as e:
            logger.error(f"Request error: {e}")
            logger.debug(traceback.format_exc())
            return None
