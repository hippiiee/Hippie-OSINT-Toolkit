'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Search,
  Loader2,
  AlertCircle,
  Info,
  Globe,
  ExternalLink,
  Clock,
  Link2,
  Archive,
  FileText,
  Link as LinkIcon,
} from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { io, Socket } from 'socket.io-client'

interface Snapshot {
  timestamp: string
  date: string
  original_url: string
  status_code: string
  mimetype: string
  length: string
  archive_url: string
}

interface WaybackResults {
  total_snapshots: number
  unique_url_count: number
  unique_urls: string[]
  first_snapshot: string
  last_snapshot: string
  snapshots: Snapshot[]
}

interface SearchResult {
  module: string
  results: WaybackResults
}

interface ProgressData {
  module: string
  progress: number
  message: string
}

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
          className={`block py-2 px-3 text-sm rounded transition-colors ${
            section.level === 1 ? 'font-semibold' : 'ml-4'
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
      className={`block bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden my-4 ${isSingle ? 'w-full md:w-1/2' : 'w-full'}`}
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

export default function WaybackTools() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<WaybackResults | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const articleRef = useRef<HTMLDivElement>(null)

  const articleSections: ArticleSection[] = [
    { id: 'how-wayback-works', title: 'How the Wayback Machine Works', level: 1 },
    { id: 'osint-use-cases', title: 'OSINT Use Cases', level: 1 },
    { id: 'advanced-techniques', title: 'Advanced Techniques', level: 1 },
    { id: 'limitations', title: 'Limitations and Considerations', level: 1 },
    { id: 'osint-tools', title: 'OSINT Tools for Web Archiving', level: 1 },
  ]

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API || 'http://localhost:5000'
    const newSocket = io(`${backendUrl}/wayback`)
    setSocket(newSocket)

    newSocket.on('connect', () => {
      console.log('Connected to Wayback WebSocket')
    })

    newSocket.on('search_result', (data: { error?: string; result?: SearchResult }) => {
      if (data.error) {
        setError(data.error)
        setResults(null)
      } else if (data.result && data.result.module === 'wayback') {
        setResults(data.result.results)
        setError(null)
      }
      setIsLoading(false)
      setProgress(null)
    })

    newSocket.on('search_progress', (data: ProgressData) => {
      setProgress(data)
    })

    return () => {
      newSocket.disconnect()
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsLoading(true)
    setResults(null)
    setError(null)
    setHasSearched(true)
    setProgress(null)

    if (socket) {
      socket.emit('search_wayback', { input: query.trim() })
    }
  }

  const ResultsSkeleton = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-8 w-5/6" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-8 w-4/5" />
      </div>
    </div>
  )

  return (
    <div className="space-y-6 w-full">
      <h1 className="text-3xl font-bold">Wayback Machine</h1>

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
              <h3 className="font-semibold mb-2">Archived Snapshots</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Historical snapshots of web pages</li>
                <li>Timestamps of when pages were archived</li>
                <li>Direct links to view archived versions</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Historical Intelligence</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Deleted or removed content</li>
                <li>Website changes over time</li>
                <li>Historical robots.txt and sitemaps</li>
                <li>Previously exposed pages and endpoints</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-2">
        <Label htmlFor="wayback-query">Domain or URL</Label>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <Input
            id="wayback-query"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="example.com"
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

      {isLoading && progress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{progress.message}</span>
            <span>{progress.progress}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {hasSearched && isLoading && !progress && <ResultsSkeleton />}

      {results && (
        <div className="space-y-4">
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Archive className="mr-2 h-5 w-5" />
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col items-center p-4 rounded-lg bg-secondary/50">
                  <Globe className="h-6 w-6 mb-2 text-primary" />
                  <span className="text-2xl font-bold">{results.total_snapshots}</span>
                  <span className="text-sm text-muted-foreground">Total Snapshots</span>
                </div>
                <div className="flex flex-col items-center p-4 rounded-lg bg-secondary/50">
                  <Link2 className="h-6 w-6 mb-2 text-primary" />
                  <span className="text-2xl font-bold">{results.unique_url_count}</span>
                  <span className="text-sm text-muted-foreground">Unique URLs</span>
                </div>
                <div className="flex flex-col items-center p-4 rounded-lg bg-secondary/50">
                  <Clock className="h-6 w-6 mb-2 text-primary" />
                  <div className="text-center">
                    <span className="text-sm font-semibold">{results.first_snapshot}</span>
                    <span className="text-xs text-muted-foreground block">to</span>
                    <span className="text-sm font-semibold">{results.last_snapshot}</span>
                  </div>
                  <span className="text-sm text-muted-foreground mt-1">Date Range</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs: Snapshots & Unique URLs */}
          <Tabs defaultValue="snapshots" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="snapshots" className="flex items-center flex-1">
                <FileText className="mr-2 h-4 w-4" />
                Snapshots ({results.snapshots.length})
              </TabsTrigger>
              <TabsTrigger value="urls" className="flex items-center flex-1">
                <Link2 className="mr-2 h-4 w-4" />
                Unique URLs ({results.unique_url_count})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="snapshots">
              <Card>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    <div className="min-w-full">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-background border-b">
                          <tr>
                            <th className="text-left p-3 font-semibold">Date</th>
                            <th className="text-left p-3 font-semibold">URL</th>
                            <th className="text-left p-3 font-semibold">Status</th>
                            <th className="text-left p-3 font-semibold">MIME Type</th>
                            <th className="text-center p-3 font-semibold">Archive</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.snapshots.map((snapshot, index) => (
                            <tr
                              key={`${snapshot.timestamp}-${index}`}
                              className="border-b hover:bg-muted/50 transition-colors"
                            >
                              <td className="p-3 whitespace-nowrap text-muted-foreground">
                                {snapshot.date}
                              </td>
                              <td className="p-3 max-w-md truncate" title={snapshot.original_url}>
                                {snapshot.original_url}
                              </td>
                              <td className="p-3">
                                <Badge variant="secondary">{snapshot.status_code}</Badge>
                              </td>
                              <td className="p-3 text-muted-foreground">
                                {snapshot.mimetype}
                              </td>
                              <td className="p-3 text-center">
                                <a
                                  href={snapshot.archive_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center text-blue-600 hover:text-blue-800"
                                  title="View on Wayback Machine"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="urls">
              <Card>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    <ul className="divide-y">
                      {results.unique_urls.map((url, index) => (
                        <li
                          key={index}
                          className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                        >
                          <span className="text-sm truncate mr-4" title={url}>
                            {url}
                          </span>
                          <a
                            href={`https://web.archive.org/web/*/${url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 text-blue-600 hover:text-blue-800"
                            title="View all snapshots for this URL"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Web Archiving and Historical OSINT</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row">
            <div className="lg:w-3/4 pr-6">
              <div className="lg:hidden mb-6">
                <h4 className="text-lg font-semibold mb-2">Table of Contents</h4>
                <ArticleNavigation sections={articleSections} />
              </div>
              <div className="article-content" ref={articleRef}>
                <h2 id="how-wayback-works" className="text-lg font-semibold mt-6">How the Wayback Machine Works</h2>
                <p>
                  The Internet Archive&#39;s Wayback Machine is the largest web archive in existence, powered by its custom web crawler called Heritrix that continuously crawls the web and stores snapshots of pages over time.
                </p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li>Each snapshot captures the full page: HTML, CSS, JavaScript, and images</li>
                  <li>The CDX API allows programmatic access to the index of all snapshots, enabling automated queries for archived URLs</li>
                  <li>Content-addressed storage ensures each unique version is stored only once, identified by a digest/hash</li>
                  <li>Anyone can also manually save pages using the &quot;Save Page Now&quot; feature at <code>web.archive.org/save</code></li>
                </ul>

                <h2 id="osint-use-cases" className="text-lg font-semibold mt-8">OSINT Use Cases</h2>
                <p>
                  Here are some use cases for web archives in OSINT:
                </p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li><strong>Recovering deleted content</strong>: websites, social media profiles, blog posts that were taken down</li>
                  <li><strong>Tracking website evolution</strong>: how a company&#39;s &quot;About&quot; page changed over time, leadership changes, removed team members</li>
                  <li><strong>Finding old contact information</strong>: emails, phone numbers, addresses that were later removed</li>
                  <li><strong>Discovering hidden infrastructure</strong>: old subdomains, API endpoints, admin panels referenced in archived pages</li>
                  <li><strong>Legal evidence</strong>: archived snapshots can serve as evidence of what was published at a specific date</li>
                </ul>

                <h2 id="advanced-techniques" className="text-lg font-semibold mt-8">Advanced Techniques</h2>
                <p>
                  Beyond simple lookups, there are several advanced techniques that can extract deeper intelligence from web archives:
                </p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li><strong>robots.txt history</strong>: query <code>example.com/robots.txt</code> , reveals what paths the site tried to hide from crawlers over time. Disallowed paths are often the most interesting.</li>
                  <li><strong>JavaScript and API endpoint discovery</strong>: archived JS files often contain hardcoded API URLs, keys, or internal endpoints</li>
                  <li><strong>Diff analysis</strong>: compare consecutive snapshots (using the digest field) to see exactly what changed and when</li>
                  <li><strong>Subdomain discovery</strong>: using <code>matchType=domain</code> reveals URLs across all subdomains ever archived</li>
                  <li><strong>Sitemap.xml history</strong>: old sitemaps list pages that may have been deleted since</li>
                </ul>

                <h2 id="limitations" className="text-lg font-semibold mt-8">Limitations and Considerations</h2>
                <p>
                  Some limitations to keep in mind:
                </p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li>robots.txt can retroactively hide content , site owners can request removal of previously archived pages</li>
                  <li>Not all pages are archived , dynamic or authenticated content is often missed entirely</li>
                  <li>Archive timing is inconsistent , important changes might fall between snapshots</li>
                  <li>Some sites actively block the Wayback Machine crawler</li>
                </ul>

                <h2 id="osint-tools" className="text-lg font-semibold mt-8">OSINT Tools for Web Archiving</h2>
                <p>
                  Here are some useful tools for web archiving investigations:
                </p>
                <OsintToolsGrid
                  tools={[
                    {
                      name: "Wayback Machine",
                      url: "https://web.archive.org/",
                      description: "Access archived versions of websites since 1996",
                      icon: "https://web.archive.org/_static/images/archive.ico"
                    },
                    {
                      name: "Wayback Machine Downloader",
                      url: "https://github.com/hartator/wayback-machine-downloader",
                      description: "Download entire archived websites locally",
                      icon: "https://github.com/hartator.png"
                    },
                    {
                      name: "Archive.today",
                      url: "https://archive.today/",
                      description: "Alternative web archive with on-demand snapshots",
                      icon: "https://archive.today/favicon.ico"
                    },
                    {
                      name: "CachedView",
                      url: "https://cachedview.nl/",
                      description: "Search Google, Bing, and Archive.org caches simultaneously",
                      icon: "https://cachedview.nl/favicon.ico"
                    }
                  ]}
                />

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
