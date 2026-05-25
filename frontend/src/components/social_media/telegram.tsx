'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Loader2, AlertCircle, Users, Hash, Link as LinkIcon, ExternalLink, Info, MessageCircle, Shield } from 'lucide-react'
import { FaTelegram } from 'react-icons/fa'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { io, Socket } from 'socket.io-client'

interface TelegramResult {
  id: number | null
  type: string
  display_name: string | null
  username: string | null
  first_name: string | null
  last_name: string | null
  bio: string | null
  description: string | null
  photo_url: string | null
  member_count: number | null
  invite_link: string | null
  profile_url: string | null
  bot_api_available: boolean
}

function typeBadgeVariant(type: string): "default" | "secondary" | "destructive" | "outline" {
  switch (type) {
    case 'channel':
      return 'default'
    case 'supergroup':
    case 'group':
      return 'secondary'
    case 'bot':
      return 'destructive'
    default:
      return 'outline'
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case 'channel':
      return 'Channel'
    case 'supergroup':
      return 'Group'
    case 'group':
      return 'Group'
    case 'bot':
      return 'Bot'
    case 'private':
      return 'User'
    default:
      return 'User'
  }
}

const TelegramInfoSkeleton = () => (
  <div className="space-y-6">
    <div className="flex items-center space-x-4">
      <Skeleton className="h-20 w-20 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-20" />
      </div>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <Skeleton className="h-5 w-32 mb-2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4 mt-1" />
      </div>
      <div>
        <Skeleton className="h-5 w-32 mb-2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-1/2 mt-1" />
      </div>
    </div>
  </div>
)

interface ArticleSection {
  id: string;
  title: string;
  level: number;
}

interface OsintTool {
  name: string;
  url: string;
  description: string;
  icon?: string;
}

interface OsintToolCardProps {
  tool: OsintTool;
  isSingle?: boolean;
}

interface OsintToolsGridProps {
  tools: OsintTool[]
}

const ArticleNavigation: React.FC<{ sections: ArticleSection[] }> = ({ sections }) => {
  return (
    <nav className="space-y-1">
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className={`block py-2 px-3 text-sm rounded transition-colors ${section.level === 1 ? 'font-semibold' : 'ml-4'
            } hover:bg-gray-100 text-blue-600 hover:text-blue-800`}
        >
          {section.title}
        </a>
      ))}
    </nav>
  )
}

