'use client'

import { useState, useEffect } from 'react'
import { Search, Calendar, Loader2, AlertCircle, Info, ExternalLink, Clock } from 'lucide-react'
import { FaTiktok } from 'react-icons/fa'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { io, Socket } from 'socket.io-client'

interface TikTokVideoInfo {
  url: string;
  publicationDate: string;
}

interface TikTokInfo {
  tiktok: TikTokVideoInfo | null;
}

export default function TikTokTools() {
  const [url, setUrl] = useState('')
  const [results, setResults] = useState<TikTokInfo>({ tiktok: null })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API
    const newSocket = io(`${backendUrl}/tiktok`)

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket')
    })

    newSocket.on('search_result', (data) => {
      console.log('Received data from WebSocket:', data)

      if (data.error) {
        setError(data.error)
        setResults({ tiktok: null })
      } else {
        setResults({ tiktok: data.result })
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
    setResults({ tiktok: null })
    setError(null)

    if (socket) {
      socket.emit('search_tiktok', { input: url })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

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
          <ul className="list-disc pl-5 space-y-1">
            <li>Exact date and time of video upload</li>
          </ul>
          <p className="mt-4 text-sm text-gray-500">
            This tool is powered by{' '}
            <a
              href="https://github.com/hippiiee/tiktok-url-timestamp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline inline-flex items-center"
            >
              tiktok-url-timestamp
              <ExternalLink className="ml-1 h-3 w-3" />
            </a>
            , created by hippiiee.
          </p>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-2">
        <Label htmlFor="tiktokUrl">TikTok Video URL</Label>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <Input
            id="tiktokUrl"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.tiktok.com/@username/video/1234567890123456789"
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
      
      {(isLoading || results.tiktok) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FaTiktok className="mr-2 h-5 w-5" />
              TikTok Video Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6">
              <div>
                {isLoading ? (
                  <>
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-3/4" />
                  </>
                ) : results.tiktok && (
                  <>
                    <p className="flex items-center">
                      <Clock className="inline mr-2 h-4 w-4" />
                      <span className="font-medium">Upload Date: </span> {formatDate(results.tiktok.publicationDate)}
                    </p>
                    <p className="flex items-center mt-2">
                      <ExternalLink className="inline mr-2 h-4 w-4" />
                      <a href={results.tiktok.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                        View Video on TikTok
                      </a>
                    </p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}