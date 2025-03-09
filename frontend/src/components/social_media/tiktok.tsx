"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import {
  Search,
  User,
  Video,
  Loader2,
  AlertCircle,
  Globe,
  Calendar,
  Users,
  Heart,
  Info,
  ExternalLink,
  Hash,
  Clock,
} from "lucide-react"
import { FaTiktok } from "react-icons/fa"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { io, type Socket } from "socket.io-client"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"

interface ArticleSection {
  id: string
  title: string
  level: number
}

interface TikTokVideoInfo {
  module: string
  search_type: string
  video_id: number
  timestamp: string
  binary: string
  creation_time: {
    iso: string
    unix: number
  }
}

interface TikTokProfileInfo {
  module: string
  search_type: string
  profile: {
    nickname: string
    username: string
    region: string
    language: string
    about: string
    userId: string
    accountCreated: string
    nicknameModified: string
    avatar: string
    stats: {
      followers: string
      following: string
      hearts: string
      videos: string
      friends: string
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
          } hover:bg-gray-100 text-primary hover:text-primary-foreground`}
        >
          {section.title}
        </a>
      ))}
    </nav>
  )
}

export default function TikTokTools() {
  const [videoUrl, setVideoUrl] = useState("")
  const [username, setUsername] = useState("")
  const [searchType, setSearchType] = useState<"profile" | "video">("profile")
  const [videoResults, setVideoResults] = useState<TikTokVideoInfo | null>(null)
  const [profileResults, setProfileResults] = useState<TikTokProfileInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)
  const articleRef = useRef<HTMLDivElement>(null)

  const articleSections: ArticleSection[] = [
    { id: "tiktok-api", title: "TikTok Research API", level: 1 },
    { id: "id-timestamp", title: "TikTok Video ID Timestamp Calculation", level: 1 },
  ]

  const pythonTimestampCode = `
import datetime

def extract_tiktok_timestamp(video_id):
    """
    Extract the creation timestamp from a TikTok video ID.
    
    Args:
        video_id (str): The TikTok video ID (numeric part of the URL)
        
    Returns:
        datetime: The creation date of the video
    """
    # TikTok uses a custom algorithm to encode timestamps
    # The first 32 bits of the ID contain the timestamp in seconds
    # since the Unix epoch, shifted right by 32 bits
    binary = "{0:b}".format(video_id_int)  # Convert to binary
    bits = binary[:31]  # Get the first 31 bits
    timestamp_seconds = int(bits, 2)  # Convert to integer
    
    # Convert to datetime object
    creation_date = datetime.datetime.fromtimestamp(timestamp_seconds)
    
    return creation_date

# Example usage
video_id = "7234567890123456789"
try:
    creation_date = extract_tiktok_timestamp(video_id)
    print(f"Video was created on: {creation_date.strftime('%Y-%m-%d %H:%M:%S')}")
except ValueError as e:
    print(f"Error: {e}")
`

  const researchApiCode = `
GET https://open.tiktokapis.com/v2/research/user/info/

Request Headers:
Authorization: Bearer {YOUR_ACCESS_TOKEN}
Content-Type: application/json

Request Body:
{
  "username": "username"
}

Response:
{
  "data": {
    "user": {
      "display_name": "Display Name",
      "bio_description": "User bio",
      "avatar_url": "https://...",
      "username": "username",
      "follower_count": 1000,
      "following_count": 500,
      "likes_count": 10000,
      "video_count": 100
    }
  }
}
`

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:5000"
    const newSocket = io(`${backendUrl}/tiktok`)
    setSocket(newSocket)

    newSocket.on("connect", () => {
      console.log("Connected to WebSocket")
    })

    newSocket.on("search_result", (data) => {
      console.log("Received data from WebSocket:", data)

      if (data.error) {
        setError(data.error)
        setVideoResults(null)
        setProfileResults(null)
      } else if (data.result) {
        if (data.result.search_type === "video") {
          setVideoResults(data.result)
          setProfileResults(null)
        } else if (data.result.search_type === "profile") {
          setProfileResults(data.result)
          setVideoResults(null)
        }
        setError(null)
      }
      setIsLoading(false)
    })

    const handleBeforeUnload = () => {
      if (newSocket) {
        newSocket.disconnect()
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      if (newSocket) {
        newSocket.disconnect()
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (searchType === "profile") {
      setProfileResults(null)
      setVideoResults(null)
    } else {
    setVideoResults(null)
    setProfileResults(null)
    }

    if (socket) {
      if (searchType === "profile") {
        socket.emit("search_tiktok_profile", { input: username })
      } else {
        socket.emit("search_tiktok", { input: videoUrl, search_type: "video" })
      }
    } else {
      setError("Unable to connect to the server. Please try again later.")
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const toggleTechnicalDetails = () => {
    setShowTechnicalDetails(!showTechnicalDetails)
  }

  const ProfileInfoSkeleton = () => (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center">
          <FaTiktok className="mr-2 h-5 w-5" />
          TikTok Profile Information
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="col-span-2 flex items-center space-x-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div>
              <Skeleton className="h-6 w-40 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Account Details</h3>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <div>
            <h3 className="font-semibold mb-2">Statistics</h3>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <div className="col-span-2">
            <h3 className="font-semibold mb-2">About</h3>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-5/6 mb-2" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const VideoInfoSkeleton = () => (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center">
          <FaTiktok className="mr-2 h-5 w-5" />
          TikTok Video Information
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="col-span-2">
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div>
            <h3 className="font-semibold mb-2">Video Details</h3>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div>
            <h3 className="font-semibold mb-2">Technical Information</h3>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">TikTok</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Info className="mr-2 h-5 w-5" />
            What data can be found?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="font-semibold mb-2 flex items-center">
                <User className="mr-2 h-4 w-4" />
                Profile Information
              </h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Username and nickname</li>
                <li>Account creation date</li>
                <li>Profile statistics (followers, following, likes)</li>
                <li>User ID and bio</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center">
                <Video className="mr-2 h-4 w-4" />
                Video Timestamp Extractor
              </h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Exact upload date and time</li>
                <li>Technical details (binary representation)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="profile" onValueChange={(value) => setSearchType(value as "profile" | "video")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile" className="flex items-center">
            <User className="mr-2 h-4 w-4" />
            Profile Lookup
          </TabsTrigger>
          <TabsTrigger value="video" className="flex items-center">
            <Video className="mr-2 h-4 w-4" />
            Video Timestamp Extractor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <form onSubmit={handleSubmit} className="space-y-2">
            <Label htmlFor="tiktokUsername">TikTok Username</Label>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              <div className="relative flex-grow">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                  @
                </div>
                <Input
                  id="tiktokUsername"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  required
                  className="pl-7 flex-grow"
                />
              </div>
              <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                {isLoading ? "Searching..." : "Search"}
              </Button>
            </div>
          </form>

          {error && searchType === "profile" && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading && searchType === "profile" && <ProfileInfoSkeleton />}

          {profileResults && (
            <Card className="mt-4 overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FaTiktok className="mr-2 h-5 w-5" />
                  TikTok Profile Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="col-span-2 flex items-center space-x-4">
                    <Avatar className="h-20 w-20 border-4 border-white shadow-md">
                      {profileResults.profile.avatar ? (
                        <AvatarImage src={profileResults.profile.avatar} alt={profileResults.profile.nickname} />
                      ) : (
                        <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                          {profileResults.profile.nickname.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div>
                      <h3 className="text-2xl font-semibold">{profileResults.profile.nickname}</h3>
                      <p className="text-gray-500">@{profileResults.profile.username}</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Account Details</h3>
                    <p>
                      <Calendar className="inline mr-2 h-4 w-4 text-primary" />
                      Created: {profileResults.profile.accountCreated}
                    </p>
                    <p>
                      <Hash className="inline mr-2 h-4 w-4 text-primary" />
                      User ID: <span className="font-mono">{profileResults.profile.userId}</span>
                    </p>
                    {profileResults.profile.region && (
                      <p>
                        <Globe className="inline mr-2 h-4 w-4 text-primary" />
                        Region: {profileResults.profile.region}
                      </p>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Statistics</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="flex flex-col items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <Users className="h-5 w-5 text-primary mb-1" />
                        <span className="text-xl font-bold">{profileResults.profile.stats.followers}</span>
                        <span className="text-xs text-gray-500">Followers</span>
                      </div>
                      <div className="flex flex-col items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <Heart className="h-5 w-5 text-primary mb-1" />
                        <span className="text-xl font-bold">{profileResults.profile.stats.hearts}</span>
                        <span className="text-xs text-gray-500">Likes</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <Video className="h-5 w-5 text-primary mb-1" />
                        <span className="text-xl font-bold">{profileResults.profile.stats.videos}</span>
                        <span className="text-xs text-gray-500">Videos</span>
                      </div>
                      <div className="flex flex-col items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <Users className="h-5 w-5 text-primary mb-1" />
                        <span className="text-xl font-bold">{profileResults.profile.stats.following}</span>
                        <span className="text-xs text-gray-500">Following</span>
                      </div>
                    </div>
                  </div>
                  {profileResults.profile.about && profileResults.profile.about !== "User has no about" && (
                    <div className="col-span-2">
                      <h3 className="font-semibold mb-2">About</h3>
                      <p>{profileResults.profile.about}</p>
                    </div>
                  )}
                </div>
                
                <div className="mt-4 pt-4">
                  <Button
                    variant="outline"
                    className="text-primary border-primary hover:bg-primary/10"
                    onClick={() => window.open(`https://www.tiktok.com/@${profileResults.profile.username}`, "_blank")}
                  >
                    <FaTiktok className="mr-2 h-4 w-4" />
                    View Profile on TikTok
                  </Button>
                </div>

                <div className="pt-4">
                  <details className="text-sm">
                    <summary className="cursor-pointer font-medium text-primary hover:underline">
                      View Technical Details
                    </summary>
                    <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                      <pre className="whitespace-pre-wrap break-all text-xs">
                        {JSON.stringify(
                          {
                            username: profileResults.profile.username,
                            nickname: profileResults.profile.nickname,
                            userId: profileResults.profile.userId,
                            accountCreated: profileResults.profile.accountCreated,
                            region: profileResults.profile.region,
                            language: profileResults.profile.language,
                            stats: profileResults.profile.stats,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  </details>
                </div>

              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="video">
          <form onSubmit={handleSubmit} className="space-y-2">
            <Label htmlFor="tiktokUrl">TikTok Video URL</Label>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              <Input
                id="tiktokUrl"
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.tiktok.com/@username/video/1234567890123456789"
                required
                className="flex-grow"
              />
              <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                {isLoading ? "Analyzing..." : "Analyze"}
              </Button>
            </div>
          </form>

          {error && searchType === "video" && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading && searchType === "video" && <VideoInfoSkeleton />}

          {videoResults && (
            <Card className="mt-4 overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FaTiktok className="mr-2 h-5 w-5" />
                  TikTok Video Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid gap-6">
                  <div>
                    <div className="flex items-center mb-4">
                      <Calendar className="inline mr-2 h-5 w-5 text-primary" />
                      <span className="font-medium text-lg">Upload Date:</span>
                      <span className="ml-2 text-lg">{formatDate(videoResults.creation_time.iso)}</span>
                    </div>

                    <div className="flex items-center">
                      <Hash className="inline mr-2 h-5 w-5 text-primary" />
                      <span className="font-medium">Video ID:</span>
                      <span className="ml-2 font-mono">{videoResults.video_id}</span>
                      <Button variant="ghost" size="sm" className="ml-2 text-primary" onClick={toggleTechnicalDetails}>
                        <Info className="h-4 w-4 mr-1" />
                        {showTechnicalDetails ? "Hide Details" : "Show Details"}
                      </Button>
                    </div>

                    {showTechnicalDetails && (
                      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                        <h3 className="text-sm font-medium mb-2">Technical Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="font-medium">Unix Timestamp:</span>
                            <span className="ml-2 font-mono">{videoResults.creation_time.unix}</span>
                          </div>
                          <div>
                            <span className="font-medium">Binary Representation:</span>
                            <div className="mt-1 font-mono text-xs break-all bg-gray-100 dark:bg-gray-900 p-2 rounded">
                              {videoResults.binary}
                            </div>
                          </div>
                        </div>
                        <div className="mt-4">
                          <details className="text-sm">
                            <summary className="cursor-pointer font-medium text-primary hover:underline">
                              View Raw Data
                            </summary>
                            <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                              <pre className="whitespace-pre-wrap break-all text-xs">
                                {JSON.stringify(videoResults, null, 2)}
                              </pre>
                            </div>
                          </details>
                        </div>
                      </div>
                    )}

                    <p className="flex items-center mt-4">
                      <ExternalLink className="inline mr-2 h-4 w-4 text-primary" />
                      <a
                        href={videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        View Video on TikTok
                      </a>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>TikTok OSINT Techniques</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row">
            <div className="lg:w-3/4 pr-6">
              <div className="lg:hidden mb-6">
                <h4 className="text-lg font-semibold mb-2">Table of Contents</h4>
                <ArticleNavigation sections={articleSections} />
              </div>
              <div className="article-content" ref={articleRef}>
                <h2 id="tiktok-api" className="text-lg font-semibold mt-6">
                  TikTok Research API
                </h2>
                <p>
                  TikTok provides a Research API that allows authorized researchers to access public data on the
                  platform. This API is designed for academic and research purposes to study trends, content, and user
                  behavior on TikTok.
                </p>
                <p className="mt-2">
                  The Research API endpoint for user information is{" "}
                  <code>https://open.tiktokapis.com/v2/research/user/info/</code>. This endpoint allows researchers to
                  retrieve public information about TikTok users, including their profile details, follower counts, and
                  content statistics.
                </p>
                <div className="mt-2 rounded-md overflow-hidden">
                  <SyntaxHighlighter
                    language="bash"
                    style={vscDarkPlus}
                    customStyle={{
                      borderRadius: "0.375rem",
                      padding: "1rem",
                      fontSize: "0.875rem",
                      lineHeight: "1.5",
                    }}
                  >
                    {researchApiCode.trim()}
                  </SyntaxHighlighter>
                </div>

                <h2 id="id-timestamp" className="text-lg font-semibold mt-8">
                  TikTok Video ID Timestamp Calculation
                </h2>
                <p>
                  TikTok assigns a unique numeric ID to each video uploaded to the platform. These IDs are visible in
                  the URL of any TikTok video, following the pattern:{" "}
                  <code>https://www.tiktok.com/@username/video/7234567890123456789</code>
                </p>

                <p className="mt-2">
                  Similar to other social media platforms, TikTok video IDs contain encoded information, including a
                  timestamp that indicates when the video was created.
                </p>

                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold mb-2 flex items-center">
                    <Clock className="mr-2 h-5 w-5 text-primary" />
                    How Timestamp Extraction Works
                  </h3>
                  <p className="mb-2">
                    TikTok uses a 64-bit integer for video IDs, with the first 32 bits containing a Unix timestamp
                    (seconds since January 1, 1970). To extract this timestamp, you need to convert the ID to binary and
                    extract the first 31 bits.
                  </p>

                  <div className="mt-4 rounded-md overflow-hidden">
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
                      {pythonTimestampCode.trim()}
                    </SyntaxHighlighter>
                  </div>
                </div>
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
