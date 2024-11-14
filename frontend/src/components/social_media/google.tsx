'use client'

import { useState, useEffect } from 'react'
import { Search, Loader2, AlertCircle, Info, User, MapPin, Calendar, Star, ExternalLink, Image } from 'lucide-react'
import { FaGoogle } from 'react-icons/fa'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { io, Socket } from 'socket.io-client'

interface GoogleResult {
  module: string;
  found?: {
    PROFILE_CONTAINER: {
      profile?: {
        personId?: string;
        emails?: {
          CONTACT?: { value: string };
          PROFILE?: { value: string };
        };
        names?: {
          CONTACT?: {
            fullname?: string;
            firstName?: string;
            lastName?: string;
          };
        };
        profilePhotos?: {
          PROFILE?: {
            url?: string;
            isDefault?: boolean;
          };
        };
        profileUrl?: string;
      };
      maps?: {
        photos?: Array<{
          id: string;
          url: string;
          location: {
            name: string;
            address: string;
          };
          date: string;
        }>;
        reviews?: Array<{
          id: string;
          comment: string;
          rating: number;
          location: {
            name: string;
            address: string;
          };
          date: string;
          url?: string;
        }>;
        stats?: {
          [key: string]: number;
        };
      };
    };
  };
  error?: string;
}

