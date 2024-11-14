'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Search, Loader2, AlertCircle, Info, Globe, Server, ExternalLink, LinkIcon } from 'lucide-react'
import { FaGoogle } from 'react-icons/fa'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { io, Socket } from 'socket.io-client'
import WhoisResult from './domain/whois'
import CrtshResult from './domain/crtsh'
import { ArticleImage } from '@/components/image'

interface WhoisResult {
  module: string;
  results: {
    domain_name: string;
    registrar: string;
    whois_server: string;
    referral_url: string | null;
    updated_date: string;
    creation_date: string;
    expiration_date: string;
    name_servers: string[];
    status: string[];
    emails: string;
    dnssec: string;
    name: string;
    org: string;
    address: string;
    city: string;
    state: string | null;
    registrant_postal_code: string;
    country: string;
  };
}

interface CrtshResult {
  module: string;
  results: string[];
}

interface DomainInfo {
  whois: WhoisResult | null;
  crtsh: CrtshResult | null;
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

export default function DomainToolsAndArticle() {
  const [domain, setDomain] = useState('')
  const [isValidInput, setIsValidInput] = useState(true)
  const [results, setResults] = useState<DomainInfo>({ whois: null, crtsh: null })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [receivedModules, setReceivedModules] = useState<Set<string>>(new Set())
  const [socket, setSocket] = useState<Socket | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const articleRef = useRef<HTMLDivElement>(null)

  const articleSections: ArticleSection[] = [
    { id: 'domain-registration', title: 'Domain Registration Analysis', level: 1 },
    { id: 'historical-analysis', title: 'Historical Analysis', level: 1 },
    { id: 'cloud-storage', title: 'Cloud Storage Investigation', level: 1 },
    { id: 'tracking-connections', title: 'Tracking Connections', level: 1 },
    { id: 'subdomain-enumeration', title: 'Subdomain Enumeration', level: 1 },
    { id: 'subdomain-certificates', title: 'SSL Certificates Transparency', level: 2 },
    { id: 'subdomain-dns', title: 'DNS Records', level: 2 },
    { id: 'subdomain-dorks', title: 'Google Dorks', level: 2 },
    { id: 'advanced-search', title: 'Advanced Search Techniques', level: 1 },
    { id: 'data-breach', title: 'Data Breach Investigation', level: 1 },
  ]

  const isValidDomain = (domain: string): boolean => {
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
    return domainRegex.test(domain);
  }

  const handleDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDomain(value);
    if (value) {
      setIsValidInput(isValidDomain(value));
    } else {
      setIsValidInput(true);
    }
  }

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API || 'http://localhost:5000'
    const newSocket = io(`${backendUrl}/domain`)
    setSocket(newSocket)

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket')
    })

    newSocket.on('search_result', (data) => {
      console.log('Received data from WebSocket:', data)

      if (data.error) {
        setError(data.error)
        setIsLoading(false)
      } else if (data.result) {
        if (data.result.module === 'whois') {
          setResults(prev => ({ ...prev, whois: data.result as WhoisResult }))
        } else if (data.result.module === 'crtsh') {
          setResults(prev => ({ ...prev, crtsh: data.result as CrtshResult }))
        }
        setReceivedModules(prev => new Set(prev).add(data.result.module))
        setError(null)
      }
    })

    newSocket.on('search_complete', () => {
      setIsLoading(false)
      setReceivedModules(new Set())
    })

    return () => {
      newSocket.disconnect()
    }
  }, [])

  useEffect(() => {
    if (receivedModules.has('whois') && receivedModules.has('crtsh')) {
      setIsLoading(false)
      setReceivedModules(new Set())
    }
  }, [receivedModules])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!domain || !isValidDomain(domain)) {
      setError("Please enter a valid domain name (e.g., example.com)");
      return;
    }
    
    setIsLoading(true)
    setResults({ whois: null, crtsh: null })
    setError(null)
    setReceivedModules(new Set())
    setHasSearched(true)

    if (socket) {
      socket.emit('search_domain', { input: domain })
    }
  }

  const WhoisSkeleton = () => (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-bold flex items-center">
          <Globe className="mr-2" />
          WHOIS Information
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </CardContent>
    </Card>
  )

  const CrtshSkeleton = () => (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-bold flex items-center">
          <Server className="mr-2" />
          Subdomains from crt.sh
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6 w-full">
      <h1 className="text-3xl font-bold">Domain</h1>

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
              <h3 className="font-semibold mb-2">WHOIS Information</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Domain registration details</li>
                <li>Registrar information</li>
                <li>Creation and expiration dates</li>
                <li>Name servers</li>
                <li>Registrant contact information</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Subdomains (crt.sh)</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>List of subdomains</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Domain</Label>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <div className="flex-grow">
                  <Input
                    id="domain"
                    type="text"
                    value={domain}
                    onChange={handleDomainChange}
                    placeholder="example.com"
                    required
                    className={`w-full ${!isValidInput ? 'border-red-500 focus:ring-red-500' : ''}`}
                  />
                  {!isValidInput && domain && (
                    <p className="mt-1 text-sm text-red-500">
                      Please enter a valid domain name (e.g., example.com)
                    </p>
                  )}
                </div>
                <Button 
                  type="submit" 
                  disabled={isLoading || !isValidInput} 
                  className="w-full sm:w-auto"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  {isLoading ? 'Searching...' : 'Search'}
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

      {hasSearched && (
        <Tabs defaultValue="whois" className="space-y-4 w-full">
          <TabsList className="w-full">
            <TabsTrigger value="whois" className="flex items-center flex-1">
              <Globe className="mr-2 h-4 w-4" />
              WHOIS Information
            </TabsTrigger>
            <TabsTrigger value="crtsh" className="flex items-center flex-1">
              <Server className="mr-2 h-4 w-4" />
              Subdomains (crt.sh)
            </TabsTrigger>
          </TabsList>
          <TabsContent value="whois" className="w-full">
            {isLoading ? (
              <WhoisSkeleton />
            ) : results.whois ? (
              <WhoisResult data={results.whois} />
            ) : null}
          </TabsContent>
          <TabsContent value="crtsh" className="w-full">
            {isLoading ? (
              <CrtshSkeleton />
            ) : results.crtsh ? (
              <CrtshResult data={results.crtsh} />
            ) : null}
          </TabsContent>
        </Tabs>
      )}

      <Card>
        <CardHeader>
          <CardTitle>OSINT Domain Investigation Techniques</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row">
            <div className="lg:w-3/4 pr-6">
              <div className="lg:hidden mb-6">
                <h4 className="text-lg font-semibold mb-2">Table of Contents</h4>
                <ArticleNavigation sections={articleSections} />
              </div>
              <div className="article-content" ref={articleRef}>
                <h2 id="domain-registration" className="text-lg font-semibold mt-6">Domain Registration Analysis</h2>
                <p>
                  WHOIS gives you details about domain registration dates, which can be interesting when you're investigating potential scams or cyber threats. Although privacy protection has made current WHOIS data less transparent, historical WHOIS records can still yield contact information like email addresses and phone numbers.
                </p>
                <OsintToolsGrid 
                  tools={[
                    {
                      name: "WHOIS Lookup",
                      url: "https://whois.domaintools.com/",
                      description: "Comprehensive WHOIS lookup tool",
                      icon: "https://whois.domaintools.com/favicon.ico"
                    }
                  ]}
                />

                <h2 id="historical-analysis" className="text-lg font-semibold mt-8">Historical Analysis</h2>
                <p>
                  The Internet Archive's Wayback Machine is one of the most useful tools, capturing snapshots of websites over time. It allows you to track changes in content, discover removed information, and observe the evolution of a website. Historical insights can shed light on past modifications which could give you information about removed pages as well.
                </p>
                <ArticleImage
                  src="/images/domain/internet_archive.png"
                  alt="Wayback machine on domain hippie.cat"
                  width={800}
                  height={400}
                />
                <OsintToolsGrid 
                  tools={[
                    {
                      name: "Wayback Machine",
                      url: "https://web.archive.org/",
                      description: "Access archived versions of websites",
                      icon: "https://web.archive.org/_static/images/archive.ico"
                    }
                  ]}
                />

                <h2 id="cloud-storage" className="text-lg font-semibold mt-8">Cloud Storage Investigation</h2>
                <p>
                  Most of the companies use cloud storage solutions, which can sometimes be exposed. You can discover publicly accessible AWS S3 buckets, Azure Blobs, and Google Cloud Storage containers that might contain sensitive information (private pdfs, images, etc..).
                </p>
                <ArticleImage
                  src="/images/domain/bucket_search.png"
                  alt="Bucket search for keyword 'osint'"
                  width={800}
                  height={400}
                />
                <OsintToolsGrid 
                  tools={[
                    {
                      name: "OSINT.sh Buckets",
                      url: "https://osint.sh/buckets/",
                      description: "Discover exposed cloud storage buckets",
                      icon: "/images/tools_icon/osintsh_logo.png"
                    },
                    {
                      name: "GrayhatWarfare",
                      url: "https://buckets.grayhatwarfare.com/",
                      description: "Search for open Amazon S3 buckets",
                      icon: "https://buckets.grayhatwarfare.com/favicon.ico"
                    }
                  ]}
                />

                <h2 id="tracking-connections" className="text-lg font-semibold mt-8">Tracking Connections</h2>
                <p>
                  When you want to discover links between websites or discover other related websites, do not forget to look for tracking codes. Google Analytics and AdSense IDs often link multiple domains to the same owner or organization.
                  <br />
                  To find tracking codes, right-click on the webpage, select "View Page Source", and use CTRL+F to search for specific patterns:
                  <ArticleImage
                    src="/images/domain/identify_analytics_id.png"
                    alt="Identify analytics ID"
                    width={800}
                    height={400}
                  />
                  <pre><code>
                    // Look for these in the page source
                    <br />
                    G-XXXXXXXXXX      // Modern GA4
                    <br />
                    UA-XXXXXX-X       // Legacy Analytics
                    <br />
                    ca-pub-XXXXXXXXXX // AdSense
                  </code></pre>
                  <ArticleImage
                    src="/images/domain/reverse_id_search.png"
                    alt="Reverse ID search"
                    width={800}
                    height={400}
                  />
                </p>
                <OsintToolsGrid 
                  tools={[
                    {
                      name: "OSINT.sh AdSense",
                      url: "https://osint.sh/adsense/",
                      description: "Find domains sharing AdSense IDs",
                      icon: "/images/tools_icon/osintsh_logo.png"
                    },
                    {
                      name: "OSINT.sh Analytics",
                      url: "https://osint.sh/analytics/",
                      description: "Discover domains with shared Analytics IDs",
                      icon: "/images/tools_icon/osintsh_logo.png"
                    },
                    {
                      name: "DNSlytics",
                      url: "https://search.dnslytics.com",
                      description: "Search for domain information, analytics and adsense IDs",
                      icon: "https://search.dnslytics.com/favicon.ico"
                    }
                  ]}
                />

                <h2 id="subdomain-enumeration" className="text-lg font-semibold mt-8">Subdomain Enumeration</h2>
                <p>
                  Subdomain enumeration is a wide topic, a lot of tools and techniques exists (if you want to only retrieve subdomains using OSINT techniques, be careful with the tool you use).
                  You can retrieve subdomains using :
                  <ul>
                    <li>Certificate transparency logs, like crt.sh. When a website is registered, it has to be issued a SSL certificate by a Certificate Authority, and this certificate is recorded in a log. This way, you can retrieve subdomains from the logs. If you want to avoid your domains to be recorded I recommand you to use a wildcard certificate (such as *.hippie.cat).</li>
                    <ArticleImage
                      src="/images/domain/crtsh_hippie_cat.png"
                      alt="crt.sh hippie.cat"
                      width={800}
                      height={400}
                    />
                    <li>Google dorks such as <code>site:example.com</code></li>
                    <li>DNS records</li>
                  </ul>
                </p>
                <OsintToolsGrid 
                  tools={[
                    {
                      name: "crt.sh",
                      url: "https://crt.sh/",
                      description: "Certificate search tool",
                      icon: "https://crt.sh/favicon.ico"
                    },
                    {
                      name: "PhoneBook.cz",
                      url: "https://phonebook.cz/",
                      description: "Subdomain enumeration tool",
                      icon: "https://phonebook.cz/favicon.ico"
                    },
                    {
                      name: "DNSdumpster",
                      url: "https://dnsdumpster.com/",
                      description: "Subdomain enumeration tool",
                      icon: "/images/tools_icon/dnsdumpster.png"
                    },
                    {
                      name: "SecurityTrails",
                      url: "https://securitytrails.com",
                      description: "Subdomain enumeration tool",
                      icon: "https://securitytrails.com/favicon.ico"
                    }
                  ]}
                />

                <h2 id="advanced-search" className="text-lg font-semibold mt-8">Find sensitive information through dorks</h2>
                <p>
                  Google dorking remains a powerful technique for discovering exposed documents, logs, and sensitive information. Here are a few dorks examples that you can use on a domain : 
                  <pre><code>
                    site:example.com filetype:pdf OR filetype:xlsx   # find pdf or xlsx files
                    <br />
                    site:example.com intext:password                 # find password in the text of the page
                    <br />
                    link:example.com -site:example.com               # find website links to the domain
                  </code></pre>
                  If you are lazy to create a specific dork, you can use DorkGPT, an AI-powered tool that generates precise search queries.
                </p>
                <OsintToolsGrid 
                  tools={[
                    {
                      name: "DorkGPT",
                      url: "https://www.dorkgpt.com/",
                      description: "AI-powered Google dorking query generator",
                      icon: "https://www.dorkgpt.com/favicon.ico"
                    }
                  ]}
                />

                <h2 id="data-breach" className="text-lg font-semibold mt-8">Data Breach Investigation</h2>
                <p>
                  Data breaches allows you to obtain sensitive information about people on a domain, it's pretty useful for red teaming or social engineering.
                  Leaked data can provide information about domain owners and associated accounts as well.
                </p>
                <OsintToolsGrid 
                  tools={[
                    {
                      name: "Intelligence X",
                      url: "https://intelx.io/",
                      description: "Search engine for darknet, leaks, and more",
                      icon: "https://intelx.io/favicon.ico"
                    },
                    {
                      name: "Dehashed",
                      url: "https://dehashed.com/",
                      description: "View leaked credentials and information",
                      icon: "/images/tools_icon/dehashed_logo.png"
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