const OsintToolCard: React.FC<OsintToolCardProps> = ({ tool, isSingle = false }) => {
  return (
    <a
      href={tool.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden my-4 ${isSingle ? 'w-1/2' : 'w-full'}`}
    >
      <div className="p-4 flex items-start space-x-4">
        <div className="flex-shrink-0">
          {tool.icon ? (
            <img src={tool.icon} alt={`${tool.name} icon`} className="w-10 h-10 rounded" />
          ) : (
            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
              <LinkIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
          )}
        </div>
        <div className="flex-grow">
          <h4 className="text-md font-semibold text-blue-600 dark:text-blue-400 mb-1 flex items-center">
            {tool.name}
            <ExternalLink className="ml-2 h-3 w-3" />
          </h4>
          <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">{tool.description}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{new URL(tool.url).hostname}</p>
        </div>
      </div>
    </a>
  )
}

const OsintToolsGrid: React.FC<OsintToolsGridProps> = ({ tools }) => {
  if (tools.length === 1) {
    return <OsintToolCard tool={tools[0]} isSingle={true} />
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
      {tools.map((tool, index) => (
        <OsintToolCard key={index} tool={tool} />
      ))}
    </div>
  )
}

export default function TelegramTools() {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<TelegramResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState<{ percent: number; message: string } | null>(null)
  const [socket, setSocket] = useState<Socket | null>(null)
  const articleRef = useRef<HTMLDivElement>(null)

  const articleSections: ArticleSection[] = [
    { id: 'tg-architecture', title: "Understanding Telegram's Architecture", level: 1 },
    { id: 'tg-phone-resolution', title: 'Phone Number to Account Resolution', level: 2 },
    { id: 'tg-channel-intel', title: 'Channel and Group Intelligence', level: 2 },
    { id: 'tg-username-osint', title: 'Username OSINT', level: 2 },
    { id: 'tg-bot-analysis', title: 'Bot Analysis', level: 2 },
    { id: 'tg-osint-tools', title: 'OSINT Tools for Telegram', level: 1 },
  ]

  const osintTools: OsintTool[] = [
    {
      name: 'Telepathy',
      url: 'https://github.com/jordanwildon/Telepathy',
      description: 'Telegram OSINT tool for channel analysis and data export',
      icon: '/images/tools_icon/telepathy_logo.png',
    },
    {
      name: 'Telerecon',
      url: 'https://github.com/sockysec/Telerecon',
      description: 'Crawl user activity across Telegram chats',
      icon: 'https://github.com/sockysec.png',
    },
    {
      name: 'TGStat',
      url: 'https://tgstat.com/',
      description: 'Analytics platform for Telegram channels and groups',
      icon: 'https://tgstat.com/favicon.ico',
    },
  ]

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API || 'http://localhost:5000'
    const newSocket = io(`${backendUrl}/telegram`)
    setSocket(newSocket)

    newSocket.on('connect', () => {
      console.log('Connected to Telegram WebSocket')
    })

    newSocket.on('search_result', (data) => {
      if (data.error) {
        setError(data.error)
        setResult(null)
      } else if (data.result) {
        const parsed = data.result
        if (parsed.module === 'telegram') {
          setResult(parsed.data)
          setError(null)
        }
      }
      setIsLoading(false)
      setProgress(null)
    })

    newSocket.on('search_progress', (data) => {
      if (data.module === 'telegram') {
        setProgress({ percent: data.progress, message: data.message })
      }
    })

    return () => {
      newSocket.disconnect()
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    setIsLoading(true)
    setResult(null)
    setError(null)
    setProgress(null)

    if (socket) {
      socket.emit('search_telegram', { input: input.trim() })
    }
  }

  const formatCount = (count: number): string => {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
    return count.toString()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Telegram</h1>

      {/* Info card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Info className="mr-2 h-5 w-5" />
            What data can be found?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 space-y-1">
            <li>Username resolution and profile verification</li>
            <li>Profile or channel display name</li>
            <li>Bio and channel descriptions</li>
            <li>Member and subscriber counts</li>
            <li>Profile photo</li>
            <li>Telegram numeric ID (when Bot API is configured)</li>
            <li>Entity type detection (User, Channel, Group, Bot)</li>
          </ul>
        </CardContent>
      </Card>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <Label htmlFor="telegram-input">Telegram Username</Label>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <Input
            id="telegram-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="@username or username"
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

      {/* Progress bar */}
      {isLoading && progress && (
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-gray-500">
            <span>{progress.message}</span>
            <span>{progress.percent}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results */}
      {(isLoading || result) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FaTelegram className="mr-2 h-5 w-5" />
              Telegram Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TelegramInfoSkeleton />
            ) : result ? (
              <div className="space-y-6">
                {/* Profile header */}
                <div className="flex items-center space-x-4">
                  <Avatar className="h-20 w-20">
                    {result.photo_url ? (
                      <AvatarImage src={result.photo_url} alt={result.display_name || result.username || 'Profile'} />
                    ) : null}
                    <AvatarFallback>
                      <FaTelegram className="h-8 w-8 text-blue-500" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <h2 className="text-2xl font-semibold">
                      {result.display_name || result.username || 'Unknown'}
                    </h2>
                    {result.username && (
                      <p className="text-gray-500">@{result.username}</p>
                    )}
                    <Badge variant={typeBadgeVariant(result.type)}>
                      {typeLabel(result.type)}
                    </Badge>
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid gap-6 sm:grid-cols-2">
                  {/* Bio / Description */}
                  {(result.bio || result.description) && (
                    <div className="col-span-2">
                      <h3 className="text-lg font-semibold mb-1 flex items-center">
                        <MessageCircle className="mr-2 h-4 w-4" />
                        {result.type === 'channel' || result.type === 'supergroup' || result.type === 'group'
                          ? 'Description'
                          : 'Bio'}
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {result.bio || result.description}
                      </p>
                    </div>
                  )}

                  {/* Member count */}
                  {result.member_count != null && (
                    <div>
                      <h3 className="text-lg font-semibold mb-1 flex items-center">
                        <Users className="mr-2 h-4 w-4" />
                        {result.type === 'channel' ? 'Subscribers' : 'Members'}
                      </h3>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {formatCount(result.member_count)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {result.member_count.toLocaleString()} total
                      </p>
                    </div>
                  )}

                  {/* Telegram ID */}
                  {result.id != null && (
                    <div>
                      <h3 className="text-lg font-semibold mb-1 flex items-center">
                        <Hash className="mr-2 h-4 w-4" />
                        Telegram ID
                      </h3>
                      <p className="font-mono text-lg">{result.id}</p>
                    </div>
                  )}

                  {/* Profile link */}
                  {result.profile_url && (
                    <div>
                      <h3 className="text-lg font-semibold mb-1 flex items-center">
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Profile Link
                      </h3>
                      <a
                        href={result.profile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 inline-flex items-center"
                      >
                        {result.profile_url}
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </div>
                  )}

                  {/* Invite link */}
                  {result.invite_link && (
                    <div>
                      <h3 className="text-lg font-semibold mb-1 flex items-center">
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Invite Link
                      </h3>
                      <a
                        href={result.invite_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 inline-flex items-center"
                      >
                        {result.invite_link}
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Data source note */}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Telegram OSINT Techniques</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row">
            <div className="lg:w-3/4 pr-6">
              <div className="lg:hidden mb-6">
                <h4 className="text-lg font-semibold mb-2">Table of Contents</h4>
                <ArticleNavigation sections={articleSections} />
              </div>
              <div className="article-content" ref={articleRef}>
                <h2 id="tg-architecture">Understanding Telegram&apos;s Architecture</h2>
                <p>Telegram uses a custom MTProto protocol with multiple data centers worldwide.</p>
                <ul>
                  <li>Telegram exposes two API levels: the <strong>Bot API</strong> (limited, public-facing) and the <strong>MTProto Client API</strong> (full access, requires <code>api_id</code>/<code>api_hash</code> from <a href="https://my.telegram.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">my.telegram.org</a>)</li>
                  <li>User IDs are permanent numeric identifiers , even if someone changes their username, their ID stays the same</li>
                  <li>Telegram uses &ldquo;snowflake-like&rdquo; IDs that encode creation timestamps, which can be used to estimate when an account or channel was created</li>
                </ul>

                <h3 id="tg-phone-resolution">Phone Number to Account Resolution</h3>
                <p>Telegram accounts are tied to phone numbers, which allows you to resolve a number to a profile.</p>
                <ul>
                  <li>Using the MTProto API (via the <strong>Telethon</strong> library), you can import a phone number as a contact and resolve it to a Telegram user</li>
                  <li>This reveals: user ID, username, first/last name, profile photo, online status, and bio</li>
                  <li>Rate limits are aggressive: approximately 20 lookups per minute before a <code>FloodWaitError</code> is triggered</li>
                  <li>Privacy settings can limit what is visible (last seen, profile photo, phone number, forwarded messages)</li>
                </ul>

                <h3 id="tg-channel-intel">Channel and Group Intelligence</h3>
                <p>Public channels and groups can be found by name, and their full message history is accessible.</p>
                <ul>
                  <li><strong>Channel metadata:</strong> subscriber count, creation date, description, and admin list (if visible)</li>
                  <li><strong>Message analysis:</strong> forwarded messages reveal source channels, creating a network graph of information flow</li>
                  <li><strong>Media analysis:</strong> shared images may contain EXIF data (GPS coordinates, camera info)</li>
                  <li><strong>User lists:</strong> group participant lists reveal who belongs to which communities, enabling cross-group correlation</li>
                </ul>

                <h3 id="tg-username-osint">Username OSINT</h3>
                <p>Telegram usernames are unique and can be searched on <code>t.me/&#123;username&#125;</code>. This public page reveals display name, profile photo, bio, and subscriber/member count.</p>
                <ul>
                  <li><strong>Username history:</strong> Telegram allows changing usernames, but old usernames become available again , monitoring these changes can reveal identity shifts</li>
                  <li><strong>Cross-platform correlation:</strong> the same username on Telegram and other platforms often belongs to the same person</li>
                  <li><strong>Fragment.com:</strong> Telegram&apos;s username marketplace where premium usernames are auctioned , this can reveal ownership transfers and financial connections</li>
                </ul>

                <h3 id="tg-bot-analysis">Bot Analysis</h3>
                <p>Bots have usernames ending in &ldquo;bot&rdquo; and can be analyzed for information about their operators.</p>
                <ul>
                  <li>Bot source code and behavior can reveal information about their operators and infrastructure</li>
                  <li>Bot API tokens (if leaked) expose the bot owner&apos;s user ID , always search for leaked tokens in code repositories</li>
                  <li>Inline bots can be probed for information about their backends and the services they connect to</li>
                </ul>

                <h2 id="tg-osint-tools">OSINT Tools for Telegram</h2>
                <p>Here are some useful tools and resources for Telegram OSINT investigations:</p>
                <OsintToolsGrid tools={osintTools} />
              </div>
            </div>
            <div className="hidden lg:block lg:w-1/4 mt-6 lg:mt-0">
              <div className="sticky top-6">
                <h4 className="text-lg font-semibold mb-2">Table of Contents</h4>
                <ArticleNavigation sections={articleSections} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
