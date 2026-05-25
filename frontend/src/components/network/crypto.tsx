'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Search, Loader2, AlertCircle, Info, ExternalLink, ArrowUpRight, ArrowDownLeft, Hash, Clock, Wallet, ArrowRightLeft, Calendar, Link as LinkIcon } from 'lucide-react'
import { FaBitcoin, FaEthereum } from 'react-icons/fa'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { io, Socket } from 'socket.io-client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CryptoTransaction {
  hash: string
  block?: number | null
  time?: string | null
  value?: number | null
  sender?: string | null
  recipient?: string | null
}

interface CryptoResult {
  address: string
  type: 'bitcoin' | 'ethereum'
  found: boolean
  balance?: number
  balance_raw?: string | number
  total_received?: number | null
  total_sent?: number | null
  tx_count?: number
  first_seen?: string | null
  last_seen?: string | null
  transactions?: CryptoTransaction[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectAddressType(address: string): 'bitcoin' | 'ethereum' | null {
  const trimmed = address.trim()
  if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(trimmed)) return 'bitcoin'
  if (/^bc1[a-zA-HJ-NP-Z0-9]{25,62}$/.test(trimmed)) return 'bitcoin'
  if (/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return 'ethereum'
  return null
}

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return 'N/A'
  return n.toLocaleString('en-US')
}

function formatCryptoAmount(value: number | null | undefined, type: 'bitcoin' | 'ethereum'): string {
  if (value === null || value === undefined) return 'N/A'
  const decimals = type === 'bitcoin' ? 8 : 6
  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleString()
}

function truncateHash(hash: string, chars: number = 10): string {
  if (!hash) return ''
  if (hash.length <= chars * 2 + 3) return hash
  return `${hash.slice(0, chars)}...${hash.slice(-chars)}`
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CryptoSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-6 w-32" />
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center space-x-3">
        <div className="text-muted-foreground">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Article helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CryptoTools() {
  const [address, setAddress] = useState('')
  const [results, setResults] = useState<CryptoResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)
  const articleRef = useRef<HTMLDivElement>(null)

  const articleSections: ArticleSection[] = [
    { id: 'how-blockchain-works', title: 'How Blockchain Transactions Work', level: 1 },
    { id: 'bitcoin-address-formats', title: 'Bitcoin Address Formats', level: 2 },
    { id: 'wallet-clustering', title: 'Wallet Clustering Techniques', level: 2 },
    { id: 'identifying-entities', title: 'Identifying Known Entities', level: 2 },
    { id: 'ethereum-analysis', title: 'Ethereum-Specific Analysis', level: 2 },
    { id: 'osint-tools', title: 'OSINT Tools for Blockchain Analysis', level: 1 },
  ]

  const osintTools: OsintTool[] = [
    {
      name: 'Blockchair',
      url: 'https://blockchair.com/',
      description: 'Universal blockchain explorer for Bitcoin, Ethereum, and more',
      icon: 'https://blockchair.com/favicon.ico',
    },
    {
      name: 'Etherscan',
      url: 'https://etherscan.io/',
      description: 'Ethereum blockchain explorer with token tracking',
      icon: 'https://etherscan.io/images/favicon3.ico',
    },
    {
      name: 'Blockchain.com Explorer',
      url: 'https://www.blockchain.com/explorer',
      description: 'Bitcoin explorer with transaction visualization',
      icon: 'https://www.blockchain.com/static/favicon.ico',
    },
  ]

  // Auto-detect while typing
  const detectedType = useMemo(() => detectAddressType(address), [address])

  // ---- Socket setup ----
  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API || 'http://localhost:5000'
    const newSocket = io(`${backendUrl}/crypto`)
    setSocket(newSocket)

    newSocket.on('connect', () => {
      console.log('Connected to crypto WebSocket')
    })

    newSocket.on('search_result', (data: any) => {
      console.log('Crypto result:', data)
      if (data.error) {
        setError(data.error)
        setResults(null)
      } else if (data.result) {
        if (data.result.module === 'crypto') {
          setResults(data.result.results as CryptoResult)
          setError(null)
        }
      }
      setIsLoading(false)
    })

    newSocket.on('search_progress', (data: any) => {
      console.log('Crypto progress:', data)
    })

    return () => {
      newSocket.disconnect()
    }
  }, [])

  // ---- Submit ----
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!address.trim()) return

    setIsLoading(true)
    setResults(null)
    setError(null)

    if (socket) {
      socket.emit('search_crypto', { input: address.trim() })
    }
  }

  // ---- Derived values for results ----
  const isBtc = results?.type === 'bitcoin'
  const chain = isBtc ? 'bitcoin' : 'ethereum'
  const symbol = isBtc ? 'BTC' : 'ETH'
  const explorerBase = `https://blockchair.com/${chain}/transaction/`

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Cryptocurrency</h1>

      {/* Info card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Info className="mr-2 h-5 w-5" />
            What data can be found?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 space-y-1">
            <li>Wallet balance (BTC / ETH)</li>
            <li>Transaction count</li>
            <li>First and last seen timestamps</li>
            <li>Total received and total sent</li>
            <li>Recent transactions with explorer links</li>
          </ul>
          <p className="mt-4 text-sm text-gray-500">
            Data is sourced from the{' '}
            <a
              href="https://blockchair.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline inline-flex items-center"
            >
              Blockchair
              <ExternalLink className="ml-1 h-3 w-3" />
            </a>{' '}
            public API.
          </p>
        </CardContent>
      </Card>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <Label htmlFor="crypto-address">Crypto Address</Label>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <div className="flex-grow space-y-1">
            <Input
              id="crypto-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="BTC or ETH address"
              required
              className="w-full"
            />
            {address.trim() && (
              <div className="flex items-center space-x-2 mt-1">
                {detectedType === 'bitcoin' && (
                  <Badge className="bg-orange-500 hover:bg-orange-600 text-white">
                    <FaBitcoin className="mr-1 h-3 w-3" />
                    Bitcoin
                  </Badge>
                )}
                {detectedType === 'ethereum' && (
                  <Badge className="bg-blue-500 hover:bg-blue-600 text-white">
                    <FaEthereum className="mr-1 h-3 w-3" />
                    Ethereum
                  </Badge>
                )}
                {detectedType === null && (
                  <Badge variant="destructive">Unrecognised format</Badge>
                )}
              </div>
            )}
          </div>
          <Button type="submit" disabled={isLoading || !detectedType} className="w-full sm:w-auto">
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            {isLoading ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <Card>
          <CardContent className="pt-6">
            <CryptoSkeleton />
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results && results.found && !isLoading && (
        <div className="space-y-4">
          {/* Address type header */}
          <div className="flex items-center space-x-3">
            {isBtc ? (
              <FaBitcoin className="h-6 w-6 text-orange-500" />
            ) : (
              <FaEthereum className="h-6 w-6 text-blue-500" />
            )}
            <Badge className={isBtc ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}>
              {isBtc ? 'Bitcoin' : 'Ethereum'}
            </Badge>
            <span className="text-sm text-muted-foreground break-all">{results.address}</span>
          </div>

          {/* Balance card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Wallet className="mr-2 h-5 w-5" />
                Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {formatCryptoAmount(results.balance, results.type)}{' '}
                <span className="text-lg text-muted-foreground">{symbol}</span>
              </p>
            </CardContent>
          </Card>

          {/* Stats grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.total_received !== null && results.total_received !== undefined && (
              <StatCard
                icon={<ArrowDownLeft className="h-4 w-4" />}
                label="Total Received"
                value={`${formatCryptoAmount(results.total_received, results.type)} ${symbol}`}
              />
            )}
            {results.total_sent !== null && results.total_sent !== undefined && (
              <StatCard
                icon={<ArrowUpRight className="h-4 w-4" />}
                label="Total Sent"
                value={`${formatCryptoAmount(results.total_sent, results.type)} ${symbol}`}
              />
            )}
            <StatCard
              icon={<ArrowRightLeft className="h-4 w-4" />}
              label="Transaction Count"
              value={formatNumber(results.tx_count)}
            />
            <StatCard
              icon={<Calendar className="h-4 w-4" />}
              label="First Seen"
              value={formatDate(results.first_seen)}
            />
            <StatCard
              icon={<Clock className="h-4 w-4" />}
              label="Last Seen"
              value={formatDate(results.last_seen)}
            />
          </div>

          {/* Recent transactions */}
          {results.transactions && results.transactions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Hash className="mr-2 h-5 w-5" />
                  Recent Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {results.transactions.map((tx, idx) => {
                      const isIncoming = tx.recipient?.toLowerCase() === results.address.toLowerCase()
                      const isOutgoing = tx.sender?.toLowerCase() === results.address.toLowerCase()

                      return (
                        <div key={idx}>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="flex items-center space-x-2 min-w-0">
                              {isIncoming && (
                                <Badge className="bg-green-500 hover:bg-green-600 text-white shrink-0">IN</Badge>
                              )}
                              {isOutgoing && (
                                <Badge className="bg-red-500 hover:bg-red-600 text-white shrink-0">OUT</Badge>
                              )}
                              {!isIncoming && !isOutgoing && tx.hash && (
                                <Badge variant="outline" className="shrink-0">TX</Badge>
                              )}
                              <a
                                href={`${explorerBase}${tx.hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 hover:underline text-sm font-mono truncate"
                              >
                                {truncateHash(tx.hash)}
                                <ExternalLink className="inline ml-1 h-3 w-3" />
                              </a>
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground shrink-0">
                              {tx.value !== null && tx.value !== undefined && (
                                <span className="font-medium">
                                  {formatCryptoAmount(tx.value, results.type)} {symbol}
                                </span>
                              )}
                              {tx.time && (
                                <span>{formatDate(tx.time)}</span>
                              )}
                            </div>
                          </div>
                          {idx < (results.transactions?.length ?? 0) - 1 && (
                            <Separator className="mt-3" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Not found */}
      {results && !results.found && !isLoading && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Data Found</AlertTitle>
          <AlertDescription>
            No on-chain data was found for address {results.address}. The address may be unused or invalid.
          </AlertDescription>
        </Alert>
      )}

      {/* Educational article */}
      <Card>
        <CardHeader>
          <CardTitle>Blockchain Analysis for OSINT</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row">
            <div className="lg:w-3/4 pr-6">
              <div className="lg:hidden mb-6">
                <h4 className="text-lg font-semibold mb-2">Table of Contents</h4>
                <ArticleNavigation sections={articleSections} />
              </div>
              <div className="article-content" ref={articleRef}>
                <h2 id="how-blockchain-works">How Blockchain Transactions Work</h2>
                <p>Every Bitcoin or Ethereum transaction is permanently recorded on a public ledger. Transactions have inputs (source addresses) and outputs (destination addresses plus change). The blockchain is fully transparent: anyone can see every transaction ever made.</p>
                <p>Addresses are pseudonymous, not anonymous. They can be linked to real identities through various techniques.</p>

                <h3 id="bitcoin-address-formats">Bitcoin Address Formats</h3>
                <p>Bitcoin uses several address formats, each with distinct characteristics:</p>
                <ul>
                  <li><strong>Legacy (P2PKH)</strong>: starts with <code>1</code>, the oldest format (e.g., <code>1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa</code> -- Satoshi&apos;s genesis address)</li>
                  <li><strong>SegWit (P2SH)</strong>: starts with <code>3</code>, supports multi-sig and reduced fees</li>
                  <li><strong>Bech32 (P2WPKH)</strong>: starts with <code>bc1</code>, native SegWit, lowest fees, most modern</li>
                </ul>
                <p>Each format is interchangeable -- a user can control addresses in all three formats from the same wallet. Recognising the format helps analysts understand the sophistication and habits of a wallet owner.</p>

                <h3 id="wallet-clustering">Wallet Clustering Techniques</h3>
                <p>Wallet clustering is the process of grouping addresses that are likely controlled by the same entity:</p>
                <ul>
                  <li><strong>Common-input-ownership heuristic</strong>: if addresses A and B are both inputs to the same transaction, they are likely controlled by the same entity (they had to sign with both private keys)</li>
                  <li><strong>Change address detection</strong>: when you send Bitcoin, the &quot;change&quot; goes to a new address you control -- this links the change address to the sender</li>
                  <li><strong>Address reuse</strong>: many users reuse addresses, making tracking easier</li>
                  <li><strong>CoinJoin detection</strong>: a privacy technique that mixes multiple users&apos; transactions together to break the common-input heuristic -- detectable by its distinctive multi-input multi-output pattern</li>
                </ul>

                <h3 id="identifying-entities">Identifying Known Entities</h3>
                <p>Attributing blockchain addresses to real-world entities is a key part of blockchain OSINT:</p>
                <ul>
                  <li>Blockchain analysis companies (Chainalysis, Elliptic) maintain databases mapping addresses to known entities (exchanges, darknet markets, ransomware operators)</li>
                  <li>Exchange deposit addresses are identifiable: when you deposit to Coinbase or Binance, the deposit address is linked to your KYC&apos;d account</li>
                  <li>Publicly known addresses: donations pages, payment processors, and seized wallets are all attributed</li>
                  <li>Address labels on Blockchair and other explorers crowdsource entity identification</li>
                </ul>

                <h3 id="ethereum-analysis">Ethereum-Specific Analysis</h3>
                <p>Ethereum has a richer data model than Bitcoin, opening additional avenues for investigation:</p>
                <ul>
                  <li><strong>Smart contracts, token transfers (ERC-20), and NFTs (ERC-721)</strong> all leave on-chain traces that can be analysed</li>
                  <li><strong>ENS (Ethereum Name Service)</strong>: <code>.eth</code> domains resolve to addresses and often reveal the owner&apos;s identity</li>
                  <li><strong>Contract interactions</strong>: you can see every DeFi protocol, NFT marketplace, and token a wallet has interacted with</li>
                  <li><strong>Internal transactions</strong>: contract-to-contract calls that reveal complex financial flows</li>
                </ul>

                <h2 id="osint-tools">OSINT Tools for Blockchain Analysis</h2>
                <p>Here are some useful tools for blockchain investigations:</p>
                <OsintToolsGrid tools={osintTools} />
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
