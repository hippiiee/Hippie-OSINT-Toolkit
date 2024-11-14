'use client'

import { useState, useRef } from 'react'
import { Search, ExternalLink, LinkIcon } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArticleImage } from '@/components/image'

interface ArticleSection {
  id: string
  title: string
  level: number
}

interface OsintTool {
  name: string
  url: string
  description: string
  icon?: string
}

interface OsintToolCardProps {
  tool: OsintTool
  isGrid?: boolean
}

interface OsintToolsGridProps {
  tools: OsintTool[]
}

const ArticleNavigation: React.FC<{ sections: ArticleSection[] }> = ({ sections }) => {
  return (
    <nav className="space-y-1">
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className={`block py-2 px-3 text-sm rounded transition-colors ${
            section.level === 1 ? 'font-semibold' : 'ml-4'
          } hover:bg-gray-100 text-blue-600 hover:text-blue-800`}
        >
          {section.title}
        </a>
      ))}
    </nav>
  )
}

const OsintToolCard: React.FC<OsintToolCardProps> = ({ tool, isGrid = false }) => {
  return (
    <a 
      href={tool.url} 
      target="_blank" 
      rel="noopener noreferrer" 
      className={`block bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden my-4 ${isGrid ? 'w-full' : 'w-full md:w-1/2'}`}
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

const OsintToolsGrid: React.FC<OsintToolsGridProps> = ({ tools }) => {
  if (tools.length === 1) {
    return <OsintToolCard tool={tools[0]} />
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
      {tools.map((tool, index) => (
        <OsintToolCard key={index} tool={tool} isGrid={true} />
      ))}
    </div>
  )
}

export default function ImageSearch() {
  const [imageUrl, setImageUrl] = useState('')

  const articleSections: ArticleSection[] = [
    { id: 'reverse-image-search', title: 'Reverse Image Search', level: 1 },
    { id: 'identifying-location', title: 'Identifying Location', level: 1 },
    { id: 'extracting-metadata', title: 'Extracting Metadata', level: 1 },
    { id: 'facial-recognition', title: 'Facial Recognition', level: 1 },
    { id: 'miscellaneous-techniques', title: 'Miscellaneous Techniques', level: 1 },
  ]

  const osintTools = {
    googleLens: { 
      name: 'Google Lens', 
      url: 'https://lens.google.com/', 
      description: 'A versatile tool for finding similar images and identifying objects, text, and landmarks.',
      icon: 'https://www.gstatic.com/images/branding/product/2x/lens_96dp.png'
    },
    tinEye: { 
      name: 'TinEye', 
      url: 'https://tineye.com/', 
      description: 'Specializes in finding exact matches and modified versions of an image.',
      icon: 'https://tineye.com/favicon.ico'
    },
    yandex: { 
      name: 'Yandex', 
      url: 'https://yandex.com/images/', 
      description: 'Often yields different results compared to Google, especially for images from Eastern Europe and Russia.',
      icon: 'https://yastatic.net/s3/home-static/_/37/37a02b5dc7a51abac55d8a5b6c865f0e.png'
    },
    pimEyes: { 
      name: 'PimEyes', 
      url: 'https://pimeyes.com/en', 
      description: 'A powerful facial recognition search engine for finding appearances of a person across the internet.',
      icon: 'https://pimeyes.com/favicon.ico'
    },
    cleanupPictures: { 
      name: 'Cleanup.pictures', 
      url: 'https://cleanup.pictures/', 
      description: 'A tool that allows you to remove objects from images for isolating specific elements.',
      icon: 'https://cleanup.pictures/favicon.ico'
    },
    sunCalc: {
      name: 'SunCalc',
      url: 'https://suncalc.org/',
      description: 'A tool that helps determine the position of the sun at any given time and location.',
      icon: 'https://suncalc.org/favicon.ico'
    },
    geospy: {
      name: 'Geospy.ai',
      url: 'https://geospy.ai/',
      description: 'An AI-powered tool that analyzes images to suggest possible locations based on visual characteristics.',
      icon: 'https://geospy.ai/favicon_2.png'
    },
    overpassTurbo: {
      name: 'Overpass Turbo',
      url: 'https://overpass-turbo.eu/',
      description: 'A web-based data mining tool for OpenStreetMap that allows users to extract specific geographic data.',
      icon: 'https://overpass-turbo.eu/assets/favicon.ico'
    },
    forensically: {
      name: 'Forensically',
      url: 'https://29a.ch/photo-forensics',
      description: 'An online tool that can extract metadata from images.',
      icon: '/images/tools_icon/29ach_logo.png'
    }
  }

  const performSearch = (engine: string) => {
    let searchUrl = ''
    switch (engine) {
      case 'yandex':
        searchUrl = 'https://yandex.com/images/search?rpt=imageview&url='
        break
      case 'google':
        searchUrl = 'https://lens.google.com/uploadbyurl?url='
        break
      default:
        return
    }

    if (imageUrl) {
      window.open(searchUrl + encodeURIComponent(imageUrl), '_blank')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Image Search</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Reverse Image Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-md mx-auto">
            <Input
              type="url"
              placeholder="Enter image URL"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="mb-4"
            />
          </div>
          <div className="flex justify-center space-x-4 mt-4">
            <Button onClick={() => performSearch('yandex')} disabled={!imageUrl} size="sm">
              <Search className="mr-2 h-4 w-4" /> Yandex
            </Button>
            <Button onClick={() => performSearch('google')} disabled={!imageUrl} size="sm">
              <Search className="mr-2 h-4 w-4" /> Google
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>OSINT Techniques for Images</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row">
            <div className="lg:w-3/4 pr-6">
              <div className="lg:hidden mb-6">
                <h4 className="text-lg font-semibold mb-2">Table of Contents</h4>
                <ArticleNavigation sections={articleSections} />
              </div>
              <div className="article-content">
                <h2 id="reverse-image-search">Reverse Image Search</h2>
                <p>Few search engines that can do reverse image search:</p>
                <ul>
                  <li><strong>Google Lens:</strong> The most well-known tool that not only finds similar images but can also identify objects, text, and landmarks within an image. It's particularly useful for identifying products or places.</li>
                  <li><strong>TinEye:</strong> Specializes in finding exact matches and modified versions of an image. It's working well for tracking the origin and spread of an image online.</li>
                </ul>
                <OsintToolsGrid tools={[osintTools.googleLens, osintTools.tinEye]} />
                <ul>
                  <li><strong>Yandex:</strong> Often yields different results compared to Google, can do reverse person search as well (especially for images from Eastern Europe and Russia).</li>
                </ul>
                <OsintToolCard tool={osintTools.yandex} />

                <h2 id="identifying-location">Identifying Location</h2>
                <p>Geolocating an image can help you to find context and verify claims about where a photo was taken.</p>
                <ul>
                  <li><strong>Overpass Turbo:</strong> A web-based data mining tool for OpenStreetMap. It allows you to write queries to extract specific geographic data, when you know how to use it it's a very powerful tool. For example, you could use it to find all fountains in a city that are next to a park.</li>
                  <li><strong>Geospy.ai:</strong> An AI-powered tool that analyzes images to suggest possible locations based on visual characteristics like architecture, vegetation, and terrain. It's particularly useful for narrowing down the search area when you have limited initial information.</li>
                </ul>
                <OsintToolsGrid tools={[osintTools.overpassTurbo, osintTools.geospy]} />
                <ul>
                  <li><strong>SunCalc:</strong> This tool helps you to determine the position of the sun at any given time and location. It's useful for verifying the time and date of outdoor photos by analyzing shadows and lighting conditions.</li>
                </ul>
                <OsintToolCard tool={osintTools.sunCalc} />

                <h2 id="extracting-metadata">Extracting Metadata</h2>
                <p>Don't forget to check the metadata of the image. Most social networks will remove the metadata when you upload the image, but a few will keep it. You can retrieve information such as camera make and model, date and time of capture, camera settings, and sometimes GPS coordinates.</p>
                <ul>
                  <li><strong>exiftools:</strong> A command-line utility that can extract EXIF data from images.</li>
                  <li><strong>Forensically:</strong> An online tool that can extract metadata from images, as well as perform other forensic analyses.</li>
                </ul>
                <OsintToolCard tool={osintTools.forensically} />

                <h2 id="facial-recognition">Facial Recognition</h2>
                <p>Most reverse image search engines don't allow you to search by face, but you can use dedicated tools for that.</p>
                <ul>
                  <li><strong>PimEyes:</strong> A powerful facial recognition search engine that can find appearances of a person across the internet. They have a few free tries that can help you to identify an identity.</li>
                </ul>
                <OsintToolCard tool={osintTools.pimEyes} />

                <h2 id="miscellaneous-techniques">Miscellaneous Techniques</h2>
                <p>Additional tools and techniques that can be useful in specific scenarios.</p>
                <ul>
                  <li><strong>Cleanup.pictures:</strong> I you this tool to quickly remove objects from images, which can be useful for isolating specific elements for further analysis. For instance, you could remove a distracting object to do a reverse image search on the background.</li>
                </ul>
                <OsintToolCard tool={osintTools.cleanupPictures} />
              </div>
            </div>
            <div className="hidden lg:block lg:w-1/4 mt-6 lg:mt-0">
              <div className="sticky top-6">
                <h4 className="text-lg font-semibold mb-2">Table of Contents</h4>
                <ArticleNavigation sections={articleSections} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}