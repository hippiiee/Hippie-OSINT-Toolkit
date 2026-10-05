import { notFound } from 'next/navigation'
import HippieOSINTToolkit from '@/components/main'
import { pageMetadata, toolPages, type ToolSlug } from '@/lib/seo'

export const dynamicParams = false

export function generateStaticParams() {
  return Object.keys(toolPages).map(tool => ({ tool }))
}

function getTool(tool: string): ToolSlug {
  if (!Object.prototype.hasOwnProperty.call(toolPages, tool)) notFound()
  return tool as ToolSlug
}

export async function generateMetadata({ params }: { params: Promise<{ tool: string }> }) {
  const tool = getTool((await params).tool)
  const { title, description } = toolPages[tool]
  return pageMetadata(`/tools/${tool}`, title, description)
}

export default async function ToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const tool = getTool((await params).tool)
  return <HippieOSINTToolkit selectedTool={tool} />
}
