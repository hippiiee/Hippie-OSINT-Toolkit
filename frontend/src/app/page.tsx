import HippieOSINTToolkit from '@/components/main'
import { pageMetadata, siteName, siteDescription, siteUrl } from '@/lib/seo'

export const metadata = {
  ...pageMetadata('/', `${siteName} | Free OSINT Tools`, siteDescription),
  title: { absolute: `${siteName} | Free OSINT Tools` },
}

export default function Home() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${siteUrl}/#website`, name: 'Hippie OSINT Toolkit', alternateName: 'HOT', url: `${siteUrl}/`, description: siteDescription, inLanguage: 'en' },
      { '@type': 'SoftwareApplication', name: siteName, url: `${siteUrl}/`, description: siteDescription, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Web browser', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, sameAs: 'https://github.com/hippiiee/Hippie-OSINT-Toolkit' },
    ],
  }
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} />
    <HippieOSINTToolkit />
  </>
}
