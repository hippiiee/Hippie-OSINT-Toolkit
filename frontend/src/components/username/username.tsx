"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Search, Loader2, AlertCircle, Info, Globe, ExternalLink, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { io, type Socket } from "socket.io-client"

interface SearchResult {
  module: string
  type: string
  data: {
    site_name: string
    uri_check: string
    uri_pretty?: string
    extracted_info?: Record<string, string | number | boolean>
    progress?: {
      current: number
      total: number
    }
  }
}

interface StartData {
  module: string
  status: string
  data: {
    total_sites: number
  }
}

interface CompleteData {
  result: {
    module: string
    type: string
    data: {
      total_found: number
      total_sites: number
      found_sites: Array<{
        site: string
        url: string
      }>
      message: string
    }
  }
}

export default function UsernameSearch() {
  const [username, setUsername] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [totalSites, setTotalSites] = useState(0)
  const [currentSite, setCurrentSite] = useState(0)
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState("")
  const [searchComplete, setSearchComplete] = useState(false)
  const [totalFound, setTotalFound] = useState(0)

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:5000"
    const newSocket = io(`${backendUrl}/username`)
    setSocket(newSocket)

    newSocket.on("connect", () => {
      console.log("Connected to WebSocket")
    })

    newSocket.on("search_result", (data) => {
      console.log("Received search_result:", data)

      // Handle start message
      if (data.status === "start") {
        setTotalSites(data.data.total_sites)
        setCurrentSite(0)
        setResults([])
        setProgress(0)
        setSearchComplete(false)
      }
      // Handle site found message
      else if (data.type === "site_found") {
        setResults((prev) => [...prev, data])
        if (data.data?.progress) {
          setCurrentSite(data.data.progress.current)
          setProgress((data.data.progress.current / data.data.progress.total) * 100)
        }
      }
      // Handle complete message
      else if (data.type === "complete") {
        setIsLoading(false)
        setProgress(100)
        setSearchComplete(true)
        setTotalFound(data.data.total_found)
      }
      // Handle cancelled message
      else if (data.status === "cancelled") {
        setIsLoading(false)
        setProgressMessage("Search was cancelled")
      }
    })

    newSocket.on("search_progress", (data) => {
      console.log("Received search_progress:", data)
      if (data.module === "whatsmyname") {
        setProgressMessage(data.message)
        setProgress(data.progress)
      }
    })

    newSocket.on("error", (error) => {
      console.error("WebSocket error:", error)
      setError("An error occurred while connecting to the server.")
      setIsLoading(false)
    })

    return () => {
      console.log("Component unmounting, cancelling search...")
      newSocket.emit("cancel_search_username")
      newSocket.disconnect()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) {
      setError("Please enter a username.")
      return
    }
    setIsLoading(true)
    setResults([])
    setError(null)
    setProgress(0)
    setCurrentSite(0)
    setSearchComplete(false)
    setTotalFound(0)

    if (socket) {
      socket.emit("search_username", { input: username })
    } else {
      setError("Unable to connect to the server. Please try again later.")
      setIsLoading(false)
    }
  }

  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
    } catch {
      return null
    }
  }

  return (
    <div className="space-y-6 w-full">
      <h1 className="text-3xl font-bold">Username Search</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Info className="mr-2 h-5 w-5" />
            What data can be found?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-2">This tool searches for a given username across various platforms and can provide:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Confirmation of username existence on different sites</li>
            <li>Profile URLs for found usernames</li>
            <li>Additional extracted information when available (e.g., user ID, full name, bio)</li>
          </ul>
          <div className="mt-4">
            <p className="text-sm text-gray-500">
              This tool is powered by{" "}
              <a
                href="https://github.com/WebBreacher/WhatsMyName"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline inline-flex items-center"
              >
                WhatsMyName
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>{" "}
              , created by WebBreacher and{" "}
              <a
                href="https://github.com/soxoj/socid-extractor"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline inline-flex items-center"
              >
                socid-extractor
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
              , created by soxoj.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <Input
                  id="username"
                  placeholder="Enter a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="flex-grow"
                />
                <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Search
                    </>
                  )}
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
        <Card>
          <CardHeader>
            <CardTitle>Searching for "{username}"</CardTitle>
            <CardDescription>{progressMessage || `Checked ${currentSite} out of ${totalSites} sites`}</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={progress} className="w-full h-2" />
            <p className="mt-2 text-sm text-gray-500">Found {results.length} profiles so far</p>
          </CardContent>
        </Card>
      )}

      {searchComplete && (
        <Alert variant="default" className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-900">
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertTitle>Search Complete</AlertTitle>
          <AlertDescription>
            Found {totalFound} profiles for username "{username}" across {totalSites} sites.
          </AlertDescription>
        </Alert>
      )}

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Found Profiles ({results.length})</CardTitle>
            <CardDescription>Profiles found for username "{username}"</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {results.map((result, index) => (
                  <Card key={index} className="overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 p-4 border-b">
                      <div className="flex items-center space-x-4">
                        <Avatar className="h-12 w-12 border border-gray-200 dark:border-gray-700">
                          <AvatarImage
                            src={getFaviconUrl(result.data.uri_pretty || result.data.uri_check) || ""}
                            alt={result.data.site_name}
                          />
                          <AvatarFallback>
                            <Globe className="h-6 w-6 text-gray-400" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold">{result.data.site_name}</h3>
                          <a
                            href={result.data.uri_pretty || result.data.uri_check}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center text-sm"
                          >
                            {result.data.uri_pretty || result.data.uri_check}
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(result.data.uri_pretty || result.data.uri_check, "_blank")}
                        >
                          Visit
                        </Button>
                      </div>
                    </div>

                    {result.data.extracted_info && Object.keys(result.data.extracted_info).length > 0 && (
                      <div className="p-4">
                        <h4 className="font-medium text-sm text-gray-500 mb-2">Additional Information</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {Object.entries(result.data.extracted_info).map(([key, value]) => (
                            <div key={key} className="flex items-start">
                              <Badge variant="outline" className="mr-2 whitespace-nowrap">
                                {key}
                              </Badge>
                              <span className="text-sm break-all">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
