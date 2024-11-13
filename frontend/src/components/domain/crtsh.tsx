import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Server, ExternalLink } from 'lucide-react'

interface CrtshResultProps {
  data: {
    module: string;
    results: string[];
  };
}

export default function CrtshResult({ data }: CrtshResultProps) {
  const uniqueSubdomains = Array.from(new Set(data.results.flatMap(subdomain => subdomain.split('\n'))));

  const formatSubdomain = (subdomain: string) => {
    if (subdomain.startsWith('*.')) {
      return subdomain;
    }
    return `https://${subdomain}`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-bold flex items-center">
          <Server className="mr-2" />
          Subdomains from crt.sh
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] w-full rounded-md border p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {uniqueSubdomains.map((subdomain, index) => (
              <Badge 
                key={`${subdomain}-${index}`} 
                variant="secondary" 
                className="text-sm justify-start hover:bg-secondary/80 transition-colors"
              >
                {subdomain.startsWith('*.') ? (
                  subdomain
                ) : (
                  <a 
                    href={formatSubdomain(subdomain)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center"
                  >
                    {subdomain}
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                )}
              </Badge>
            ))}
          </div>
        </ScrollArea>
        <p className="mt-4 text-sm text-muted-foreground">
          Total unique subdomains found: {uniqueSubdomains.length}
        </p>
      </CardContent>
    </Card>
  );
}