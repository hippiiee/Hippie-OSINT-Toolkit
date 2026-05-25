"""
DNS Deep Analysis Module

Full DNS record enumeration with SPF/DKIM/DMARC parsing,
TXT service detection, and zone transfer attempts.
"""

import asyncio
import logging
import re
from typing import Dict, Any, List, Optional

import dns.resolver
import dns.query
import dns.zone
import dns.rdatatype
import dns.name

from core.base_module import OsintModule

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lookup tables
# ---------------------------------------------------------------------------

SPF_INCLUDE_SERVICES: Dict[str, str] = {
    "_spf.google.com": "Google Workspace",
    "spf.google.com": "Google Workspace",
    "_netblocks.google.com": "Google Workspace",
    "sendgrid.net": "SendGrid",
    "spf.protection.outlook.com": "Microsoft 365",
    "amazonses.com": "Amazon SES",
    "mailgun.org": "Mailgun",
    "spf.mandrillapp.com": "Mandrill (Mailchimp)",
    "mail.zendesk.com": "Zendesk",
    "spf.sendinblue.com": "Brevo (Sendinblue)",
    "servers.mcsv.net": "Mailchimp",
    "mailsenders.netsuite.com": "NetSuite",
    "mktomail.com": "Marketo",
    "spf1.hubspot.com": "HubSpot",
    "hubspot.com": "HubSpot",
    "freshdesk.com": "Freshdesk",
    "postmarkapp.com": "Postmark",
    "sparkpostmail.com": "SparkPost",
    "zoho.com": "Zoho Mail",
    "transmail.net": "Zoho ZeptoMail",
    "pphosted.com": "Proofpoint",
    "firebasemail.com": "Firebase",
    "helpscoutemail.com": "Help Scout",
    "intercom.io": "Intercom",
    "mtasv.net": "Postmark",
    "sailthru.com": "Sailthru",
    "spf.dynect.net": "Dyn",
    "spf.smtp2go.com": "SMTP2GO",
    "emarsys.net": "Emarsys",
    "spf.messagelabs.com": "Symantec Email Security",
    "spf.constantcontact.com": "Constant Contact",
    "cust-spf.exacttarget.com": "Salesforce Marketing Cloud",
    "exacttarget.com": "Salesforce Marketing Cloud",
    "bluehost.com": "Bluehost",
    "mimecast.com": "Mimecast",
    "emailsrvr.com": "Rackspace Email",
    "icloud.com": "Apple iCloud",
    "protonmail.ch": "Proton Mail",
}

TXT_SERVICE_SIGNATURES: List[Dict[str, str]] = [
    {"pattern": "google-site-verification", "service": "Google Search Console"},
    {"pattern": "MS=", "service": "Microsoft 365"},
    {"pattern": "facebook-domain-verification", "service": "Facebook (Meta)"},
    {"pattern": "atlassian-domain-verification", "service": "Atlassian"},
    {"pattern": "docusign", "service": "DocuSign"},
    {"pattern": "apple-domain-verification", "service": "Apple"},
    {"pattern": "shopify-verification", "service": "Shopify"},
    {"pattern": "adobe-idp-site-verification", "service": "Adobe"},
    {"pattern": "adobe-sign-verification", "service": "Adobe Sign"},
    {"pattern": "amazonses:", "service": "Amazon SES"},
    {"pattern": "stripe-verification", "service": "Stripe"},
    {"pattern": "globalsign-domain-verification", "service": "GlobalSign"},
    {"pattern": "citrix-verification-code", "service": "Citrix"},
    {"pattern": "logmein-verification-code", "service": "LogMeIn"},
    {"pattern": "zoom-domain-verification", "service": "Zoom"},
    {"pattern": "have-i-been-pwned-verification", "service": "Have I Been Pwned"},
    {"pattern": "cisco-ci-domain-verification", "service": "Cisco (Webex)"},
    {"pattern": "webexdomainverification", "service": "Cisco Webex"},
    {"pattern": "dropbox-domain-verification", "service": "Dropbox"},
    {"pattern": "slack-domain-verification", "service": "Slack"},
    {"pattern": "miro-verification", "service": "Miro"},
    {"pattern": "notion-domain-verification", "service": "Notion"},
    {"pattern": "asana-domain-verification", "service": "Asana"},
    {"pattern": "hubspot-developer-verification", "service": "HubSpot"},
    {"pattern": "onetrust-domain-verification", "service": "OneTrust"},
    {"pattern": "canva-site-verification", "service": "Canva"},
    {"pattern": "brave-ledger-verification", "service": "Brave Rewards"},
    {"pattern": "zapier-domain-verification", "service": "Zapier"},
    {"pattern": "yandex-verification", "service": "Yandex Webmaster"},
    {"pattern": "pinterest-site-verification", "service": "Pinterest"},
    {"pattern": "linkedin-verification", "service": "LinkedIn"},
    {"pattern": "blitz=", "service": "Blitz"},
    {"pattern": "drift-domain-verification", "service": "Drift"},
    {"pattern": "twilio-domain-verification", "service": "Twilio"},
    {"pattern": "status-page-domain-verification", "service": "Atlassian Statuspage"},
    {"pattern": "teamviewer-sso-verification", "service": "TeamViewer"},
    {"pattern": "mongo-site-verification", "service": "MongoDB Atlas"},
]

