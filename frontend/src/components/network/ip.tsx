'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Loader2, AlertCircle, Info, Globe, Shield, Server, Tag, ExternalLink, Link as LinkIcon } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { io, Socket } from 'socket.io-client'

interface IpResult {
  ip: string;
  found: boolean;
  ports: number[];
  hostnames: string[];
  cpes: string[];
  vulns: string[];
  tags: string[];
}

function parseCpe(cpe: string): string {
  // Parse CPE format: "cpe:/a:vendor:product:version" or "cpe:2.3:a:vendor:product:version:..."
  try {
    let parts: string[];
    if (cpe.startsWith('cpe:2.3:')) {
      parts = cpe.replace('cpe:2.3:', '').split(':');
      // parts[0] = type (a/o/h), parts[1] = vendor, parts[2] = product, parts[3] = version
      parts = parts.slice(1);
    } else if (cpe.startsWith('cpe:/')) {
      parts = cpe.replace('cpe:/', '').split(':');
      // parts[0] = type+vendor (e.g., "a:apache" becomes ["a", "apache"] after first split was on /)
      // Actually format is cpe:/type:vendor:product:version
      const withoutType = parts.slice(0);
      // Remove the single-letter type prefix from first element
      if (withoutType[0] && withoutType[0].length <= 2) {
        withoutType.shift();
      }
      parts = withoutType;
    } else {
      return cpe;
    }

    const vendor = parts[0] ? parts[0].replace(/_/g, ' ') : '';
    const product = parts[1] ? parts[1].replace(/_/g, ' ') : '';
    const version = parts[2] && parts[2] !== '*' && parts[2] !== '-' ? parts[2] : '';

    const name = [vendor, product].filter(Boolean).map(
      s => s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    ).join(' ');

    return version ? `${name} ${version}` : name;
  } catch {
    return cpe;
  }
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

export default function IpTools() {
  const [ipAddress, setIpAddress] = useState('')
  const [results, setResults] = useState<IpResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [progress, setProgress] = useState<string>('')
  const articleRef = useRef<HTMLDivElement>(null)

  const articleSections: ArticleSection[] = [
    { id: 'understanding-ip-intelligence', title: 'Understanding IP Intelligence', level: 1 },
    { id: 'what-open-ports-tell-you', title: 'What Open Ports Tell You', level: 2 },
    { id: 'cpe-common-platform-enumeration', title: 'CPE: Common Platform Enumeration', level: 2 },
    { id: 'cve-known-vulnerabilities', title: 'CVE: Known Vulnerabilities', level: 2 },
    { id: 'beyond-shodan-internetdb', title: 'Beyond Shodan InternetDB', level: 2 },
    { id: 'osint-tools-ip', title: 'OSINT Tools for IP Intelligence', level: 1 },
  ]

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API || 'http://localhost:5000'
    const newSocket = io(`${backendUrl}/ip`)
    setSocket(newSocket)

    newSocket.on('connect', () => {
      console.log('Connected to IP WebSocket')
    })

    newSocket.on('search_result', (data) => {
      console.log('Received IP data from WebSocket:', data)

      if (data.error) {
        setError(data.error)
        setResults(null)
      } else if (data.result) {
        const parsedData = data.result;
        if (parsedData.module === 'ip') {
          setResults(parsedData.results as IpResult)
          setError(null)
        }
      }
      setIsLoading(false)
    })

    newSocket.on('search_progress', (data) => {
      if (data.module === 'ip') {
        setProgress(data.message)
      }
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
    setProgress('')

    if (socket) {
      socket.emit('search_ip', { input: ipAddress })
    }
  }

  const IpResultSkeleton = () => (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-6 w-48 mb-3" />
        <Skeleton className="h-4 w-64 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Separator />
      <div>
        <Skeleton className="h-6 w-32 mb-3" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>
      <Separator />
      <div>
        <Skeleton className="h-6 w-40 mb-3" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <Separator />
      <div>
        <Skeleton className="h-6 w-44 mb-3" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-32" />
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">IP Intelligence</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Info className="mr-2 h-5 w-5" />
            What data can be found?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 space-y-1">
            <li>Open ports discovered on the IP address</li>
            <li>Hostnames associated with the IP</li>
            <li>Software and services running (CPEs)</li>
            <li>Known vulnerabilities (CVEs)</li>
            <li>Tags and classifications</li>
          </ul>
          <p className="mt-4 text-sm text-gray-500">
            This tool is powered by{' '}
            <a
              href="https://internetdb.shodan.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline inline-flex items-center"
            >
              Shodan InternetDB
              <ExternalLink className="ml-1 h-3 w-3" />
            </a>
            , a free API providing intelligence on internet-facing IPs.
          </p>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-2">
        <Label htmlFor="ip-address">IP Address</Label>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <Input
            id="ip-address"
            type="text"
            value={ipAddress}
            onChange={(e) => setIpAddress(e.target.value)}
            placeholder="8.8.8.8"
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

      {isLoading && progress && (
        <p className="text-sm text-gray-500">{progress}</p>
      )}

      {(isLoading || results) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Globe className="mr-2 h-5 w-5" />
              IP Intelligence Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <IpResultSkeleton />
            ) : results && !results.found ? (
              <div className="text-center py-8">
                <Info className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-lg text-gray-500">No information available for this IP</p>
                <p className="text-sm text-gray-400 mt-1">Shodan InternetDB has no records for {results.ip}</p>
              </div>
            ) : results ? (
              <ScrollArea className="max-h-[600px]">
                <div className="space-y-6">
                  {/* IP and Hostnames */}
                  <div>
                    <h3 className="text-xl font-semibold mb-2 flex items-center">
                      <Server className="mr-2 h-5 w-5" />
                      Host Information
                    </h3>
                    <p>
                      <span className="font-medium">IP Address:</span> {results.ip}
                      {' '}
                      <a
                        href={`https://www.shodan.io/host/${results.ip}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        View on Shodan <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </p>
                    {results.hostnames.length > 0 && (
                      <div className="mt-2">
                        <span className="font-medium">Hostnames:</span>
                        <ul className="list-disc pl-5 mt-1 space-y-1">
                          {results.hostnames.map((hostname, index) => (
                            <li key={index} className="text-sm">{hostname}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Open Ports */}
                  <div>
                    <h3 className="text-xl font-semibold mb-2 flex items-center">
                      <Globe className="mr-2 h-5 w-5" />
                      Open Ports
                    </h3>
                    {results.ports.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {results.ports.map((port, index) => (
                          <Badge key={index} variant="secondary">
                            {port}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No open ports detected</p>
                    )}
                  </div>

                  <Separator />

                  {/* Software / CPEs */}
                  <div>
                    <h3 className="text-xl font-semibold mb-2 flex items-center">
                      <Server className="mr-2 h-5 w-5" />
                      Software / CPEs
                    </h3>
                    {results.cpes.length > 0 ? (
                      <div className="space-y-2">
                        {results.cpes.map((cpe, index) => (
                          <div key={index} className="flex flex-col sm:flex-row sm:items-center gap-1">
                            <Badge variant="outline">{parseCpe(cpe)}</Badge>
                            <span className="text-xs text-gray-400 break-all">{cpe}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No software information available</p>
                    )}
                  </div>

                  <Separator />

                  {/* Vulnerabilities */}
                  <div>
                    <h3 className="text-xl font-semibold mb-2 flex items-center">
                      <Shield className="mr-2 h-5 w-5" />
                      Vulnerabilities
                    </h3>
                    {results.vulns.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {results.vulns.map((cve, index) => (
                          <a
                            key={index}
                            href={`https://nvd.nist.gov/vuln/detail/${cve}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Badge variant="destructive" className="cursor-pointer hover:opacity-80">
                              {cve}
                              <ExternalLink className="ml-1 h-3 w-3" />
                            </Badge>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No known vulnerabilities</p>
                    )}
                  </div>

                  <Separator />

                  {/* Tags */}
                  <div>
                    <h3 className="text-xl font-semibold mb-2 flex items-center">
                      <Tag className="mr-2 h-5 w-5" />
                      Tags
                    </h3>
                    {results.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {results.tags.map((tag, index) => (
                          <Badge key={index} variant="default">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No tags available</p>
                    )}
                  </div>
                </div>
              </ScrollArea>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>IP Address Intelligence for OSINT</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row">
            <div className="lg:w-3/4 pr-6">
              <div className="lg:hidden mb-6">
                <h4 className="text-lg font-semibold mb-2">Table of Contents</h4>
                <ArticleNavigation sections={articleSections} />
              </div>
              <div className="article-content" ref={articleRef}>
                <h2 id="understanding-ip-intelligence" className="text-lg font-semibold mt-6">Understanding IP Intelligence</h2>
                <p>A single IP address can reveal the hosting provider or ISP behind it, what services are publicly exposed, the security posture of the system, and potential vulnerabilities.</p>
                <p><strong>Active scanning</strong> means directly probing a target with tools like nmap or masscan. <strong>Passive reconnaissance</strong> relies on data already collected by services like Shodan and Censys. Shodan continuously indexes the entire internet, scanning every public IP and cataloging the services it finds. You can look up information about any IP without sending a single packet to the target.</p>
                <p>For OSINT practitioners, passive reconnaissance is strongly preferred. Because you never make direct contact with the target, there is no risk of triggering intrusion detection systems, no legal ambiguity around unauthorized scanning, and no trace of your investigation on the target's logs. Services like Shodan InternetDB act as a legal safe harbor: the data is already public, and you are simply querying a search engine.</p>

                <h2 id="what-open-ports-tell-you" className="text-lg font-semibold mt-6">What Open Ports Tell You</h2>
                <p>Here are some common ports and what they tell you:</p>
                <ul>
                  <li><strong>Port 22 (SSH)</strong> - Secure shell access, typically indicates a Linux/Unix server with remote administration enabled</li>
                  <li><strong>Port 80 / 443 (HTTP / HTTPS)</strong> - Web servers</li>
                  <li><strong>Port 3306 (MySQL)</strong> - MySQL database server, should never be publicly exposed</li>
                  <li><strong>Port 5432 (PostgreSQL)</strong> - PostgreSQL database server, another service that should remain internal</li>
                  <li><strong>Port 3389 (RDP)</strong> - Remote Desktop Protocol, indicates a Windows machine with remote access</li>
                  <li><strong>Port 8080 (Proxy / Alt HTTP)</strong> - Often used for proxy servers, development environments, or alternative web services</li>
                  <li><strong>Port 27017 (MongoDB)</strong> - MongoDB database, historically a major source of data leaks when left exposed</li>
                </ul>
                <p>When database ports like 3306, 5432, or 27017 are exposed to the internet, it almost always indicates a misconfiguration. These services are designed to run behind a firewall and should never be directly accessible. Similarly, an exposed RDP port (3389) is a common attack vector and suggests weak security practices.</p>
                <p>Port combinations can also reveal the underlying technology stack. For example, an IP with ports 80, 443, and 22 open is a typical Linux web server. If you see port 3389 instead of 22, the system is likely running Windows. An IP with ports 80, 443, 8080, and 3306 might be running a LAMP stack with a reverse proxy or development server.</p>

                <h2 id="cpe-common-platform-enumeration" className="text-lg font-semibold mt-6">CPE: Common Platform Enumeration</h2>
                <p>CPE (Common Platform Enumeration) strings are a standardized way of naming and identifying software, operating systems, and hardware. They follow a structured format that makes it possible to precisely identify what is running on a target system.</p>
                <p>A CPE string looks like this: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">cpe:/a:apache:http_server:2.4.41</code>. The format breaks down as follows:</p>
                <ul>
                  <li><strong>/a:</strong> indicates an application (as opposed to /o: for operating system or /h: for hardware)</li>
                  <li><strong>apache</strong> is the vendor</li>
                  <li><strong>http_server</strong> is the product name</li>
                  <li><strong>2.4.41</strong> is the exact version number</li>
                </ul>
                <p>CPE strings let you identify the exact software versions running on a target. When Shodan detects a service, it extracts version information from banners and maps it to a CPE. This gives you a fingerprint of the software stack, which can then be cross-referenced against known vulnerabilities.</p>

                <h2 id="cve-known-vulnerabilities" className="text-lg font-semibold mt-6">CVE: Known Vulnerabilities</h2>
                <p>CVE (Common Vulnerabilities and Exposures) identifiers are unique labels assigned to publicly disclosed security flaws. Each CVE follows the format <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">CVE-YEAR-NUMBER</code> (for example, CVE-2021-44228 for the Log4Shell vulnerability) and serves as a universal reference for a specific security issue.</p>
                <p>Shodan maps CVEs to IP addresses by detecting the software versions running on each host (via CPE strings) and cross-referencing them against known vulnerability databases. This means that when you look up an IP, you can immediately see which known security flaws may affect the services running on it.</p>
                <p>The <a href="https://nvd.nist.gov/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">National Vulnerability Database (NVD)</a> maintained by NIST is the authoritative reference for CVE details, including technical descriptions, affected software versions, and severity scores.</p>
                <p>Each CVE is assigned a CVSS (Common Vulnerability Scoring System) score that indicates its severity:</p>
                <ul>
                  <li><strong>0.0 - 3.9 (Low)</strong> - Minor issues with limited impact</li>
                  <li><strong>4.0 - 6.9 (Medium)</strong> - Moderate vulnerabilities that require some conditions to exploit</li>
                  <li><strong>7.0 - 8.9 (High)</strong> - Serious flaws that can lead to significant compromise</li>
                  <li><strong>9.0 - 10.0 (Critical)</strong> - Severe vulnerabilities, often remotely exploitable with little or no user interaction</li>
                </ul>

                <h2 id="beyond-shodan-internetdb" className="text-lg font-semibold mt-6">Beyond Shodan InternetDB</h2>
                <p>Other services that can complement Shodan InternetDB:</p>
                <ul>
                  <li><strong>Censys</strong> provides internet-wide scanning data with a focus on TLS certificates and service discovery, offering a different perspective from Shodan</li>
                  <li><strong>GreyNoise</strong> helps you determine whether an IP is a known scanner or part of internet background noise, useful for distinguishing between targeted activity and automated scanning</li>
                  <li><strong>AbuseIPDB</strong> is a community-driven database of IP addresses reported for malicious activity. It can tell you if an IP has been flagged for spam, brute-force attacks, or other abuse</li>
                  <li><strong>IPInfo</strong> provides ASN (Autonomous System Number) lookups, geolocation data, and hosting detection, helping you understand the network infrastructure behind an IP</li>
                </ul>
                <p>Combining data from multiple sources gives you a much more complete picture than any single tool can provide. For example, an IP flagged on AbuseIPDB that also shows exposed database ports on Shodan and is identified as a known scanner by GreyNoise paints a very clear picture of a compromised or malicious host.</p>

                <h2 id="osint-tools-ip" className="text-lg font-semibold mt-6">OSINT Tools for IP Intelligence</h2>
                <p>Here are some useful tools for IP address intelligence gathering:</p>
                <OsintToolsGrid tools={[
                  {
                    name: 'Shodan',
                    url: 'https://www.shodan.io/',
                    description: 'Search engine for internet-connected devices',
                    icon: 'https://www.shodan.io/static/img/favicon.png',
                  },
                  {
                    name: 'Censys',
                    url: 'https://search.censys.io/',
                    description: 'Internet-wide scanning and certificate transparency',
                    icon: '/images/tools_icon/censys_logo.jpg',
                  },
                  {
                    name: 'GreyNoise',
                    url: 'https://viz.greynoise.io/',
                    description: 'Identify scanning IPs and reduce noise',
                    icon: 'https://viz.greynoise.io/favicon.ico',
                  },
                  {
                    name: 'AbuseIPDB',
                    url: 'https://www.abuseipdb.com/',
                    description: 'Community-driven IP abuse reporting database',
                    icon: 'https://www.abuseipdb.com/favicon.ico',
                  },
                ]} />
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
