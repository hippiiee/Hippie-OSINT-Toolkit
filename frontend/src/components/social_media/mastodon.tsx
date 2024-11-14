'use client'

import { useState, useEffect } from 'react'
import { Search, User, Server, Loader2, AlertCircle, Globe, Calendar, MessageCircle, Users, Mail, Info, ExternalLink } from 'lucide-react'
import { FaMastodon } from 'react-icons/fa'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { io, Socket } from 'socket.io-client'

interface MastodonUserInfo {
  user_id: string;
  profile_url: string;
  locked: boolean;
  username: string;
  acct: string;
  display_name: string;
  created_at: string;
  bot: boolean;
  discoverable: boolean;
  followers_count: number;
  following_count: number;
  statuses_count: number;
  last_status_at: string;
  group: boolean;
  bio: string;
  fields: any[];
  avatar: string;
}

interface MastodonInstanceInfo {
  instance: string;
  title: string;
  description: string;
  detailed_description: string;
  email: string;
  thumbnail: string;
  languages: string[];
  registrations: boolean;
  approval_required: boolean;
  admin_info: {
    id: string;
    username: string;
    acct: string;
    display_name: string;
    followers_count: number;
    following_count: number;
    statuses_count: number;
    last_status_at: string;
    locked: boolean;
    bot: boolean;
    discoverable: boolean;
    group: boolean;
    created_at: string;
    url: string;
    avatar: string;
    header: string;
  };
}

interface MatchedSite {
  name: string;
  profile_url: string;
}

