'use client'

import { useState, useEffect } from 'react'
import { Search, Loader2, AlertCircle, Info, Globe, ExternalLink, User } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { io, Socket } from 'socket.io-client'

interface SearchResult {
  module: string;
  type: string;
  data: {
    site_name: string;
    uri_check: string;
    extracted_info?: Record<string, string | number | boolean>;
    progress?: {
      current: number;
      total: number;
    };
  };
}

export default function UsernameSearch() {
  const [username, setUsername] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [totalSites, setTotalSites] = useState(0)
  const [currentSite, setCurrentSite] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API || 'http://localhost:5000'
    const newSocket = io(`${backendUrl}/username`)

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket')
    })

    newSocket.on('search_result', (data) => {
      console.log('Received data from WebSocket:', data)

      if (data.result.status === 'start') {
        setTotalSites(data.result.data.total_sites)
        setCurrentSite(0)
        setResults([])
        setProgress(0)
      } else if (data.result.type === 'complete') {
        setIsLoading(false)
        setProgress(100)
      } else if (data.result.type === 'site_found') {
        setResults(prev => [...prev, data.result])
        if (data.result.data.progress) {
          setCurrentSite(data.result.data.progress.current)
          setProgress((data.result.data.progress.current / data.result.data.progress.total) * 100)
        }
      }
    })

    return () => {
      newSocket.disconnect()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setResults([])
    setError(null)
    setProgress(0)
    setCurrentSite(0)

    if (socket) {
      socket.emit('search_username', { input: username })
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
      <h1 className="text-3xl font-bold">Username</h1>

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
              This tool is powered by{' '}
              <a
                href="https://github.com/WebBreacher/WhatsMyName"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline inline-flex items-center"
              >
                WhatsMyName
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
              {' '}, created by WebBreacher and{' '}
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="flex space-x-2">
                <Input
                  id="username"
                  placeholder="Enter a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
                <Button type="submit" disabled={isLoading}>
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
            <CardTitle>Searching...</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2">Checked {currentSite} out of {totalSites} sites</p>
            <Progress value={progress} className="w-full h-2" />
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {results.map((result, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={getFaviconUrl(result.data.uri_check) || ''} alt={result.data.site_name} />
                          <AvatarFallback><Globe className="h-6 w-6" /></AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-1">
                          <h3 className="text-lg font-semibold">{result.data.site_name}</h3>
                          <a 
                            href={result.data.uri_check} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-blue-500 hover:underline flex items-center"
                          >
                            View Profile
                            <ExternalLink className="ml-1 h-4 w-4" />
                          </a>
                        </div>
                      </div>
                      {result.data.extracted_info && (
                        <div className="mt-4">
                          <h4 className="font-semibold mb-2">Additional Information:</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(result.data.extracted_info).map(([key, value]) => (
                              <div key={key} className="flex items-start space-x-2">
                                <span className="font-medium">{key}:</span>
                                <span className="text-medium">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
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
