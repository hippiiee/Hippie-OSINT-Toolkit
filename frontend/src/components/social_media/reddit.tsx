'use client'

import { useState, useEffect } from 'react'
import { Search, Calendar, ArrowUpCircle, MessageCircle, Award, Shield, Mail, Loader2, AlertCircle, Info, ExternalLink } from 'lucide-react'
import { FaReddit } from 'react-icons/fa'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { io, Socket } from 'socket.io-client'

interface RedditSubmission {
  title: string;
  url: string;
  created_utc: number;
  score: number;
  num_comments: number;
  selftext: string;
  subreddit: string;
}

interface RedditComment {
  body: string;
  created_utc: number;
  score: number;
  link_title: string;
  link_url: string;
  subreddit: string;
}

interface RedditSubreddit {
  title: string | null;
  public_description: string | null;
  subscribers: number | null;
  banner_img: string | null;
  over_18: boolean | null;
  name: string | null;
}

interface RedditResult {
  username: string;
  id: string;
  created_utc: number;
  link_karma: number;
  comment_karma: number;
  is_gold: boolean;
  is_mod: boolean;
  has_verified_email: boolean;
  icon_img: string;
  is_employee: boolean;
  is_friend: boolean;
  subreddit: RedditSubreddit | null;
  submissions: RedditSubmission[];
  comments: RedditComment[];
}

interface RedditInfo {
  reddit: Partial<RedditResult> | null;
}

