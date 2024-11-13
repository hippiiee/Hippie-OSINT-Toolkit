import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, Globe, Server, Shield, User, Building, MapPin } from 'lucide-react'

interface WhoisResult {
  module: string;
  results: {
    domain_name: string;
    registrar: string;
    whois_server: string;
    referral_url: string | null;
    updated_date: string | string[];
    creation_date: string | string[];
    expiration_date: string | string[];
    name_servers: string[];
    status: string[];
    emails: string;
    dnssec: string;
    name: string;
    org: string | null;
    address: string;
    city: string;
    state: string | null;
    registrant_postal_code: string;
    country: string;
  };
}

export default function WhoisResult({ data }: { data: WhoisResult }) {
  const { results } = data;

  const formatDate = (dateString: string | string[]) => {
    const date = Array.isArray(dateString) ? dateString[0] : dateString;
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-bold flex items-center">
          <Globe className="mr-2" />
          WHOIS Information for {results.domain_name}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center">
              <Building className="mr-2" /> Registrar Details
            </h3>
            <p><strong>Registrar:</strong> {results.registrar}</p>
            <p><strong>WHOIS Server:</strong> {results.whois_server}</p>
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

        <div>
          <h3 className="text-lg font-semibold mb-2 flex items-center">
            <Server className="mr-2" /> Name Servers
          </h3>
          <div className="flex flex-wrap gap-2">
            {results.name_servers.map((ns, index) => (
              <Badge key={index} variant="secondary">{ns}</Badge>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2 flex items-center">
            <Shield className="mr-2" /> Domain Status
          </h3>
          <div className="flex flex-wrap gap-2">
            {results.status.map((status, index) => (
              <Badge key={index} variant="outline">{status}</Badge>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center">
              <User className="mr-2" /> Registrant Information
            </h3>
            <p><strong>Name:</strong> {results.name}</p>
            <p><strong>Organization:</strong> {results.org || 'N/A'}</p>
            <p><strong>Email:</strong> {results.emails}</p>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center">
              <MapPin className="mr-2" /> Address
            </h3>
            <p>{results.address}</p>
            <p>{results.city}{results.state ? `, ${results.state}` : ''} {results.registrant_postal_code}</p>
            <p>{results.country}</p>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Additional Information</h3>
          <p><strong>DNSSEC:</strong> {results.dnssec}</p>
        </div>
      </CardContent>
    </Card>
  );
}