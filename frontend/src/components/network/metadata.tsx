'use client'

import React, { useState, useRef, useCallback } from 'react'
import {
  Upload,
  Loader2,
  AlertCircle,
  Info,
  FileText,
  Camera,
  MapPin,
  Hash,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  File,
  Image as ImageIcon,
  Link as LinkIcon,
} from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface GpsData {
  latitude: number
  longitude: number
  google_maps_url: string
  altitude?: number
}

interface CameraInfo {
  make?: string
  model?: string
  lens?: string
  datetime_original?: string
  datetime?: string
  software?: string
  orientation?: number
  focal_length?: number
  aperture?: number
  iso?: number
  exposure_time?: number
}

interface ImageResult {
  file_type: 'image'
  format: string
  width: number
  height: number
  mode: string
  camera_info: CameraInfo | null
  gps: GpsData | null
  exif: Record<string, any> | null
  hashes: { md5: string; sha256: string }
  file_size: number
  filename: string
}

interface PdfResult {
  file_type: 'pdf'
  filename: string
  page_count: number
  metadata: Record<string, string> | null
  hashes: { md5: string; sha256: string }
  file_size: number
}

interface DocxResult {
  file_type: 'docx'
  filename: string
  metadata: Record<string, string> | null
  hashes: { md5: string; sha256: string }
  file_size: number
}

type MetadataResult = ImageResult | PdfResult | DocxResult

const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.tiff,.tif,.webp,.pdf,.docx'
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function friendlyKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HashSection({ hashes, fileSize }: { hashes: { md5: string; sha256: string }; fileSize: number }) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-2 flex items-center">
        <Hash className="mr-2 h-5 w-5" />
        File Hashes
      </h3>
      <div className="space-y-2 text-sm">
        <p><span className="font-medium">File Size:</span> {formatFileSize(fileSize)}</p>
        <p className="break-all"><span className="font-medium">MD5:</span> <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">{hashes.md5}</code></p>
        <p className="break-all"><span className="font-medium">SHA256:</span> <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">{hashes.sha256}</code></p>
      </div>
    </div>
  )
}