export default function GoogleTools() {
  const [email, setEmail] = useState('')
  const [result, setResult] = useState<GoogleResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API || 'http://localhost:5000'
    const newSocket = io(`${backendUrl}/google`)
    setSocket(newSocket)

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket')
    })

    newSocket.on('search_result', (data) => {
      console.log('Received data from WebSocket:', data)
      setResult(data.result)
      setIsLoading(false)
    })

    return () => {
      newSocket.disconnect()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setResult(null)
    setSelectedImage(null)

    if (socket) {
      socket.emit('search_google', { input: email })
    }
  }

  const ImageModal = ({ url, onClose }: { url: string; onClose: () => void }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="max-w-4xl max-h-[90vh] p-4">
        <img src={url} alt="Full size" className="max-w-full max-h-[80vh] object-contain rounded-lg" />
        <Button 
          variant="secondary" 
          className="mt-4 absolute top-4 right-4"
          onClick={onClose}
        >
          Close
        </Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 w-full">
      <h1 className="text-3xl font-bold">Google</h1>

      {selectedImage && (
        <ImageModal url={selectedImage} onClose={() => setSelectedImage(null)} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Info className="mr-2 h-5 w-5" />
            What data can be found?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-2">This tool searches for information associated with a Google account:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Profile information (name, email, profile picture)</li>
            <li>Google Maps activity (photos, reviews, statistics)</li>
            <li>Other associated Google services data</li>
          </ul>
          <p className="mt-4 text-sm text-gray-500">
            This tool is powered by{' '}
            <a
              href="https://github.com/mxrch/GHunt"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline inline-flex items-center"
            >
              GHunt
              <ExternalLink className="ml-1 h-3 w-3" />
            </a>
            , created by mxrch.
          </p>
        </CardContent>
      </Card>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Google Account Email</Label>
              <div className="flex space-x-2">
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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

      {isLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FaGoogle className="mr-2 h-5 w-5" />
              Google User Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FaGoogle className="mr-2 h-5 w-5" />
              Google User Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{result.error}</AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-6">
                {result.found?.PROFILE_CONTAINER?.profile && (
                  <div className="flex items-center space-x-4">
                    <div className="relative group cursor-pointer">
                      <Avatar 
                        className="h-20 w-20"
                        onClick={() => result.found?.PROFILE_CONTAINER?.profile?.profilePhotos?.PROFILE?.url && 
                          setSelectedImage(result.found.PROFILE_CONTAINER.profile.profilePhotos.PROFILE.url)}
                      >
                        <AvatarImage src={result.found.PROFILE_CONTAINER.profile.profilePhotos?.PROFILE?.url} />
                        <AvatarFallback><User className="h-10 w-10" /></AvatarFallback>
                      </Avatar>
                      {result.found.PROFILE_CONTAINER.profile.profilePhotos?.PROFILE?.url && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <Image className="h-6 w-6 text-white" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">
                        {result.found.PROFILE_CONTAINER.profile.names?.CONTACT?.fullname || 'N/A'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {result.found.PROFILE_CONTAINER.profile.emails?.PROFILE?.value || 'N/A'}
                      </p>
                      {result.found.PROFILE_CONTAINER.profile.personId && (
                        <p className="text-sm text-muted-foreground">
                          ID: {result.found.PROFILE_CONTAINER.profile.personId}
                        </p>
                      )}
                      {result.found.PROFILE_CONTAINER.profile.profileUrl && (
                        <a
                          href={result.found.PROFILE_CONTAINER.profile.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline inline-flex items-center mt-2"
                        >
                          View Profile
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {result.found?.PROFILE_CONTAINER?.maps && (
                  <div>
                    <h4 className="font-semibold mb-2">Google Maps Activity</h4>
                    <div className="space-y-4">
                      {result.found.PROFILE_CONTAINER.maps.photos && result.found.PROFILE_CONTAINER.maps.photos.length > 0 && (
                        <div>
                          <h5 className="font-medium mb-2">Photos</h5>
                          <ScrollArea className="h-[200px]">
                            {result.found.PROFILE_CONTAINER.maps.photos.map((photo) => (
                              <div key={photo.id} className="mb-4">
                                <div 
                                  className="relative group cursor-pointer"
                                  onClick={() => setSelectedImage(photo.url)}
                                >
                                  <img 
                                    src={photo.url} 
                                    alt="User photo" 
                                    className="w-full h-40 object-cover rounded-md" 
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Image className="h-6 w-6 text-white" />
                                  </div>
                                </div>
                                <p className="text-sm mt-1">{photo.location.name}</p>
                                <p className="text-xs text-muted-foreground">{photo.date}</p>
                              </div>
                            ))}
                          </ScrollArea>
                        </div>
                      )}

                      {result.found.PROFILE_CONTAINER.maps.reviews && result.found.PROFILE_CONTAINER.maps.reviews.length > 0 && (
                        <div>
                          <h5 className="font-medium mb-2">Reviews</h5>
                          <ScrollArea className="h-[200px]">
                            {result.found.PROFILE_CONTAINER.maps.reviews.map((review) => (
                              <Card key={review.id} className="mb-4">
                                <CardContent className="pt-4">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <h6 className="font-semibold">{review.location.name}</h6>
                                      <p className="text-sm text-muted-foreground">{review.location.address}</p>
                                    </div>
                                    <Badge variant="outline">
                                      <Star className="h-4 w-4 mr-1" />
                                      {review.rating}
                                    </Badge>
                                  </div>
                                  <p className="text-sm mt-2">{review.comment}</p>
                                  <p className="text-xs text-muted-foreground mt-2">{review.date}</p>
                                  {review.url && (
                                    <a
                                      href={review.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-500 hover:underline inline-flex items-center mt-2"
                                    >
                                      View Review
                                      <ExternalLink className="ml-1 h-3 w-3" />
                                    </a>
                                  )}
                                </CardContent>
                              </Card>
                            ))}
                          </ScrollArea>
                        </div>
                      )}

                      {result.found.PROFILE_CONTAINER.maps.stats && Object.keys(result.found.PROFILE_CONTAINER.maps.stats).length > 0 && (
                        <div>
                          <h5 className="font-medium mb-2">Activity Statistics</h5>
                          <div className="grid grid-cols-2 gap-4">
                            {Object.entries(result.found.PROFILE_CONTAINER.maps.stats).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="text-sm">{key}:</span>
                                <span className="text-sm font-semibold">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(!result.found?.PROFILE_CONTAINER?.maps || 
                  ((!result.found.PROFILE_CONTAINER.maps.photos || result.found.PROFILE_CONTAINER.maps.photos.length === 0) &&
                   (!result.found.PROFILE_CONTAINER.maps.reviews || result.found.PROFILE_CONTAINER.maps.reviews.length === 0) &&
                   (!result.found.PROFILE_CONTAINER.maps.stats || Object.keys(result.found.PROFILE_CONTAINER.maps.stats).length === 0))) && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>No Maps Data</AlertTitle>
                    <AlertDescription>No Google Maps activity data was found for this user.</AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}