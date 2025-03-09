import asyncpraw
import json
import asyncio
import os
from asyncprawcore.exceptions import NotFound
from core.base_module import OsintModule

class RedditModule(OsintModule):
    """Module for Reddit user lookups using asyncpraw"""
    
    def __init__(self):
        super().__init__("reddit")
        self.client_id = os.environ.get('REDDIT_CLIENT_ID')
        self.client_secret = os.environ.get('REDDIT_CLIENT_SECRET')
        self.user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.58 Safari/537.36'
    
    async def search(self, username: str, socketio, namespace: str, **kwargs) -> dict:
        """
        Search for Reddit user information
        
        Args:
            username: Reddit username
            socketio: SocketIO instance
            namespace: SocketIO namespace
            **kwargs: Additional parameters
                cancel_event: An optional threading.Event for cancellation
                submission_limit: Maximum number of submissions to retrieve (default: 5)
                comment_limit: Maximum number of comments to retrieve (default: 5)
            
        Returns:
            Dict containing the Reddit user data
        """
        self.logger.info(f"Starting Reddit lookup for username: {username}")
        
        # Get the cancel_event and optional limits from kwargs
        cancel_event = kwargs.get('cancel_event')
        submission_limit = kwargs.get('submission_limit', 5)
        comment_limit = kwargs.get('comment_limit', 5)
        
        try:
            # Check for cancellation
            if self.handle_cancellation(cancel_event):
                return {'error': 'Search cancelled'}
                
            reddit = asyncpraw.Reddit(
                client_id=self.client_id,
                client_secret=self.client_secret,
                user_agent=self.user_agent
            )
            
            user = await reddit.redditor(username)
            
            # Check for cancellation
            if self.handle_cancellation(cancel_event):
                return {'error': 'Search cancelled'}
                
            await user.load()

            # Check if the user exists
            if user.name is None:
                self.emit_error(socketio, namespace, "User does not exist.")
                return {'error': 'User does not exist.'}

            user_info = {
                'result': {
                    'module': 'reddit',
                    'username': user.name,
                    'id': user.id,
                    'created_utc': user.created_utc,
                    'link_karma': user.link_karma,
                    'comment_karma': user.comment_karma,
                    'is_gold': user.is_gold,
                    'is_mod': user.is_mod,
                    'has_verified_email': user.has_verified_email,
                    'icon_img': user.icon_img,
                    'is_employee': user.is_employee,
                    'is_friend': user.is_friend,
                    'subreddit': {
                        'title': user.subreddit.title if user.subreddit else None,
                        'public_description': user.subreddit.public_description if user.subreddit else None,
                        'subscribers': user.subreddit.subscribers if user.subreddit else None,
                        'banner_img': user.subreddit.banner_img if user.subreddit else None,
                        'over_18': user.subreddit.over_18 if user.subreddit else None,
                        'name': user.subreddit.display_name if user.subreddit else None
                    } if user.subreddit else None,
                    'submissions': [],
                    'comments': []
                }
            }

            # Send profile information via WebSocket
            self.emit_result(socketio, namespace, user_info)
            
            # Check for cancellation
            if self.handle_cancellation(cancel_event):
                return {'error': 'Search cancelled'}

            # Define async functions to fetch submissions and comments concurrently
            async def fetch_submissions():
                submissions = []
                self.emit_progress(socketio, namespace, "Fetching submissions...")
                
                count = 0
                async for submission in user.submissions.new(limit=submission_limit):
                    # Check for cancellation within the loop
                    if self.handle_cancellation(cancel_event):
                        return None
                    
                    # Process submissions in batches to avoid excessive API calls
                    submission_data = {
                        'title': submission.title,
                        'url': submission.url,
                        'created_utc': submission.created_utc,
                        'score': submission.score,
                        'num_comments': submission.num_comments,
                        'selftext': submission.selftext if hasattr(submission, 'selftext') else '',
                        'subreddit': submission.subreddit.display_name
                    }
                    submissions.append(submission_data)
                    
                    count += 1
                    if count % 2 == 0:  # Update progress every 2 submissions
                        self.emit_progress(socketio, namespace, f"Fetched {count}/{submission_limit} submissions...")
                
                return submissions

            async def fetch_comments():
                comments = []
                self.emit_progress(socketio, namespace, "Fetching comments...")
                
                count = 0
                async for comment in user.comments.new(limit=comment_limit):
                    # Check for cancellation within the loop
                    if self.handle_cancellation(cancel_event):
                        return None
                    
                    # Process comments without loading the entire comment object
                    comment_data = {
                        'body': comment.body,
                        'created_utc': comment.created_utc,
                        'score': comment.score,
                        'link_title': comment.link_title if hasattr(comment, 'link_title') else await self.get_link_title(comment),
                        'link_url': comment.link_url if hasattr(comment, 'link_url') else f"https://reddit.com{comment.permalink}" if hasattr(comment, 'permalink') else None,
                        'subreddit': comment.subreddit.display_name
                    }
                    comments.append(comment_data)
                    
                    count += 1
                    if count % 2 == 0:  # Update progress every 2 comments
                        self.emit_progress(socketio, namespace, f"Fetched {count}/{comment_limit} comments...")
                
                return comments
                
            # Fetch submissions and comments concurrently
            submissions_task = asyncio.create_task(fetch_submissions())
            comments_task = asyncio.create_task(fetch_comments())
            
            # Wait for both tasks to complete
            submissions, comments = await asyncio.gather(submissions_task, comments_task)
            
            # Check for cancellation after concurrent fetching
            if self.handle_cancellation(cancel_event) or submissions is None or comments is None:
                return {'error': 'Search cancelled'}
            
            # Save submissions to result and emit
            user_info['result']['submissions'] = submissions
            self.emit_result(socketio, namespace, {'submissions': submissions})
            
            # Save comments to result and emit
            user_info['result']['comments'] = comments
            self.emit_result(socketio, namespace, {'comments': comments})
            
            self.emit_progress(socketio, namespace, "Completed Reddit data collection.")
            
            return user_info

        except NotFound:
            error_msg = 'User does not exist.'
            self.logger.warning(f"Reddit user not found: {username}")
            self.emit_error(socketio, namespace, error_msg)
            return {'error': error_msg}
        except Exception as e:
            error_msg = f"Error in Reddit lookup: {str(e)}"
            self.logger.error(error_msg)
            self.emit_error(socketio, namespace, str(e))
            return {'error': error_msg}
    
    async def get_link_title(self, comment):
        """Helper method to get link title if not directly available"""
        try:
            if hasattr(comment, 'submission'):
                submission = await comment.submission()
                if hasattr(submission, 'title'):
                    return submission.title
        except Exception:
            pass
        return "Unknown Title"
    
    def emit_progress(self, socketio, namespace, message):
        """Emit progress updates via WebSocket"""
        try:
            socketio.emit('progress', {'message': message}, namespace=namespace)
        except Exception as e:
            self.logger.error(f"Error emitting progress: {str(e)}")


# Create a singleton instance for import
reddit_module = RedditModule()

# Legacy function for backwards compatibility
async def run_reddit(username, socketio, namespace, cancel_event=None, submission_limit=5, comment_limit=5):
    """Legacy function to maintain backwards compatibility"""
    return await reddit_module.search(
        username, 
        socketio, 
        namespace, 
        cancel_event=cancel_event,
        submission_limit=submission_limit,
        comment_limit=comment_limit
    )