export default function MastodonTools() {
  const [userSearchTerm, setUserSearchTerm] = useState('')
  const [instanceSearchTerm, setInstanceSearchTerm] = useState('')
  const [searchType, setSearchType] = useState<'user' | 'instance'>('user')
  const [userInfo, setUserInfo] = useState<MastodonUserInfo | null>(null)
  const [instanceInfo, setInstanceInfo] = useState<MastodonInstanceInfo | null>(null)
  const [matchedSites, setMatchedSites] = useState<MatchedSite[]>([])
  const [isCheckingServers, setIsCheckingServers] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMatchedSites, setIsLoadingMatchedSites] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API
    const newSocket = io(`${backendUrl}/mastodon`)

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket')
    })

    newSocket.on('search_result', (data) => {
      console.log('Received data from WebSocket:', data)

      if (data.error) {
        console.log('Error:', data.error)
        setError(data.error)
        setIsCheckingServers(false)
        setIsLoadingMatchedSites(false)
      } else {
        const parsedData = JSON.parse(data.result)
        if (parsedData.instance) {
          setInstanceInfo(parsedData)
          setIsCheckingServers(false)
        } else if (parsedData.username) {
          setUserInfo(parsedData)
          setIsCheckingServers(true)
          setIsLoadingMatchedSites(true)
        } else if (parsedData.matched_sites) {
          setMatchedSites(parsedData.matched_sites)
          setIsCheckingServers(false)
          setIsLoadingMatchedSites(false)
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

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (newSocket) {
        newSocket.disconnect()
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setIsCheckingServers(false)
    setIsLoadingMatchedSites(false)

    if (searchType === 'user') {
      setUserInfo(null)
      setMatchedSites([])
    } else {
      setInstanceInfo(null)
    }

    if (socket) {
      if (searchType === 'user') {
        socket.emit('search_mastodon_username', { input: userSearchTerm })
      } else {
        socket.emit('search_mastodon_instance', { input: instanceSearchTerm })
      }
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const UserInfoSkeleton = () => (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center">
          <FaMastodon className="mr-2 h-5 w-5" />
          Mastodon User Information
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
            <h3 className="font-semibold mb-2">Bio</h3>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-5/6 mb-2" />
            <Skeleton className="h-4 w-4/5" />
          </div>
          <div className="col-span-2">
            <h3 className="font-semibold mb-2">Account Status</h3>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-28" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const InstanceInfoSkeleton = () => (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Server className="mr-2 h-5 w-5" />
          Mastodon Instance Information
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
            <h3 className="font-semibold mb-2">Instance Details</h3>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <div>
            <h3 className="font-semibold mb-2">Registration</h3>
            <Skeleton className="h-4 w-1/2 mb-2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div>
            <h3 className="font-semibold mb-2">Languages</h3>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
          <div className="col-span-2">
            <h3 className="font-semibold mb-2">Admin Information</h3>
            <div className="flex items-center space-x-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div>
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const MatchedSitesSkeleton = () => (
    <div className="col-span-2">
      <h3 className="font-semibold mb-2">Matched Sites</h3>
      <ul className="list-disc pl-5">
        <li><Skeleton className="h-4 w-40 inline-block" /></li>
        <li><Skeleton className="h-4 w-48 inline-block" /></li>
        <li><Skeleton className="h-4 w-36 inline-block" /></li>
      </ul>
    </div>
  )

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Mastodon</h1>

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
              <h3 className="font-semibold mb-2">User Information</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Basic profile details (username, display name, bio)</li>
                <li>Account statistics (followers, following, posts)</li>
                <li>Account creation date and last status update</li>
                <li>Account flags (bot, locked, discoverable, etc.)</li>
                <li>Profile fields and linked accounts</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Instance Information</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Instance name, description, and thumbnail</li>
                <li>Registration status and approval requirements</li>
                <li>Supported languages</li>
                <li>Admin information</li>
                <li>Email contact for the instance</li>
              </ul>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500">
              This tool is powered by{' '}
              <a
                href="https://github.com/C3n7ral051nt4g3ncy/Masto"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline inline-flex items-center"
              >
                Masto
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
              , created by C3n7ral051nt4g3ncy.
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="user" onValueChange={(value) => setSearchType(value as 'user' | 'instance')}>
        <TabsList>
          <TabsTrigger value="user">Search User</TabsTrigger>
          <TabsTrigger value="instance">Search Instance</TabsTrigger>
        </TabsList>
        <TabsContent value="user">
          <form onSubmit={handleSubmit} className="space-y-2">
            <Label htmlFor="userSearchTerm">Mastodon Username</Label>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              <Input
                id="userSearchTerm"
                type="text"
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                placeholder="username"
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
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading && <UserInfoSkeleton />}
          
          {userInfo && (
            
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FaMastodon className="mr-2 h-5 w-5" />
                  Mastodon User Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="col-span-2 flex items-center space-x-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={userInfo.avatar} alt={userInfo.display_name} />
                      <AvatarFallback>{userInfo.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-2xl font-semibold">{userInfo.display_name}</h3>
                      <p className="text-gray-500">@{userInfo.acct}</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Account Details</h3>
                    {userInfo.profile_url && (
                      <p>
                        <Globe className="inline mr-2 h-4 w-4" />
                        <a href={userInfo.profile_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                          {userInfo.profile_url}
                        </a>
                      </p>
                    )}
                    {userInfo.created_at && (
                      <p>
                        <Calendar className="inline mr-2 h-4 w-4" />
                        Joined: {formatDate(userInfo.created_at)}
                      </p>
                    )}
                    {userInfo.last_status_at && (
                      <p>
                        <MessageCircle className="inline mr-2 h-4 w-4" />
                        Last status: {userInfo.last_status_at}
                      </p>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Statistics</h3>
                    {userInfo.followers_count !== undefined && (
                      <p>
                        <Users className="inline mr-2 h-4 w-4" />
                        Followers: {userInfo.followers_count}
                      </p>
                    )}
                    {userInfo.following_count !== undefined && (
                      <p>
                        <Users className="inline mr-2 h-4 w-4" />
                        Following: {userInfo.following_count}
                      </p>
                    )}
                    {userInfo.statuses_count !== undefined && (
                      <p>
                        <MessageCircle className="inline mr-2 h-4 w-4" />
                        Statuses: {userInfo.statuses_count}
                      </p>
                    )}
                  </div>
                  <div className="col-span-2">
                    <h3 className="font-semibold mb-2">Bio</h3>
                    {userInfo.bio && <p>{userInfo.bio}</p>}
                  </div>
                  <div className="col-span-2">
                    <h3 className="font-semibold mb-2">Account Status</h3>
                    <div className="flex flex-wrap gap-2">
                      {userInfo.locked && <Badge>Locked</Badge>}
                      {userInfo.bot && <Badge>Bot</Badge>}
                      {userInfo.discoverable && <Badge>Discoverable</Badge>}
                      {userInfo.group && <Badge>Group</Badge>}
                    </div>
                  </div>
                  {isLoadingMatchedSites ? (
                    <MatchedSitesSkeleton />
                  ) : (
                    matchedSites.length > 0 && (
                      <div className="col-span-2">
                        <h3 className="font-semibold mb-2">Matched Sites</h3>
                        <ul className="list-disc pl-5">
                          {matchedSites.map((site, index) => (
                            <li key={index}>
                              <a href={site.profile_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                {site.name}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="instance">
          <form onSubmit={handleSubmit} className="space-y-2">
            <Label htmlFor="instanceSearchTerm">Instance Name</Label>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              <Input
                id="instanceSearchTerm"
                type="text"
                value={instanceSearchTerm}
                onChange={(e) => setInstanceSearchTerm(e.target.value)}
                placeholder="mastodon.social"
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
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading && <InstanceInfoSkeleton />}

          {instanceInfo && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Server className="mr-2 h-5 w-5" />
                  Mastodon Instance Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="col-span-2 flex items-center space-x-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={instanceInfo.thumbnail} alt={instanceInfo.title} />
                      <AvatarFallback>{instanceInfo.title.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-2xl font-semibold">{instanceInfo.title}</h3>
                      <p className="text-gray-500">{instanceInfo.instance}</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Instance Details</h3>
                    {instanceInfo.description && (
                      <p>
                        <Globe className="inline mr-2 h-4 w-4" />
                        {instanceInfo.description}
                      </p>
                    )}
                    {instanceInfo.email && (
                      <p>
                        <Mail className="inline mr-2 h-4 w-4" />
                        {instanceInfo.email}
                      </p>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Registration</h3>
                    <p>Open: {instanceInfo.registrations ? 'Yes' : 'No'}</p>
                    <p>Approval Required: {instanceInfo.approval_required ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Languages</h3>
                    <div className="flex flex-wrap gap-2">
                      {instanceInfo.languages.map((lang, index) => (
                        <Badge key={index}>{lang}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <h3 className="font-semibold mb-2">Admin Information</h3>
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={instanceInfo.admin_info.avatar} alt={instanceInfo.admin_info.display_name} />
                        <AvatarFallback>{instanceInfo.admin_info.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{instanceInfo.admin_info.display_name}</p>
                        <p className="text-sm text-gray-500">@{instanceInfo.admin_info.acct}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}