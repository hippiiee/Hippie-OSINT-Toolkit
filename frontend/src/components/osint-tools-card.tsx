import React from 'react'
import { ExternalLink, LinkIcon } from 'lucide-react'

interface OsintTool {
  name: string
  url: string
  description: string
  icon?: string
}

interface OsintToolCardProps {
  tool: OsintTool
}

interface OsintToolsGridProps {
  tools: OsintTool[]
}

export const OsintToolCard: React.FC<OsintToolCardProps> = ({ tool }) => {
  return (
    <a 
      href={tool.url} 
      target="_blank" 
      rel="noopener noreferrer" 
      className="block bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden my-4 w-full md:w-1/2"
    >
      <div className="p-4 flex items-start space-x-4">
        <div className="flex-shrink-0">
          {tool.icon ? (
            <img src={tool.icon} alt={`${tool.name} icon`} className="w-10 h-10 rounded" />
          ) : (
            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
              <LinkIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
          )}
        </div>
        <div className="flex-grow">
          <h4 className="text-md font-semibold text-blue-600 dark:text-blue-400 mb-1 flex items-center">
            {tool.name}
            <ExternalLink className="ml-2 h-3 w-3" />
          </h4>
          <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">{tool.description}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{new URL(tool.url).hostname}</p>
        </div>
      </div>
    </a>
  )
}

export const OsintToolsGrid: React.FC<OsintToolsGridProps> = ({ tools }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
      {tools.map((tool, index) => (
        <div key={index} className="w-full">
          <OsintToolCard tool={tool} />
        </div>
      ))}
    </div>
  )
}