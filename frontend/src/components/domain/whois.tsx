import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CalendarDays, Globe, Server, Shield, User, Building, MapPin, ExternalLink, AlertCircle } from 'lucide-react'
import { getTldRegistry } from "@/lib/tld-registries"

interface WhoisResult {
  module: string;
  results: {
    domain_name: string | null;
    registrar: string | null;
    whois_server: string | null;
    referral_url: string | null;
    updated_date: string | string[] | null;
    creation_date: string | string[] | null;
    expiration_date: string | string[] | null;
    name_servers: string[] | string | null;
    status: string[] | string | null;
    emails: string | string[] | null;
    dnssec: string | null;
    name: string | null;
    org: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    registrant_postal_code: string | null;
    country: string | null;
  };
}

const asArray = <T,>(v: T | T[] | null | undefined): T[] => {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
};

const formatDate = (value: string | string[] | null | undefined): string => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return 'N/A';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const text = (v: unknown, fallback = 'N/A'): string => {
  if (v == null || v === '') return fallback;
  if (Array.isArray(v)) return v.length ? v.join(', ') : fallback;
  return String(v);
};

export default function WhoisResult({ data, domain }: { data: WhoisResult; domain?: string }) {
  const { results } = data;
  const nameServers = asArray<string>(results.name_servers);
  const statuses = asArray<string>(results.status);
  const emails = asArray<string>(results.emails);

  const allNull = Object.values(results).every(v => v == null || (Array.isArray(v) && v.length === 0));
  const queriedDomain = domain || (typeof results.domain_name === 'string' ? results.domain_name : null);
  const registry = queriedDomain && allNull ? getTldRegistry(queriedDomain) : null;

  if (allNull && registry) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center">
            <AlertCircle className="mr-2 text-yellow-500" />
            No WHOIS data available
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm">
            We couldn't retrieve WHOIS data for <strong>{queriedDomain}</strong>.
          </p>
          <p className="text-sm text-muted-foreground">{registry.reason}</p>
          <div>
            <Button asChild>
              <a href={registry.lookupUrl} target="_blank" rel="noopener noreferrer">
                Look up on {registry.name}
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-bold flex items-center">
          <Globe className="mr-2" />
          WHOIS Information for {text(results.domain_name, 'this domain')}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center">
              <Building className="mr-2" /> Registrar Details
            </h3>
            <p><strong>Registrar:</strong> {text(results.registrar)}</p>
            <p><strong>WHOIS Server:</strong> {text(results.whois_server)}</p>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center">
              <CalendarDays className="mr-2" /> Important Dates
            </h3>
            <p><strong>Created:</strong> {formatDate(results.creation_date)}</p>
            <p><strong>Updated:</strong> {formatDate(results.updated_date)}</p>
            <p><strong>Expires:</strong> {formatDate(results.expiration_date)}</p>
          </div>
        </div>

        {nameServers.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center">
              <Server className="mr-2" /> Name Servers
            </h3>
            <div className="flex flex-wrap gap-2">
              {nameServers.map((ns, index) => (
                <Badge key={index} variant="secondary">{ns}</Badge>
              ))}
            </div>
          </div>
        )}

        {statuses.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center">
              <Shield className="mr-2" /> Domain Status
            </h3>
            <div className="flex flex-wrap gap-2">
              {statuses.map((status, index) => (
                <Badge key={index} variant="outline">{status}</Badge>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center">
              <User className="mr-2" /> Registrant Information
            </h3>
            <p><strong>Name:</strong> {text(results.name)}</p>
            <p><strong>Organization:</strong> {text(results.org)}</p>
            <p><strong>Email:</strong> {emails.length ? emails.join(', ') : 'N/A'}</p>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center">
              <MapPin className="mr-2" /> Address
            </h3>
            <p>{text(results.address, '')}</p>
            <p>{text(results.city, '')}{results.state ? `, ${results.state}` : ''} {text(results.registrant_postal_code, '')}</p>
            <p>{text(results.country, '')}</p>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Additional Information</h3>
          <p><strong>DNSSEC:</strong> {text(results.dnssec)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
