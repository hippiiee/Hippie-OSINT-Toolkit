"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Search, Loader2, AlertCircle, Info, User, Calendar, Hash, ExternalLink, LinkIcon, Shield } from 'lucide-react'
import { FaDiscord } from "react-icons/fa"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { io, type Socket } from "socket.io-client"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"

interface ArticleSection {
  id: string
  title: string
  level: number
}

interface OsintTool {
  name: string
  url: string
  description: string
  icon?: string
}

interface OsintToolCardProps {
  tool: OsintTool
  isSingle?: boolean
}

interface OsintToolsGridProps {
  tools: OsintTool[]
}

interface DiscordUserResult {
  module: string
  results: {
    user_id: string
    username: string
    global_name: string | null
    created_at: string
    avatar_url: string | null
    is_avatar_animated: boolean
    accent_color: number | null
    banner_color: string | null
    banner_url: string | null
    discriminator: string
    badges: string[]
    public_flags: number | null
    flags: number
    raw_data: {
      avatar_hash: string | null
      avatar_decoration: any | null
    }
  }
}

const ArticleNavigation: React.FC<{ sections: ArticleSection[] }> = ({ sections }) => {
  return (
    <nav className="space-y-1">
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className={`block py-2 px-3 text-sm rounded transition-colors ${
            section.level === 1 ? "font-semibold" : "ml-4"
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
      className={`block bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden my-4 ${isSingle ? "w-full md:w-1/2" : "w-full"}`}
    >
      <div className="p-4 flex items-start space-x-4">
        <div className="flex-shrink-0">
          {tool.icon ? (
            <img src={tool.icon || "/placeholder.svg"} alt={`${tool.name} icon`} className="w-10 h-10 rounded" />
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

export default function DiscordSearch() {
  const [userId, setUserId] = useState("")
  const [results, setResults] = useState<DiscordUserResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)
  const articleRef = useRef<HTMLDivElement>(null)

  const articleSections: ArticleSection[] = [
    { id: "discord-id", title: "Discord IDs (Snowflakes)", level: 1 },
    { id: "guilds", title: "Discord Guilds", level: 1 },
    { id: "calculate-creation", title: "Calculating Creation Date", level: 1 },
    { id: "discord-api", title: "Discord API", level: 1 },
    { id: 'discord-flags', title: 'Understanding Discord Flags', level: 1 },
  ]

  const pythonSnowflakeCode = `
import datetime

# Discord epoch (January 1, 2015)
DISCORD_EPOCH = 1420070400000

def get_creation_date(snowflake):
    """
    Calculate the creation date from a Discord snowflake ID.
    
    Args:
        snowflake (str or int): The Discord snowflake ID
        
    Returns:
        datetime: The creation date of the entity
    """
    # Convert snowflake to integer and shift right by 22 bits
    snowflake = int(snowflake)
    timestamp = (snowflake >> 22)
    
    # Add Discord epoch to get milliseconds since Unix epoch
    milliseconds = timestamp + DISCORD_EPOCH
    
    # Convert to datetime object
    creation_date = datetime.datetime.fromtimestamp(milliseconds / 1000.0)
    
    return creation_date

# Example usage
user_id = "123456789012345678"
creation_date = get_creation_date(user_id)
print(f"Account created on: {creation_date.strftime('%Y-%m-%d %H:%M:%S')}")
`

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:5000"
    const newSocket = io(`${backendUrl}/discord`)
    setSocket(newSocket)

    newSocket.on("connect", () => {
      console.log("Connected to WebSocket")
    })

    newSocket.on("search_result", (data) => {
      console.log("Received data from WebSocket:", data)

      if (data.error) {
        setError(data.error)
        setResults(null)
      } else {
        setResults(data.result)
        setError(null)
      }
      setIsLoading(false)
    })

    return () => {
      newSocket.disconnect()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setResults(null)
    setError(null)

    if (socket) {
      socket.emit("search_discord", { input: userId })
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Discord</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Info className="mr-2 h-5 w-5" />
            What data can be found?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 space-y-1">
            <li>Discord username</li>
            <li>Global display name</li>
            <li>User ID</li>
            <li>Account creation date</li>
            <li>Avatar (if available)</li>
            <li>Profile banner (if available)</li>
            <li>Badges (if any)</li>
          </ul>
          <p className="mt-4 text-sm text-gray-500">This tool uses the Discord API to retrieve user information.</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="discordUserId">Discord User ID</Label>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <div className="flex-grow">
                  <Input
                    id="discordUserId"
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="Enter Discord User ID (e.g., 123456789012345678)"
                    required
                    className="w-full"
                  />
                </div>
                <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  {isLoading ? "Searching..." : "Search"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <Card className="overflow-hidden">
          <div className="relative">
            <Skeleton className="h-32 w-full" />
            <div className="absolute left-6 -bottom-12">
              <div className="rounded-full border-4 border-white dark:border-gray-800 bg-white dark:bg-gray-800">
                <Skeleton className="h-24 w-24 rounded-full" />
              </div>
            </div>
          </div>
          <CardContent className="pt-16 pb-6">
            <div className="space-y-4">
              <div>
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-32 mt-2" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {results && (
        <Card className="overflow-hidden">
          <div className="relative">
            {/* Banner - either image or color */}
            <div
              className="h-32 w-full"
              style={{
                backgroundColor:
                  results.results.banner_color ||
                  (results.results.accent_color
                    ? `#${results.results.accent_color.toString(16).padStart(6, "0")}`
                    : "#5865F2"),
                backgroundImage: results.results.banner_url ? `url(${results.results.banner_url})` : "none",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />

            {/* Avatar - positioned to overlap banner and profile section */}
            <div className="absolute left-6 -bottom-12">
              <div className="rounded-full border-4 border-white dark:border-gray-800 bg-white dark:bg-gray-800">
                <Avatar className="h-24 w-24">
                  {results.results.avatar_url ? (
                    <AvatarImage
                      src={results.results.avatar_url}
                      alt={results.results.username}
                      className={results.results.is_avatar_animated ? "animate-pulse" : ""}
                    />
                  ) : (
                    <AvatarFallback>
                      <FaDiscord className="h-12 w-12 text-[#5865F2]" />
                    </AvatarFallback>
                  )}
                </Avatar>
              </div>
              {results.results.is_avatar_animated && (
                <div className="absolute bottom-0 right-0">
                  <Badge variant="secondary" className="bg-[#5865F2] text-white">
                    <span className="text-xs">GIF</span>
                  </Badge>
                </div>
              )}
            </div>
          </div>

          <CardContent className="pt-16 pb-6">
            <div className="space-y-4">
              {/* User identity section */}
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold">{results.results.global_name || results.results.username}</h2>
                  {results.results.discriminator !== "0" && (
                    <span className="text-gray-400">#{results.results.discriminator}</span>
                  )}
                </div>

                {results.results.global_name && results.results.global_name !== results.results.username && (
                  <p className="text-sm text-gray-400">@{results.results.username}</p>
                )}
              </div>

              {/* Badges section */}
              {results.results.badges && results.results.badges.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Badges</div>
                  <div className="flex flex-wrap gap-2">
                    {results.results.badges.map((badge, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                      >
                        {badge}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <Hash className="mr-2 h-4 w-4 text-gray-400" />
                      <span className="font-medium">User ID:</span>
                      <span className="ml-2 font-mono text-sm">{results.results.user_id}</span>
                    </div>

                    <div className="flex items-center">
                      <Calendar className="mr-2 h-4 w-4 text-gray-400" />
                      <span className="font-medium">Created:</span>
                      <span className="ml-2">{new Date(results.results.created_at).toLocaleString()}</span>
                    </div>

                    {results.results.accent_color && (
                      <div className="flex items-center">
                        <div
                          className="w-4 h-4 rounded-full mr-2"
                          style={{ backgroundColor: `#${results.results.accent_color.toString(16).padStart(6, "0")}` }}
                        ></div>
                        <span className="font-medium">Accent Color:</span>
                        <span className="ml-2 font-mono text-sm">
                          #{results.results.accent_color.toString(16).padStart(6, "0")}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    {results.results.public_flags !== null && (
                      <div className="flex items-center">
                        <span className="font-medium">Public Flags:</span>
                        <span className="ml-2 font-mono text-sm">{results.results.public_flags}</span>
                      </div>
                    )}

                    {results.results.flags !== undefined && (
                      <div className="flex items-center">
                        <span className="font-medium">Flags:</span>
                        <span className="ml-2 font-mono text-sm">{results.results.flags}</span>
                      </div>
                    )}

                    {results.results.raw_data?.avatar_hash && (
                      <div className="flex items-center">
                        <span className="font-medium">Avatar Hash:</span>
                        <span className="ml-2 font-mono text-sm">{results.results.raw_data.avatar_hash}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <details className="text-sm">
                    <summary className="cursor-pointer font-medium text-[#5865F2] hover:underline">
                      View Technical Details
                    </summary>
                    <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                      <pre className="whitespace-pre-wrap break-all text-xs">
                        {JSON.stringify(
                          {
                            id: results.results.user_id,
                            username: results.results.username,
                            global_name: results.results.global_name,
                            discriminator: results.results.discriminator,
                            avatar: results.results.raw_data.avatar_hash,
                            public_flags: results.results.public_flags,
                            flags: results.results.flags,
                            accent_color: results.results.accent_color,
                            banner_color: results.results.banner_color,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Discord OSINT Techniques</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row">
            <div className="lg:w-3/4 pr-6">
              <div className="lg:hidden mb-6">
                <h4 className="text-lg font-semibold mb-2">Table of Contents</h4>
                <ArticleNavigation sections={articleSections} />
              </div>
              <div className="article-content" ref={articleRef}>
                <h2 id="discord-id" className="text-lg font-semibold mt-6">
                  Discord IDs (Snowflakes)
                </h2>
                <p>
                  Discord uses a unique identifier system called "Snowflakes" for all IDs in their platform. These IDs
                  are used for users, messages, servers (guilds), channels, and more. A snowflake is a 64-bit integer
                  that contains encoded information, most importantly a timestamp.
                </p>
                <p className="mt-2">
                  Similar to TikTok video IDs, Discord snowflakes contain a timestamp that indicates when the entity
                  (user, server, etc.) was created.
                </p>

                <h2 id="calculate-creation" className="text-lg font-semibold mt-8">
                  Calculating Creation Date
                </h2>
                <p>
                  You can calculate the creation date of a Discord entity (user, guild, etc.) from its snowflake ID. The
                  first 42 bits of a snowflake represent the timestamp in milliseconds since the Discord epoch (January
                  1, 2015).
                </p>
                <p className="mt-2">
                  Here's how to calculate the creation date from a Discord snowflake ID using Python:
                </p>
                <div className="mt-2 rounded-md overflow-hidden">
                  <SyntaxHighlighter
                    language="python"
                    style={vscDarkPlus}
                    customStyle={{
                      borderRadius: "0.375rem",
                      padding: "1rem",
                      fontSize: "0.875rem",
                      lineHeight: "1.5",
                    }}
                  >
                    {pythonSnowflakeCode.trim()}
                  </SyntaxHighlighter>
                </div>
                <p className="mt-4">
                  For example, if a user has the ID <code>123456789012345678</code>, you can determine exactly when
                  their account was created using this calculation. This information can be valuable for establishing
                  timelines in investigations.
                </p>

                <h2 id="guilds" className="text-lg font-semibold mt-8">
                  Discord Guilds
                </h2>
                <p>
                  In Discord terminology, a "guild" is what users typically call a "server." Guilds are the public communities
                  where users interact, share content, and communicate. Each guild has its own set of channels, roles,
                  and members.
                </p>
                <h2 id="discord-api" className="text-lg font-semibold mt-8">Discord API</h2>
                <p>
                  The Discord API provides various endpoints to retrieve information about users, guilds, and other entities. The endpoint 
                  used by this tool is:
                </p>
                <div className="mt-2 rounded-md overflow-hidden">
                  <SyntaxHighlighter 
                    language="bash" 
                    style={vscDarkPlus}
                    customStyle={{
                      borderRadius: '0.375rem',
                      padding: '1rem',
                      fontSize: '0.875rem',
                      lineHeight: '1.5',
                    }}
                  >
                    {"https://canary.discord.com/api/v10/users/{id}"}
                  </SyntaxHighlighter>
                </div>
                <p className="mt-2">
                  This endpoint returns information about a user, including their username, avatar, badges, and public flags. However, 
                  accessing this endpoint requires authentication with a Discord token, which our backend handles securely.
                </p>
                <p className="mt-2">
                  The information returned by the Discord API is limited to what is publicly available or accessible with the permissions 
                  of the authenticated token. For privacy and security reasons, Discord restricts access to sensitive user information.
                </p>
                <h2 id="discord-flags" className="text-lg font-semibold mt-8">Understanding Discord Flags</h2>
                <p>
                  Discord uses numeric flags to represent various features, statuses, or properties of a user account. These flags are stored as bitfields, 
                  where each bit represents a specific flag. When you see "Public Flags" or "Flags" in a Discord user profile, these are numeric values 
                  that can be decoded to reveal information about the user.
                </p>
                <p className="mt-2">
                  Flags are represented as powers of 2 (1, 2, 4, 8, 16, etc.), and multiple flags are combined by adding these values together. 
                  To determine which flags are set, you need to perform bitwise operations on the flag value.
                </p>

                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Flag Value</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Flag Name</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">1 &lt;&lt; 0 (1)</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">DISCORD_EMPLOYEE</td>
                        <td className="px-6 py-4 text-sm">Discord Staff</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">1 &lt;&lt; 1 (2)</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">PARTNERED_SERVER_OWNER</td>
                        <td className="px-6 py-4 text-sm">Owner of a Discord Partner server</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">1 &lt;&lt; 2 (4)</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">HYPESQUAD_EVENTS</td>
                        <td className="px-6 py-4 text-sm">HypeSquad Events member</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">1 &lt;&lt; 3 (8)</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">BUG_HUNTER_LEVEL_1</td>
                        <td className="px-6 py-4 text-sm">Bug Hunter Level 1</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">1 &lt;&lt; 6 (64)</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">HOUSE_BRAVERY</td>
                        <td className="px-6 py-4 text-sm">HypeSquad Bravery member</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">1 &lt;&lt; 7 (128)</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">HOUSE_BRILLIANCE</td>
                        <td className="px-6 py-4 text-sm">HypeSquad Brilliance member</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">1 &lt;&lt; 8 (256)</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">HOUSE_BALANCE</td>
                        <td className="px-6 py-4 text-sm">HypeSquad Balance member</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">1 &lt;&lt; 9 (512)</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">EARLY_SUPPORTER</td>
                        <td className="px-6 py-4 text-sm">Early Supporter badge</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">1 &lt;&lt; 14 (16384)</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">BUG_HUNTER_LEVEL_2</td>
                        <td className="px-6 py-4 text-sm">Bug Hunter Level 2</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">1 &lt;&lt; 16 (65536)</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">VERIFIED_BOT</td>
                        <td className="px-6 py-4 text-sm">Verified Bot</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">1 &lt;&lt; 17 (131072)</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">EARLY_VERIFIED_BOT_DEVELOPER</td>
                        <td className="px-6 py-4 text-sm">Early Verified Bot Developer</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">1 &lt;&lt; 18 (262144)</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">DISCORD_CERTIFIED_MODERATOR</td>
                        <td className="px-6 py-4 text-sm">Discord Certified Moderator</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">1 &lt;&lt; 19 (524288)</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">BOT_HTTP_INTERACTIONS</td>
                        <td className="px-6 py-4 text-sm">Bot uses HTTP interactions</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">1 &lt;&lt; 22 (4194304)</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">ACTIVE_DEVELOPER</td>
                        <td className="px-6 py-4 text-sm">Active Developer badge</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="mt-4">
                  For example, if a user has a public_flags value of 64, they are a member of HypeSquad Bravery. If they have a value of 320 (64 + 256), 
                  they are a member of both HypeSquad Bravery and HypeSquad Balance.
                </p>

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