function ImageResults({ data }: { data: ImageResult }) {
  const [showAllExif, setShowAllExif] = useState(false)
  const cam = data.camera_info

  return (
    <div className="space-y-6">
      {/* Image info */}
      <div>
        <h3 className="text-lg font-semibold mb-2 flex items-center">
          <ImageIcon className="mr-2 h-5 w-5" />
          Image Information
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="font-medium block text-gray-500 dark:text-gray-400">Dimensions</span>
            {data.width} x {data.height}
          </div>
          <div>
            <span className="font-medium block text-gray-500 dark:text-gray-400">Format</span>
            {data.format}
          </div>
          <div>
            <span className="font-medium block text-gray-500 dark:text-gray-400">Color Mode</span>
            {data.mode}
          </div>
          <div>
            <span className="font-medium block text-gray-500 dark:text-gray-400">File Size</span>
            {formatFileSize(data.file_size)}
          </div>
        </div>
      </div>

      <Separator />

      {/* Camera info */}
      <div>
        <h3 className="text-lg font-semibold mb-2 flex items-center">
          <Camera className="mr-2 h-5 w-5" />
          Camera Information
        </h3>
        {cam ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {cam.make && (
              <div><span className="font-medium text-gray-500 dark:text-gray-400">Make:</span> {cam.make}</div>
            )}
            {cam.model && (
              <div><span className="font-medium text-gray-500 dark:text-gray-400">Model:</span> {cam.model}</div>
            )}
            {cam.lens && (
              <div><span className="font-medium text-gray-500 dark:text-gray-400">Lens:</span> {cam.lens}</div>
            )}
            {cam.focal_length != null && (
              <div><span className="font-medium text-gray-500 dark:text-gray-400">Focal Length:</span> {cam.focal_length} mm</div>
            )}
            {cam.aperture != null && (
              <div><span className="font-medium text-gray-500 dark:text-gray-400">Aperture:</span> f/{cam.aperture}</div>
            )}
            {cam.iso != null && (
              <div><span className="font-medium text-gray-500 dark:text-gray-400">ISO:</span> {cam.iso}</div>
            )}
            {cam.exposure_time != null && (
              <div><span className="font-medium text-gray-500 dark:text-gray-400">Exposure:</span> {cam.exposure_time}s</div>
            )}
            {cam.software && (
              <div><span className="font-medium text-gray-500 dark:text-gray-400">Software:</span> {cam.software}</div>
            )}
            {(cam.datetime_original || cam.datetime) && (
              <div className="sm:col-span-2">
                <span className="font-medium text-gray-500 dark:text-gray-400">Date Taken:</span> {cam.datetime_original || cam.datetime}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No camera information found in this image.</p>
        )}
      </div>

      <Separator />

      {/* GPS */}
      <div>
        <h3 className="text-lg font-semibold mb-2 flex items-center">
          <MapPin className="mr-2 h-5 w-5" />
          GPS Location
        </h3>
        {data.gps ? (
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium text-gray-500 dark:text-gray-400">Latitude:</span> {data.gps.latitude}
            </p>
            <p>
              <span className="font-medium text-gray-500 dark:text-gray-400">Longitude:</span> {data.gps.longitude}
            </p>
            {data.gps.altitude != null && (
              <p>
                <span className="font-medium text-gray-500 dark:text-gray-400">Altitude:</span> {data.gps.altitude} m
              </p>
            )}
            <a
              href={data.gps.google_maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-purple-600 dark:text-purple-400 hover:underline font-medium mt-1"
            >
              View on Google Maps
              <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No GPS data found in this image.</p>
        )}
      </div>

      <Separator />

      {/* All EXIF fields */}
      {data.exif && Object.keys(data.exif).length > 0 && (
        <div>
          <button
            onClick={() => setShowAllExif(!showAllExif)}
            className="flex items-center text-lg font-semibold mb-2 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
          >
            <FileText className="mr-2 h-5 w-5" />
            All EXIF Fields ({Object.keys(data.exif).length})
            {showAllExif ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            )}
          </button>
          {showAllExif && (
            <ScrollArea className="max-h-[400px]">
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800">
                      <th className="text-left px-4 py-2 font-medium">Tag</th>
                      <th className="text-left px-4 py-2 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.exif).map(([key, val]) => (
                      <tr key={key} className="border-t border-gray-200 dark:border-gray-700">
                        <td className="px-4 py-2 font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">{key}</td>
                        <td className="px-4 py-2 break-all">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          )}
        </div>
      )}

      <Separator />

      <HashSection hashes={data.hashes} fileSize={data.file_size} />
    </div>
  )
}

function PdfResults({ data }: { data: PdfResult }) {
  const meta = data.metadata

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2 flex items-center">
          <FileText className="mr-2 h-5 w-5" />
          PDF Information
        </h3>
        <div className="space-y-2 text-sm">
          <p><span className="font-medium text-gray-500 dark:text-gray-400">Filename:</span> {data.filename}</p>
          <p><span className="font-medium text-gray-500 dark:text-gray-400">Page Count:</span> {data.page_count}</p>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-lg font-semibold mb-2">Document Metadata</h3>
        {meta && Object.keys(meta).length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {Object.entries(meta).map(([key, val]) => (
              <div key={key}>
                <span className="font-medium text-gray-500 dark:text-gray-400">{friendlyKey(key)}:</span> {String(val)}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No metadata found in this PDF.</p>
        )}
      </div>

      <Separator />

      <HashSection hashes={data.hashes} fileSize={data.file_size} />
    </div>
  )
}

function DocxResults({ data }: { data: DocxResult }) {
  const meta = data.metadata

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2 flex items-center">
          <FileText className="mr-2 h-5 w-5" />
          DOCX Information
        </h3>
        <div className="space-y-2 text-sm">
          <p><span className="font-medium text-gray-500 dark:text-gray-400">Filename:</span> {data.filename}</p>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-lg font-semibold mb-2">Document Metadata</h3>
        {meta && Object.keys(meta).length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {Object.entries(meta).map(([key, val]) => (
              <div key={key}>
                <span className="font-medium text-gray-500 dark:text-gray-400">{friendlyKey(key)}:</span> {String(val)}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No metadata found in this document.</p>
        )}
      </div>

      <Separator />

      <HashSection hashes={data.hashes} fileSize={data.file_size} />
    </div>
  )
}

function ResultSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-6 w-48 mb-3" />
        <Skeleton className="h-4 w-64 mb-2" />
        <Skeleton className="h-4 w-48 mb-2" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Separator />
      <div>
        <Skeleton className="h-6 w-40 mb-3" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
      <Separator />
      <div>
        <Skeleton className="h-6 w-32 mb-3" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Article helpers
// ---------------------------------------------------------------------------

interface ArticleSection {
  id: string;
  title: string;
  level: number;
}

interface OsintTool {
  name: string;
  url: string;
  description: string;
  icon?: string;
}

interface OsintToolCardProps {
  tool: OsintTool;
  isSingle?: boolean;
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

const OsintToolCard: React.FC<OsintToolCardProps> = ({ tool, isSingle = false }) => {
  return (
    <a
      href={tool.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden my-4 ${isSingle ? 'w-1/2' : 'w-full'}`}
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
    return <OsintToolCard tool={tools[0]} isSingle={true} />
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
      {tools.map((tool, index) => (
        <OsintToolCard key={index} tool={tool} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function MetadataTools() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [results, setResults] = useState<MetadataResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const articleRef = useRef<HTMLDivElement>(null)

  const articleSections: ArticleSection[] = [
    { id: 'what-is-metadata', title: 'What is Metadata?', level: 1 },
    { id: 'exif-data-in-images', title: 'EXIF Data in Images', level: 2 },
    { id: 'gps-geolocation', title: 'GPS Geolocation from Photos', level: 2 },
    { id: 'pdf-metadata', title: 'PDF Metadata', level: 2 },
    { id: 'docx-metadata', title: 'Document (DOCX) Metadata', level: 2 },
    { id: 'protecting-against-leaks', title: 'Protecting Against Metadata Leaks', level: 2 },
    { id: 'osint-tools', title: 'OSINT Tools for Metadata', level: 1 },
  ]

  const osintTools: OsintTool[] = [
    {
      name: 'ExifTool',
      url: 'https://exiftool.org/',
      description: 'Read, write and edit metadata in hundreds of file formats',
      icon: 'https://exiftool.org/favicon.ico',
    },
    {
      name: 'FOCA',
      url: 'https://github.com/ElevenPaths/FOCA',
      description: 'Extract metadata and hidden information from documents',
      icon: 'https://github.com/ElevenPaths.png',
    },
    {
      name: 'Metagoofil',
      url: 'https://github.com/opsdisk/metagoofil',
      description: 'Extract metadata from public documents on a domain',
      icon: 'https://github.com/opsdisk.png',
    },
    {
      name: "Jeffrey's EXIF Viewer",
      url: 'https://exif.regex.info/exif.cgi',
      description: 'Online EXIF data viewer for images',
      icon: '/images/tools_icon/exif_viewer_logo.ico',
    },
  ]

  const handleFileSelect = useCallback((file: File) => {
    setError(null)
    setResults(null)

    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)} MB.`)
      setSelectedFile(null)
      return
    }

    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    const allowed = ACCEPTED_EXTENSIONS.split(',')
    if (!allowed.includes(ext)) {
      setError(`Unsupported file type '${ext}'. Supported formats: ${allowed.join(', ')}`)
      setSelectedFile(null)
      return
    }

    setSelectedFile(file)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files?.[0]
      if (file) handleFileSelect(file)
    },
    [handleFileSelect],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFileSelect(file)
    },
    [handleFileSelect],
  )

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsLoading(true)
    setError(null)
    setResults(null)

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API || 'http://localhost:5000'

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch(`${backendUrl}/api/metadata/extract`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || `Server error (${response.status})`)
        return
      }

      if (data.error) {
        setError(data.error)
        return
      }

      if (data.result?.results) {
        setResults(data.result.results as MetadataResult)
      } else {
        setError('Unexpected response format from server.')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to the server.')
    } finally {
      setIsLoading(false)
    }
  }

  const renderResults = () => {
    if (!results) return null

    switch (results.file_type) {
      case 'image':
        return <ImageResults data={results as ImageResult} />
      case 'pdf':
        return <PdfResults data={results as PdfResult} />
      case 'docx':
        return <DocxResults data={results as DocxResult} />
      default:
        return <p className="text-sm text-gray-500">Unknown file type.</p>
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">File Metadata</h1>

      {/* Info card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Info className="mr-2 h-5 w-5" />
            What data can be found?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 space-y-1">
            <li>EXIF data from images: GPS coordinates, camera make/model, lens, dates</li>
            <li>PDF metadata: author, creator, producer, creation and modification dates</li>
            <li>DOCX metadata: author, last modified by, revision, title, dates</li>
            <li>File hashes: MD5 and SHA256 for integrity verification</li>
          </ul>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="text-sm text-gray-500 dark:text-gray-400 mr-1">Supported formats:</span>
            {['JPEG', 'PNG', 'TIFF', 'WebP', 'PDF', 'DOCX'].map((fmt) => (
              <Badge key={fmt} variant="secondary">{fmt}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
          ${isDragOver
            ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30'
            : 'border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500 bg-gray-50 dark:bg-gray-900'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleInputChange}
          className="hidden"
        />
        <File className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-3" />
        {selectedFile ? (
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{selectedFile.name}</p>
            <p className="text-xs text-gray-500 mt-1">{formatFileSize(selectedFile.size)}</p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Drop file here or click to browse
            </p>
            <p className="text-xs text-gray-500 mt-1">Max 20 MB</p>
          </div>
        )}
      </div>

      {/* Upload button */}
      <Button
        onClick={handleUpload}
        disabled={!selectedFile || isLoading}
        className="w-full sm:w-auto"
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-2 h-4 w-4" />
        )}
        {isLoading ? 'Extracting metadata...' : 'Extract Metadata'}
      </Button>

      {/* Error display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results */}
      {(isLoading || results) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="mr-2 h-5 w-5" />
              Extraction Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ResultSkeleton />
            ) : (
              <ScrollArea className="max-h-[700px]">
                {renderResults()}
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* Educational article */}
      <Card>
        <CardHeader>
          <CardTitle>File Metadata and EXIF Data for OSINT</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row">
            <div className="lg:w-3/4 pr-6">
              <div className="lg:hidden mb-6">
                <h4 className="text-lg font-semibold mb-2">Table of Contents</h4>
                <ArticleNavigation sections={articleSections} />
              </div>
              <div className="article-content" ref={articleRef}>
                <h2 id="what-is-metadata">What is Metadata?</h2>
                <p>Metadata is &quot;data about data&quot;, information embedded in files that describes how, when, where, and by whom the file was created. Most people don&apos;t realize their files contain this hidden information, which can be useful for OSINT investigations.</p>
                <p>Different file types store different kinds of metadata: EXIF for images, XMP for PDFs, and Dublin Core for documents. Understanding these formats is useful for extracting useful intelligence from files found online.</p>

                <h3 id="exif-data-in-images">EXIF Data in Images</h3>
                <p>EXIF (Exchangeable Image File Format) data is embedded by cameras and phones when taking photos. It can contain:</p>
                <ul>
                  <li><strong>GPS coordinates</strong>: latitude, longitude, and sometimes altitude, accurate to a few meters</li>
                  <li><strong>Camera information</strong>: make, model, serial number (can link multiple photos to the same device), lens, and firmware version</li>
                  <li><strong>Timestamps</strong>: when the photo was taken (DateTimeOriginal), when it was digitized, and when the file was modified</li>
                  <li><strong>Technical settings</strong>: focal length, aperture (f-stop), ISO speed, shutter speed, flash, and white balance</li>
                  <li><strong>Software</strong>: which application last processed the image (Photoshop, Lightroom, GIMP)</li>
                  <li><strong>Orientation</strong>: how the camera was held , can reveal if a photo was taken in portrait or landscape</li>
                </ul>

                <h3 id="gps-geolocation">GPS Geolocation from Photos</h3>
                <p>GPS data in EXIF uses DMS (Degrees, Minutes, Seconds) format that can be converted to decimal coordinates. These coordinates can pinpoint the exact building or street corner where a photo was taken.</p>
                <p>Social media platforms (Twitter, Facebook, Instagram) strip EXIF data on upload , but forums, messaging apps, and personal websites often don&apos;t. This makes images from these sources particularly valuable for geolocation.</p>
                <p>Even without GPS, EXIF timezone offsets combined with the timestamp can narrow down the geographic region. Camera serial numbers combined with GPS from multiple photos can reconstruct a person&apos;s movements over time.</p>

                <h3 id="pdf-metadata">PDF Metadata</h3>
                <p>PDFs store rich metadata that can reveal information about their creators and the tools used to produce them:</p>
                <ul>
                  <li><strong>Author</strong>: often the real name of the creator</li>
                  <li><strong>Creator application</strong>: the software used to create the original document</li>
                  <li><strong>Producer</strong>: the PDF library used (e.g., &quot;Microsoft Word 2019&quot;, &quot;LaTeX&quot;, &quot;wkhtmltopdf&quot;)</li>
                  <li><strong>Creation and modification dates</strong>: timestamps for when the document was first created and last modified</li>
                  <li><strong>Title, Subject, and Keywords</strong>: fields that often contain internal project names or descriptions</li>
                </ul>
                <p>PDF/A files (archival format) may contain even richer metadata including XMP data.</p>

                <h3 id="docx-metadata">Document (DOCX) Metadata</h3>
                <p>DOCX files are ZIP archives containing XML files , metadata is stored in <code>docProps/core.xml</code> and <code>docProps/app.xml</code>. Key fields include:</p>
                <ul>
                  <li><strong>Author and Last Modified By</strong>: often different people, revealing the document&apos;s editing chain</li>
                  <li><strong>Revision count</strong>: how many times the document was saved (high count suggests heavy editing)</li>
                  <li><strong>Company field</strong>: often auto-populated from the organization&apos;s Office installation</li>
                  <li><strong>Total editing time</strong>: how long was spent writing the document</li>
                </ul>

                <h3 id="protecting-against-leaks">Protecting Against Metadata Leaks</h3>
                <p>Being aware of metadata leaks is important for both investigators and those who want to protect their privacy:</p>
                <ul>
                  <li>Use tools like ExifTool to strip metadata before sharing files: <code>exiftool -all= photo.jpg</code></li>
                  <li>Most social media platforms strip EXIF on upload, but not all services do</li>
                  <li>Be aware that screenshots can still contain device information</li>
                  <li>PDF redaction tools sometimes leave the original text recoverable under black rectangles , use proper redaction tools</li>
                </ul>

                <h2 id="osint-tools">OSINT Tools for Metadata</h2>
                <p>Here are some useful tools for metadata extraction and analysis:</p>
                <OsintToolsGrid tools={osintTools} />
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
