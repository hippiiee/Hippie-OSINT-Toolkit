import type { MetadataRoute } from 'next'
import { siteUrl, toolPages } from '@/lib/seo'

export default function sitemap(): MetadataRoute.Sitemap {
  return ['/', ...Object.keys(toolPages).map(tool => `/tools/${tool}`)].map(path => ({ url: `${siteUrl}${path}` }))
}
