import asyncpraw
import json
import asyncio
import os
from asyncprawcore.exceptions import NotFound 

async def run_reddit(username, socketio, namespace):
    reddit = asyncpraw.Reddit(
        client_id=os.environ.get('REDDIT_CLIENT_ID'),
        client_secret=os.environ.get('REDDIT_CLIENT_SECRET'),
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.58 Safari/537.36'
    )

    try:
        user = await reddit.redditor(username)
        await user.load()

        # Check if the user exists
        if user.name is None:
            raise ValueError("User does not exist.")

        user_info = {
            "module": "reddit",
            "username": user.name,
            "id": user.id,
            "created_utc": user.created_utc,
            "link_karma": user.link_karma,
            "comment_karma": user.comment_karma,
            "is_gold": user.is_gold,
            "is_mod": user.is_mod,
            "has_verified_email": user.has_verified_email,
            "icon_img": user.icon_img,
            "is_employee": user.is_employee,
            "is_friend": user.is_friend,
            "subreddit": {
                "title": user.subreddit.title if user.subreddit else None,
                "public_description": user.subreddit.public_description if user.subreddit else None,
                "subscribers": user.subreddit.subscribers if user.subreddit else None,
                "banner_img": user.subreddit.banner_img if user.subreddit else None,
                "over_18": user.subreddit.over_18 if user.subreddit else None,
                "name": user.subreddit.display_name if user.subreddit else None
            } if user.subreddit else None,
            "submissions": [],
            "comments": []
        }

        # Send profile information via WebSocket
        socketio.emit('search_result', {'result': json.dumps(user_info)}, namespace=namespace)

        # Retrieve the user's submissions
        async for submission in user.submissions.new(limit=5):
            await submission.load()
            user_info["submissions"].append({
                "title": submission.title,
                "url": submission.url,
                "created_utc": submission.created_utc,
                "score": submission.score,
                "num_comments": submission.num_comments,
                "selftext": submission.selftext,
                "subreddit": submission.subreddit.display_name
            })

        # Send submissions via WebSocket
        socketio.emit('search_result', {'submissions': user_info["submissions"]}, namespace=namespace)

        # Retrieve the user's comments
        async for comment in user.comments.new(limit=5):
            await comment.load()
            user_info["comments"].append({
                "body": comment.body,
                "created_utc": comment.created_utc,
                "score": comment.score,
                "link_title": comment.link_title,
                "link_url": comment.link_url,
                "subreddit": comment.subreddit.display_name
            })

        # Send comments via WebSocket
        socketio.emit('search_result', {'comments': user_info["comments"]}, namespace=namespace)

    except NotFound:
        socketio.emit('search_result', {'error': 'User does not exist.'}, namespace=namespace)
    except Exception as e:
        socketio.emit('search_result', {'error': str(e)}, namespace=namespace)