DKIM_SELECTORS: List[str] = [
    "default",
    "google",
    "selector1",
    "selector2",
    "s1",
    "s2",
    "k1",
    "dkim",
    "mail",
    "protonmail",
    "protonmail2",
    "protonmail3",
]

RECORD_TYPES: List[str] = [
    "A",
    "AAAA",
    "MX",
    "NS",
    "TXT",
    "CAA",
    "SOA",
    "CNAME",
    "SRV",
]


# ---------------------------------------------------------------------------
# Module
# ---------------------------------------------------------------------------


class DnsModule(OsintModule):
    """Module for deep DNS analysis of a domain."""

    def __init__(self):
        super().__init__("dns")

    # ----- helpers ----------------------------------------------------------

    @staticmethod
    def _make_resolver() -> dns.resolver.Resolver:
        resolver = dns.resolver.Resolver()
        resolver.timeout = 5
        resolver.lifetime = 10
        return resolver

    @staticmethod
    def _rdata_to_str(rdata) -> str:
        return rdata.to_text().strip('"')

    # ----- individual query stages -----------------------------------------

    def _query_records(self, domain: str) -> Dict[str, List[str]]:
        """Query all standard record types for *domain*."""
        resolver = self._make_resolver()
        records: Dict[str, List[str]] = {}
        for rtype in RECORD_TYPES:
            try:
                answer = resolver.resolve(domain, rtype)
                records[rtype] = [self._rdata_to_str(r) for r in answer]
            except (
                dns.resolver.NoAnswer,
                dns.resolver.NXDOMAIN,
                dns.resolver.NoNameservers,
                dns.exception.Timeout,
                dns.resolver.NoMetaqueries,
                Exception,
            ):
                records[rtype] = []
        return records

    # -- SPF -----------------------------------------------------------------

    def _parse_spf(self, txt_records: List[str]) -> Optional[Dict[str, Any]]:
        """Find and parse the SPF record from TXT records."""
        spf_record = None
        for txt in txt_records:
            if txt.lower().startswith("v=spf1"):
                spf_record = txt
                break
        if not spf_record:
            return None

        includes: List[Dict[str, str]] = []
        ips: List[str] = []
        all_qualifier: Optional[str] = None

        parts = spf_record.split()
        for part in parts:
            lower = part.lower()
            if lower.startswith("include:"):
                include_domain = part.split(":", 1)[1]
                service = "Unknown"
                for pattern, name in SPF_INCLUDE_SERVICES.items():
                    if pattern in include_domain.lower():
                        service = name
                        break
                includes.append({"domain": include_domain, "service": service})
            elif lower.startswith("ip4:") or lower.startswith("ip6:"):
                ips.append(part.split(":", 1)[1])
            elif lower.startswith("a:") or lower.startswith("mx:"):
                # record a/mx mechanisms as-is
                pass
            elif lower.startswith("redirect="):
                includes.append(
                    {"domain": part.split("=", 1)[1], "service": "Redirect"}
                )

            # Detect the *all* qualifier — it can appear as +all, -all, ~all, ?all
            if re.match(r"^[+\-~?]?all$", lower):
                all_qualifier = part

        return {
            "raw": spf_record,
            "includes": includes,
            "ips": ips,
            "all_qualifier": all_qualifier,
        }

    # -- DMARC ---------------------------------------------------------------

    def _query_dmarc(self, domain: str) -> Optional[Dict[str, Any]]:
        """Query and parse the DMARC record for *domain*."""
        resolver = self._make_resolver()
        try:
            answers = resolver.resolve(f"_dmarc.{domain}", "TXT")
        except Exception:
            return None

        for rdata in answers:
            txt = self._rdata_to_str(rdata)
            if txt.lower().startswith("v=dmarc1"):
                return self._parse_dmarc(txt)
        return None

    @staticmethod
    def _parse_dmarc(raw: str) -> Dict[str, Any]:
        result: Dict[str, Any] = {"raw": raw}
        tags = [t.strip() for t in raw.split(";") if t.strip()]
        for tag in tags:
            if "=" not in tag:
                continue
            key, value = tag.split("=", 1)
            key = key.strip().lower()
            value = value.strip()
            if key == "p":
                result["policy"] = value.lower()
            elif key == "sp":
                result["subdomain_policy"] = value.lower()
            elif key == "rua":
                result["rua"] = [u.strip() for u in value.split(",")]
            elif key == "ruf":
                result["ruf"] = [u.strip() for u in value.split(",")]
            elif key == "pct":
                result["pct"] = value
            elif key == "adkim":
                result["adkim"] = value
            elif key == "aspf":
                result["aspf"] = value

        policy = result.get("policy", "none")
        result["spoofable"] = policy == "none"
        return result

    # -- DKIM ----------------------------------------------------------------

    def _probe_dkim(self, domain: str) -> List[Dict[str, Any]]:
        """Probe common DKIM selectors and return those that resolve."""
        resolver = self._make_resolver()
        found: List[Dict[str, Any]] = []
        for selector in DKIM_SELECTORS:
            qname = f"{selector}._domainkey.{domain}"
            try:
                answers = resolver.resolve(qname, "TXT")
                values = [self._rdata_to_str(r) for r in answers]
                found.append({"selector": selector, "record": " ".join(values)})
            except Exception:
                continue
        return found

    # -- TXT service detection -----------------------------------------------

    @staticmethod
    def _detect_services(txt_records: List[str]) -> List[Dict[str, str]]:
        detected: List[Dict[str, str]] = []
        seen: set = set()
        for txt in txt_records:
            for sig in TXT_SERVICE_SIGNATURES:
                if sig["pattern"].lower() in txt.lower() and sig["service"] not in seen:
                    detected.append({"service": sig["service"], "record": txt})
                    seen.add(sig["service"])
        return detected

    # -- Zone transfer -------------------------------------------------------

    def _attempt_zone_transfer(self, domain: str, ns_records: List[str]) -> Dict[str, Any]:
        """Attempt AXFR against each nameserver."""
        results: Dict[str, Any] = {"attempted": [], "success": False, "records": []}
        for ns in ns_records:
            ns_clean = ns.rstrip(".")
            results["attempted"].append(ns_clean)
            try:
                zone = dns.zone.from_xfr(
                    dns.query.xfr(ns_clean, domain, timeout=5, lifetime=10)
                )
                results["success"] = True
                for name, node in zone.nodes.items():
                    for rdataset in node.rdatasets:
                        for rdata in rdataset:
                            results["records"].append(
                                {
                                    "name": str(name),
                                    "type": dns.rdatatype.to_text(rdataset.rdtype),
                                    "value": rdata.to_text(),
                                }
                            )
                # If one NS succeeds, no need to try the rest
                break
            except Exception:
                continue
        return results

    # ----- main search ------------------------------------------------------

    async def search(self, domain: str, socketio, namespace: str, **kwargs) -> Dict[str, Any]:
        """
        Run a full DNS deep analysis on *domain*.
        """
        self.logger.info(f"Starting DNS deep analysis for: {domain}")
        cancel_event = kwargs.get("cancel_event")
        room = kwargs.get("room")

        try:
            # -- Stage 1: Standard records -----------------------------------
            self.emit_progress(socketio, namespace, 10, "Querying DNS records...", room=room)
            records = await asyncio.to_thread(self._query_records, domain)

            if self.handle_cancellation(cancel_event):
                return {"cancelled": True}

            # -- Stage 2: SPF parsing ----------------------------------------
            self.emit_progress(socketio, namespace, 30, "Analysing SPF record...", room=room)
            spf = self._parse_spf(records.get("TXT", []))

            if self.handle_cancellation(cancel_event):
                return {"cancelled": True}

            # -- Stage 3: DMARC ----------------------------------------------
            self.emit_progress(socketio, namespace, 45, "Querying DMARC record...", room=room)
            dmarc = await asyncio.to_thread(self._query_dmarc, domain)

            if self.handle_cancellation(cancel_event):
                return {"cancelled": True}

            # -- Stage 4: DKIM probing ---------------------------------------
            self.emit_progress(socketio, namespace, 60, "Probing DKIM selectors...", room=room)
            dkim = await asyncio.to_thread(self._probe_dkim, domain)

            if self.handle_cancellation(cancel_event):
                return {"cancelled": True}

            # -- Stage 5: TXT service detection ------------------------------
            self.emit_progress(socketio, namespace, 75, "Detecting services from TXT records...", room=room)
            services = self._detect_services(records.get("TXT", []))

            if self.handle_cancellation(cancel_event):
                return {"cancelled": True}

            # -- Stage 6: Zone transfer attempt ------------------------------
            self.emit_progress(socketio, namespace, 85, "Attempting zone transfer...", room=room)
            zone_transfer = await asyncio.to_thread(
                self._attempt_zone_transfer, domain, records.get("NS", [])
            )

            if self.handle_cancellation(cancel_event):
                return {"cancelled": True}

            # -- Assemble result ---------------------------------------------
            self.emit_progress(socketio, namespace, 95, "Compiling results...", room=room)

            result_data: Dict[str, Any] = {
                "domain": domain,
                "records": records,
                "spf": spf,
                "dmarc": dmarc,
                "dkim": dkim,
                "services": services,
                "zone_transfer": zone_transfer,
            }

            result = {
                "result": {
                    "module": "dns",
                    "results": result_data,
                }
            }

            self.emit_result(socketio, namespace, result, room=room)
            self.emit_progress(socketio, namespace, 100, "DNS analysis complete.", room=room)
            self.logger.info("DNS deep analysis completed")
            return result

        except Exception as e:
            error_msg = f"Error in DNS deep analysis: {str(e)}"
            self.logger.error(error_msg)
            self.emit_error(socketio, namespace, error_msg, room=room)
            return {"error": error_msg}


# Create a singleton instance for import
dns_module = DnsModule()
