// Per-TLD WHOIS fallback registry.
// Some registries (Red.es, DENIC, SIDN, etc.) block port-43 WHOIS and/or RDAP,
// so the only way to query the data is through their captcha-protected web form.

export interface RegistryInfo {
  /** Human-friendly registry name shown in the UI. */
  name: string;
  /** Direct URL to look up a domain (preferred). Use {domain} placeholder. */
  lookupUrl: string;
  /** Short reason explaining why the data isn't available programmatically. */
  reason: string;
}

const REGISTRIES: Record<string, RegistryInfo> = {
  es: {
    name: "Red.es",
    lookupUrl: "https://www.dominios.es/en",
    reason: "Red.es (the .es registry) blocks port-43 WHOIS and does not publish RDAP. Their public lookup form is captcha-protected.",
  },
  de: {
    name: "DENIC",
    lookupUrl: "https://webwhois.denic.de/?lang=en&query={domain}",
    reason: "DENIC retired port-43 WHOIS in 2023. Domain data is available via their RDAP service or web form.",
  },
  nl: {
    name: "SIDN",
    lookupUrl: "https://www.sidn.nl/en/whois?q={domain}",
    reason: "SIDN restricts public WHOIS to a rate-limited web form for privacy reasons.",
  },
  fr: {
    name: "AFNIC",
    lookupUrl: "https://www.afnic.fr/en/domain-names-and-support/everything-there-is-to-know-about-domain-names/find-a-domain-name-or-a-holder-using-whois/",
    reason: "AFNIC rate-limits programmatic WHOIS queries and prefers their web form.",
  },
  it: {
    name: "Registro .it",
    lookupUrl: "https://web-whois.nic.it/?lang=en",
    reason: "The .it registry limits public WHOIS data and provides it through their web form.",
  },
  ru: {
    name: "RU-CENTER",
    lookupUrl: "https://www.nic.ru/en/whois/?searchWord={domain}",
    reason: ".ru WHOIS port-43 access is heavily rate-limited.",
  },
  ch: {
    name: "SWITCH",
    lookupUrl: "https://www.nic.ch/whois/?objectName={domain}",
    reason: "SWITCH restricts public WHOIS and prefers RDAP / web form.",
  },
  li: {
    name: "SWITCH",
    lookupUrl: "https://www.nic.li/whois/?objectName={domain}",
    reason: "SWITCH restricts public WHOIS and prefers RDAP / web form.",
  },
  br: {
    name: "NIC.br",
    lookupUrl: "https://registro.br/tecnologia/ferramentas/whois/?search={domain}",
    reason: "NIC.br rate-limits port-43 queries; use their web form for reliable results.",
  },
};

const ICANN_LOOKUP = "https://lookup.icann.org/en/lookup?name={domain}";

/** Return registry info for the TLD of a domain, or a fallback to ICANN's lookup. */
export function getTldRegistry(domain: string): RegistryInfo {
  const tld = domain.toLowerCase().split(".").pop() ?? "";
  const hit = REGISTRIES[tld];
  if (hit) {
    return { ...hit, lookupUrl: hit.lookupUrl.replace("{domain}", encodeURIComponent(domain)) };
  }
  return {
    name: "ICANN Lookup",
    lookupUrl: ICANN_LOOKUP.replace("{domain}", encodeURIComponent(domain)),
    reason: "The registry's WHOIS server returned no data. You can try ICANN's lookup as a fallback.",
  };
}
