import type { Metadata } from 'next'

export const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://osint.hippie.cat').origin
export const siteName = 'Hippie OSINT Toolkit (HOT)'
export const siteDescription = 'Explore free, open-source OSINT tools and guides for domain research, reverse image search, username searches, and social media investigations.'

export const toolPages = {
  domain: { title: 'Domain OSINT Tools', description: 'Research domains with WHOIS, DNS records, certificate transparency and archived pages. Explore domain research tools and OSINT guides.' },
  image: { title: 'Reverse Image Search & Image OSINT', description: 'Explore reverse image search with Google Lens and Yandex, image analysis techniques, metadata and geolocation resources in HOT.' },
  username: { title: 'Username Search Across Platforms', description: 'Search usernames across platforms with WhatsMyName and socid-extractor. Discover username research tools in Hippie OSINT Toolkit.' },
  ip: { title: 'IP Address Intelligence', description: 'Look up public IP address information with Shodan InternetDB and learn about IP intelligence, open ports and related OSINT resources.' },
  crypto: { title: 'Bitcoin & Ethereum Address Research', description: 'Explore public Bitcoin and Ethereum address information and blockchain research tools with Hippie OSINT Toolkit.' },
  tiktok: { title: 'TikTok Profile & Video Timestamp Tools', description: 'Look up public TikTok profile information and extract video upload timestamps. Learn about TikTok identifiers and OSINT techniques.' },
  google: { title: 'Google Account OSINT with GHunt', description: 'Explore Google account research with GHunt and learn about publicly available account information in Hippie OSINT Toolkit.' },
  reddit: { title: 'Reddit Profile Research', description: 'Look up public Reddit user details and explore account research tools with Hippie OSINT Toolkit.' },
  github: { title: 'GitHub Profile Research', description: 'Explore public GitHub profile information, repositories and account research guides with Hippie OSINT Toolkit.' },
  mastodon: { title: 'Mastodon User & Instance Search', description: 'Search public Mastodon users and instances and explore Fediverse research techniques with Hippie OSINT Toolkit.' },
  discord: { title: 'Discord User Lookup', description: 'Look up available Discord user information and learn about Discord identifiers with Hippie OSINT Toolkit.' },
  telegram: { title: 'Telegram User & Channel Lookup', description: 'Explore public Telegram user and channel information with the Telegram research tools in Hippie OSINT Toolkit.' },
} as const

export type ToolSlug = keyof typeof toolPages

export function pageMetadata(path: string, title: string, description: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website', locale: 'en_US', siteName, url: path, title, description,
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: siteName }],
    },
    twitter: {
      card: 'summary_large_image', title, description,
      images: ['/opengraph-image'],
    },
  }
}