export default function RedditTools() {
  const [username, setUsername] = useState('')
  const [results, setResults] = useState<RedditInfo>({ reddit: null })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false)
  const [isLoadingComments, setIsLoadingComments] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API || 'http://localhost:5000'
    const newSocket = io(`${backendUrl}/reddit`)
    setSocket(newSocket)


    newSocket.on('connect', () => {
      console.log('Connected to WebSocket')
    })

    newSocket.on('search_result', (data) => {
      console.log('Received data from WebSocket:', data)

      if (data.error) {
        console.log('Error:', data.error)
        setError(data.error)
        setResults({ reddit: null })
        setIsLoading(false)
        setIsLoadingSubmissions(false)
        setIsLoadingComments(false)
      } else if (data.result) {
        let parsedData;
        
        if (typeof data.result === 'string') {
          try {
            parsedData = JSON.parse(data.result);
          } catch (e) {
            console.error('Error parsing JSON:', e);
            parsedData = data.result;
          }
        } else {
          parsedData = data.result;
        }
        
        console.log('Processed Data:', parsedData)
        
        if (parsedData.module === 'reddit') {
          setResults(prevResults => ({
            reddit: { 
              ...prevResults.reddit, 
              ...parsedData 
            }
          }))
          setError(null)
          setIsLoading(false)
        }
      } else if (data.submissions) {
        setResults(prevResults => ({
          reddit: { 
            ...prevResults.reddit, 
            submissions: data.submissions 
          }
        }))
        setIsLoadingSubmissions(false)
      } else if (data.comments) {
        setResults(prevResults => ({
          reddit: { 
            ...prevResults.reddit, 
            comments: data.comments 
          }
        }))
        setIsLoadingComments(false)
      } else if (data.message) {
        console.log('Progress:', data.message)
      }
    })

    return () => {
      newSocket.disconnect()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setIsLoadingSubmissions(true)
    setIsLoadingComments(true)
    setResults({ reddit: null })
    setError(null)

    if (socket) {
      socket.emit('search_reddit', { input: username })
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Reddit</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Info className="mr-2 h-5 w-5" />
            What data can be found?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 space-y-1">
            <li>Basic user information (username, ID, account creation date)</li>
            <li>Karma breakdown (link karma and comment karma)</li>
            <li>User status (gold member, moderator, employee, verified email)</li>
            <li>User's personal subreddit information (if available)</li>
            <li>Recent submissions (titles, content, scores, comments)</li>
            <li>Recent comments (content, scores, associated threads)</li>
          </ul>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-2">
        <Label htmlFor="username">Reddit Username</Label>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <Input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="spez"
            required
            className="flex-grow"
          />
          <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            {isLoading ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </form>
      
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {(isLoading || results.reddit) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FaReddit className="mr-2 h-5 w-5" />
              Reddit User Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="col-span-2 flex items-center space-x-4">
                {isLoading ? (
                  <Skeleton className="h-20 w-20 rounded-full" />
                ) : (
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={results.reddit?.icon_img} alt={results.reddit?.username} />
                    <AvatarFallback>{results.reddit?.username?.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                )}
                <div>
                  {isLoading ? (
                    <>
                      <Skeleton className="h-6 w-40 mb-2" />
                      <Skeleton className="h-4 w-32" />
                    </>
                  ) : (
                    <>
                      <h3 className="text-2xl font-semibold">{results.reddit?.username}</h3>
                      <p className="text-gray-500">ID: {results.reddit?.id}</p>
                      <a
                        href={`https://www.reddit.com/user/${results.reddit?.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline flex items-center mt-1"
                      >
                        View on Reddit
                        <ExternalLink className="ml-1 h-4 w-4" />
                      </a>
                    </>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Account Details</h3>
                {isLoading ? (
                  <>
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-4 w-48 mb-2" />
                    <Skeleton className="h-4 w-40" />
                  </>
                ) : (
                  <>
                    <p><Calendar className="inline mr-2 h-4 w-4" /> Created: {formatDate(results.reddit?.created_utc || 0)}</p>
                    <p><ArrowUpCircle className="inline mr-2 h-4 w-4" /> Link Karma: {results.reddit?.link_karma}</p>
                    <p><MessageCircle className="inline mr-2 h-4 w-4" /> Comment Karma: {results.reddit?.comment_karma}</p>
                  </>
                )}
              </div>
              <div>
                <h3 className="font-semibold mb-2">User Status</h3>
                {isLoading ? (
                  <Skeleton className="h-6 w-48" />
                ) : (
                  <p>
                    {results.reddit?.is_gold && <Badge className="mr-2">Gold</Badge>}
                    {results.reddit?.is_mod && <Badge className="mr-2">Moderator</Badge>}
                    {results.reddit?.is_employee && <Badge className="mr-2">Employee</Badge>}
                    {results.reddit?.has_verified_email && <Badge className="mr-2">Verified Email</Badge>}
                  </p>
                )}
              </div>
              {(isLoading || results.reddit?.subreddit) && (
                <div className="col-span-2">
                  <h3 className="font-semibold mb-2">User Subreddit</h3>
                  {isLoading ? (
                    <>
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2 mb-2" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-1/4" />
                    </>
                  ) : results.reddit?.subreddit && (
                    <>
                      <p><span className="font-medium">Name:</span> {results.reddit.subreddit.name}</p>
                      <p><span className="font-medium">Title:</span> {results.reddit.subreddit.title}</p>
                      <p><span className="font-medium">Description:</span> {results.reddit.subreddit.public_description}</p>
                      <p><span className="font-medium">Subscribers:</span> {results.reddit.subreddit.subscribers}</p>
                      {results.reddit.subreddit.over_18 && <Badge variant="destructive">NSFW</Badge>}
                    </>
                  )}
                </div>
              )}
            </div>

            <Tabs defaultValue="submissions" className="mt-6">
              <TabsList>
                <TabsTrigger value="submissions">Recent Submissions</TabsTrigger>
                <TabsTrigger value="comments">Recent Comments</TabsTrigger>
              </TabsList>
              <TabsContent value="submissions">
                {isLoadingSubmissions ? (
                  [...Array(3)].map((_, index) => (
                    <Card key={index} className="mb-4">
                      <CardHeader>
                        <Skeleton className="h-6 w-3/4" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-4 w-1/2 mb-2" />
                        <Skeleton className="h-16 w-full mb-2" />
                        <div className="flex items-center space-x-4">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : results.reddit?.submissions?.map((submission, index) => (
                  <Card key={index} className="mb-4">
                    <CardHeader>
                      <CardTitle className="text-lg">{submission.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-500 mb-2">
                        Posted in r/{submission.subreddit} on {formatDate(submission.created_utc)}
                      </p>
                      <p className="mb-2">{submission.selftext.slice(0, 200)}...</p>
                      <div className="flex items-center space-x-4">
                        <span><ArrowUpCircle className="inline mr-1 h-4 w-4" /> {submission.score}</span>
                        <span><MessageCircle className="inline mr-1 h-4 w-4" /> {submission.num_comments}</span>
                        <a href={submission.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">View Post</a>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
              <TabsContent value="comments">
                {isLoadingComments ? (
                  [...Array(3)].map((_, index) => (
                    <Card key={index} className="mb-4">
                      <CardHeader>
                        <Skeleton className="h-6 w-3/4" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-4 w-1/2 mb-2" />
                        <Skeleton className="h-16 w-full mb-2" />
                        <div className="flex items-center space-x-4">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )   : results.reddit?.comments?.map((comment, index) => (
                  <Card key={index} className="mb-4">
                    <CardHeader>
                      <CardTitle className="text-lg">Comment on: {comment.link_title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-500 mb-2">
                        Posted in r/{comment.subreddit} on {formatDate(comment.created_utc)}
                      </p>
                      <p className="mb-2">{comment.body.slice(0, 200)}...</p>
                      <div className="flex items-center space-x-4">
                        <span><ArrowUpCircle className="inline mr-1 h-4 w-4" /> {comment.score}</span>
                        <a href={comment.link_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">View Thread</a>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  )
}