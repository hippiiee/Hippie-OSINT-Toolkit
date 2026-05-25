import { Globe, ExternalLink, Clock, Link2, Archive, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function WaybackResult({ data }: { data: any }) {
  const results = data.results

  if (!results || results.total_snapshots === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No archived snapshots found for this domain.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
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
                <span className="text-sm font-semibold">{results.first_snapshot?.formatted_date || results.first_snapshot}</span>
                <span className="text-xs text-muted-foreground block">to</span>
                <span className="text-sm font-semibold">{results.last_snapshot?.formatted_date || results.last_snapshot}</span>
              </div>
              <span className="text-sm text-muted-foreground mt-1">Date Range</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="snapshots" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="snapshots" className="flex items-center flex-1">
            <FileText className="mr-2 h-4 w-4" />
            Snapshots ({results.snapshots?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="urls" className="flex items-center flex-1">
            <Link2 className="mr-2 h-4 w-4" />
            Unique URLs ({results.unique_url_count || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="snapshots">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
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
                    {results.snapshots?.map((snapshot: any, index: number) => (
                      <tr
                        key={`${snapshot.timestamp}-${index}`}
                        className="border-b hover:bg-muted/50 transition-colors"
                      >
                        <td className="p-3 whitespace-nowrap text-muted-foreground">
                          {snapshot.formatted_date || snapshot.date}
                        </td>
                        <td className="p-3 max-w-md truncate" title={snapshot.url || snapshot.original_url}>
                          {snapshot.url || snapshot.original_url}
                        </td>
                        <td className="p-3">
                          <Badge variant="secondary">{snapshot.status_code}</Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {snapshot.mime_type || snapshot.mimetype}
                        </td>
                        <td className="p-3 text-center">
                          <a
                            href={snapshot.archive_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-blue-600 hover:text-blue-800"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="urls">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <ul className="divide-y">
                  {results.unique_urls?.map((url: string, index: number) => (
                    <li
                      key={index}
                      className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-sm truncate mr-4" title={url}>{url}</span>
                      <a
                        href={`https://web.archive.org/web/*/${url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-blue-600 hover:text-blue-800"
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
  )
}
