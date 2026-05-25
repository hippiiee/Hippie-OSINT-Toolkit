import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Globe,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Mail,
  KeyRound,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SpfData {
  raw: string
  includes: { domain: string; service: string }[]
  ips: string[]
  all_qualifier: string | null
}

interface DmarcData {
  raw: string
  policy?: string
  subdomain_policy?: string
  rua?: string[]
  ruf?: string[]
  pct?: string
  adkim?: string
  aspf?: string
  spoofable?: boolean
}

interface DkimEntry {
  selector: string
  record: string
}

interface ServiceEntry {
  service: string
  record: string
}

interface ZoneTransferData {
  attempted: string[]
  success: boolean
  records: { name: string; type: string; value: string }[]
}

interface DnsResults {
  domain: string
  records: Record<string, string[]>
  spf: SpfData | null
  dmarc: DmarcData | null
  dkim: DkimEntry[]
  services: ServiceEntry[]
  zone_transfer: ZoneTransferData
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function AllQualifierBadge({ qualifier }: { qualifier: string | null }) {
  if (!qualifier) return <Badge variant="outline">Not specified</Badge>

  const normalized = qualifier.toLowerCase().trim()

  if (normalized === "+all") {
    return (
      <Badge className="bg-red-600 hover:bg-red-700 text-white">
        <XCircle className="mr-1 h-3 w-3" />
        {qualifier} — DANGEROUS (allows any server)
      </Badge>
    )
  }
  if (normalized === "-all") {
    return (
      <Badge className="bg-green-600 hover:bg-green-700 text-white">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        {qualifier} — Strict (only listed senders)
      </Badge>
    )
  }
  if (normalized === "~all") {
    return (
      <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">
        <AlertTriangle className="mr-1 h-3 w-3" />
        {qualifier} — Soft fail (usually still delivered)
      </Badge>
    )
  }
  if (normalized === "?all") {
    return (
      <Badge className="bg-orange-500 hover:bg-orange-600 text-white">
        <Info className="mr-1 h-3 w-3" />
        {qualifier} — Neutral (no policy)
      </Badge>
    )
  }

  return <Badge variant="secondary">{qualifier}</Badge>
}

function DmarcPolicyBadge({ policy, spoofable }: { policy?: string; spoofable?: boolean }) {
  if (!policy) return <Badge variant="outline">No policy found</Badge>

  if (policy === "reject") {
    return (
      <Badge className="bg-green-600 hover:bg-green-700 text-white">
        <ShieldCheck className="mr-1 h-3 w-3" />
        p={policy}
      </Badge>
    )
  }
  if (policy === "quarantine") {
    return (
      <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">
        <Shield className="mr-1 h-3 w-3" />
        p={policy}
      </Badge>
    )
  }
  // none
  return (
    <Badge className="bg-red-600 hover:bg-red-700 text-white">
      <ShieldX className="mr-1 h-3 w-3" />
      p={policy} {spoofable ? "— Spoofable" : ""}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Sub-sections
// ---------------------------------------------------------------------------

function RecordsSection({ records }: { records: Record<string, string[]> }) {
  const typeOrder = ["A", "AAAA", "CNAME", "MX", "NS", "TXT", "CAA", "SOA", "SRV"]
  const sorted = typeOrder.filter((t) => records[t] && records[t].length > 0)

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground">No DNS records found.</p>
  }

  return (
    <ScrollArea className="w-full rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-2 text-left font-semibold w-24">Type</th>
            <th className="px-4 py-2 text-left font-semibold">Value</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((rtype) =>
            records[rtype].map((value, i) => (
              <tr key={`${rtype}-${i}`} className="border-b last:border-0">
                <td className="px-4 py-2 align-top">
                  <Badge variant="secondary">{rtype}</Badge>
                </td>
                <td className="px-4 py-2 font-mono text-xs break-all">{value}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </ScrollArea>
  )
}

function SpfSection({ spf }: { spf: SpfData | null }) {
  if (!spf) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>No SPF Record</AlertTitle>
        <AlertDescription>
          No SPF (Sender Policy Framework) record was found for this domain. This means any server
          can send email on behalf of this domain without SPF-based rejection.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold mb-1">Raw Record</p>
        <code className="block bg-muted p-3 rounded text-xs break-all">{spf.raw}</code>
      </div>

      <Separator />

      <div>
        <p className="text-sm font-semibold mb-2">All Qualifier</p>
        <AllQualifierBadge qualifier={spf.all_qualifier} />
      </div>

      {spf.includes.length > 0 && (
        <>
          <Separator />
          <div>
            <p className="text-sm font-semibold mb-2">Authorized Senders (includes)</p>
            <div className="space-y-2">
              {spf.includes.map((inc, i) => (
                <div key={i} className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="font-mono text-xs">
                    {inc.domain}
                  </Badge>
                  <Badge variant="secondary">{inc.service}</Badge>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {spf.ips.length > 0 && (
        <>
          <Separator />
          <div>
            <p className="text-sm font-semibold mb-2">Authorized IPs</p>
            <div className="flex flex-wrap gap-2">
              {spf.ips.map((ip, i) => (
                <Badge key={i} variant="outline" className="font-mono text-xs">
                  {ip}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function DmarcSection({ dmarc }: { dmarc: DmarcData | null }) {
  if (!dmarc) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>No DMARC Record</AlertTitle>
        <AlertDescription>
          No DMARC record was found at _dmarc.domain. Without DMARC, email receivers have no
          policy guidance and spoofing is easier.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold mb-1">Raw Record</p>
        <code className="block bg-muted p-3 rounded text-xs break-all">{dmarc.raw}</code>
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-semibold mb-2">Policy</p>
          <DmarcPolicyBadge policy={dmarc.policy} spoofable={dmarc.spoofable} />
        </div>

        {dmarc.subdomain_policy && (
          <div>
            <p className="text-sm font-semibold mb-2">Subdomain Policy</p>
            <DmarcPolicyBadge policy={dmarc.subdomain_policy} />
          </div>
        )}

        {dmarc.pct && (
          <div>
            <p className="text-sm font-semibold mb-2">Percentage</p>
            <Badge variant="secondary">{dmarc.pct}% of messages</Badge>
          </div>
        )}

        {dmarc.adkim && (
          <div>
            <p className="text-sm font-semibold mb-2">DKIM Alignment</p>
            <Badge variant="secondary">{dmarc.adkim === "s" ? "Strict" : "Relaxed"}</Badge>
          </div>
        )}

        {dmarc.aspf && (
          <div>
            <p className="text-sm font-semibold mb-2">SPF Alignment</p>
            <Badge variant="secondary">{dmarc.aspf === "s" ? "Strict" : "Relaxed"}</Badge>
          </div>
        )}
      </div>

      {(dmarc.rua || dmarc.ruf) && (
        <>
          <Separator />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dmarc.rua && dmarc.rua.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2">Aggregate Reports (rua)</p>
                <div className="space-y-1">
                  {dmarc.rua.map((uri, i) => (
                    <p key={i} className="text-xs font-mono break-all">{uri}</p>
                  ))}
                </div>
              </div>
            )}
            {dmarc.ruf && dmarc.ruf.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2">Forensic Reports (ruf)</p>
                <div className="space-y-1">
                  {dmarc.ruf.map((uri, i) => (
                    <p key={i} className="text-xs font-mono break-all">{uri}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {dmarc.spoofable && (
        <>
          <Separator />
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Domain may be spoofable</AlertTitle>
            <AlertDescription>
              The DMARC policy is set to <strong>none</strong>, which means receivers will not
              reject or quarantine unauthenticated email. Attackers can send email that appears to
              come from this domain.
            </AlertDescription>
          </Alert>
        </>
      )}
    </div>
  )
}

function DkimSection({ dkim }: { dkim: DkimEntry[] }) {
  if (dkim.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>No DKIM Selectors Found</AlertTitle>
        <AlertDescription>
          None of the common DKIM selectors returned a record. The domain may use a non-standard
          selector, or DKIM may not be configured.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Found {dkim.length} DKIM selector{dkim.length !== 1 ? "s" : ""}.
      </p>
      {dkim.map((entry, i) => (
        <div key={i} className="rounded-md border p-3">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound className="h-4 w-4" />
            <Badge variant="secondary" className="font-mono">
              {entry.selector}._domainkey
            </Badge>
          </div>
          <code className="block bg-muted p-2 rounded text-xs break-all">{entry.record}</code>
        </div>
      ))}
    </div>
  )
}

function ServicesSection({ services }: { services: ServiceEntry[] }) {
  if (services.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No third-party services detected from TXT records.</p>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Detected {services.length} service{services.length !== 1 ? "s" : ""} from TXT verification records.
      </p>
      <div className="flex flex-wrap gap-2">
        {services.map((svc, i) => (
          <Badge key={i} variant="secondary" className="text-sm">
            {svc.service}
          </Badge>
        ))}
      </div>
      <Separator />
      <ScrollArea className="max-h-[300px] w-full rounded-md border">
        <div className="p-3 space-y-2">
          {services.map((svc, i) => (
            <div key={i}>
              <p className="text-xs font-semibold">{svc.service}</p>
              <code className="block text-xs text-muted-foreground break-all">{svc.record}</code>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

function ZoneTransferSection({ zt }: { zt: ZoneTransferData }) {
  return (
    <div className="space-y-3">
      {zt.attempted.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-1">Nameservers tested</p>
          <div className="flex flex-wrap gap-2">
            {zt.attempted.map((ns, i) => (
              <Badge key={i} variant="outline" className="font-mono text-xs">
                {ns}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {zt.success ? (
        <>
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Zone Transfer Succeeded</AlertTitle>
            <AlertDescription>
              A nameserver allowed an unrestricted zone transfer (AXFR). This exposes every DNS
              record in the zone and is a significant security misconfiguration.
            </AlertDescription>
          </Alert>
          <ScrollArea className="max-h-[400px] w-full rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-semibold">Name</th>
                  <th className="px-4 py-2 text-left font-semibold">Type</th>
                  <th className="px-4 py-2 text-left font-semibold">Value</th>
                </tr>
              </thead>
              <tbody>
                {zt.records.map((rec, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-2 font-mono text-xs">{rec.name}</td>
                    <td className="px-4 py-2">
                      <Badge variant="secondary">{rec.type}</Badge>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs break-all">{rec.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </>
      ) : (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Zone Transfer Refused</AlertTitle>
          <AlertDescription>
            All nameservers correctly refused the zone transfer request (AXFR). This is the expected
            secure configuration.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DnsResult({ data }: { data: any }) {
  const results: DnsResults = data.results

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-bold flex items-center">
          <Globe className="mr-2" />
          DNS for {results.domain}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="records" className="w-full">
          <TabsList className="w-full flex flex-wrap h-auto gap-1">
            <TabsTrigger value="records" className="flex items-center gap-1">
              <Server className="h-3 w-3" />
              Records
            </TabsTrigger>
            <TabsTrigger value="spf" className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              SPF
            </TabsTrigger>
            <TabsTrigger value="dmarc" className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              DMARC
            </TabsTrigger>
            <TabsTrigger value="dkim" className="flex items-center gap-1">
              <KeyRound className="h-3 w-3" />
              DKIM
            </TabsTrigger>
            <TabsTrigger value="services" className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Services
            </TabsTrigger>
            <TabsTrigger value="axfr" className="flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" />
              Zone Transfer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="records" className="mt-4">
            <RecordsSection records={results.records} />
          </TabsContent>

          <TabsContent value="spf" className="mt-4">
            <SpfSection spf={results.spf} />
          </TabsContent>

          <TabsContent value="dmarc" className="mt-4">
            <DmarcSection dmarc={results.dmarc} />
          </TabsContent>

          <TabsContent value="dkim" className="mt-4">
            <DkimSection dkim={results.dkim} />
          </TabsContent>

          <TabsContent value="services" className="mt-4">
            <ServicesSection services={results.services} />
          </TabsContent>

          <TabsContent value="axfr" className="mt-4">
            <ZoneTransferSection zt={results.zone_transfer} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
