'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Github, Calendar, Mail, Link as LinkIcon, Loader2, AlertCircle, User, Users, BookOpen, FileText, ChevronRight, ExternalLink, Info } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArticleImage } from '@/components/image'
import { io, Socket } from 'socket.io-client'
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"

interface GitHubResult {
  GPG_key_id: string;
  GPG_keys: string;
  avatar_url: string;
  bio: string;
  blog: string;
  created_at: string;
  email: string[];
  followers: number;
  following: number;
  id: number;
  login: string;
  name: string;
  public_gists: string;
  public_repos: number;
  updated_at: string;
}

interface GitHubInfo {
  github: GitHubResult | null;
}

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

export default function GitHubTools() {
  const [username, setUsername] = useState('')
  const [results, setResults] = useState<GitHubInfo>({ github: null })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)
  const articleRef = useRef<HTMLDivElement>(null)

  const articleSections: ArticleSection[] = [
    { id: 'introduction', title: 'Introduction', level: 1 },
    { id: 'retrieving-emails', title: 'Retrieving Emails from Commit Patches', level: 2 },
    { id: 'commit-spoofing', title: 'Commit Spoofing for Profile Retrieval', level: 2 },
    { id: 'github-api', title: 'Utilizing GitHub API for Email Retrieval', level: 2 },
    { id: 'public-key-retrieval', title: 'Public Key Retrieval', level: 2 },
    { id: 'osint-tools', title: 'OSINT Tools for GitHub', level: 1 },
  ]

  const osintTools = [
    { 
      name: 'Octosuite', 
      url: 'https://github.com/bellingcat/octosuite', 
      description: 'A framework for gathering open-source intelligence on GitHub users, repositories and organisations',
      icon: 'https://github.com/bellingcat.png'
    },
    { 
      name: 'GitFive', 
      url: 'https://github.com/mxrch/gitfive', 
      description: 'Track down GitHub users ',
      icon: 'https://raw.githubusercontent.com/mxrch/GitFive/refs/heads/master/assets/banner.png'
    },
    { 
      name: 'Osgint', 
      url: 'https://github.com/hippiiee/osgint', 
      description: 'Find information about a GitHub user',
      icon: 'https://github.com/hippiiee.png'
    },
    { 
      name: 'TruffleHog', 
      url: 'https://github.com/trufflesecurity/trufflehog', 
      description: 'Searches for secrets in Git repositories',
      icon: 'https://github.com/trufflesecurity.png'
    },
    { 
      name: 'grep.app', 
      url: 'https://grep.app', 
      description: 'Allows searching across millions of Git repositories',
      icon: 'https://www.zhizhudh.com/wp-content/uploads/2024/08/grep.png'
    },
  ]

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API || 'http://localhost:5000'
    const newSocket = io(`${backendUrl}/github`)
    setSocket(newSocket)

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket')
    })

    newSocket.on('search_result', (data) => {
      console.log('Received data from WebSocket:', data)

      if (data.error) {
        console.log('Error:', data.error)
        setError(data.error)
        setResults({ github: null })
      } else if (data.result) {
        const parsedData = data.result;
        if (parsedData.module === 'github') {
          console.log('Parsed Data:', parsedData)
          setResults({ github: parsedData.data })
          setError(null)
        }
      }
      setIsLoading(false)
    })

    return () => {
      newSocket.disconnect()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setResults({ github: null })
    setError(null)

    if (socket) {
      socket.emit('search_github', { input: username })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const GitHubInfoSkeleton = () => (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="col-span-2 flex items-center space-x-4">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div>
          <Skeleton className="h-6 w-40 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div>
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div>
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div>
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div>
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="col-span-2">
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">GitHub</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Info className="mr-2 h-5 w-5" />
            What data can be found?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 space-y-1">
            <li>Basic user information (username, name, bio, avatar)</li>
            <li>Account details (creation date, last update)</li>
            <li>Contact information (email addresses, blog/website)</li>
            <li>Social statistics (followers, following)</li>
            <li>Repository information (number of public repos, gists)</li>
            <li>GPG key information</li>
            <li>Contribution activity and history</li>
          </ul>
          <p className="mt-4 text-sm text-gray-500">
            This tool is powered by{' '}
            <a
              href="https://github.com/hippiiee/osgint"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline inline-flex items-center"
            >
              Osgint
              <ExternalLink className="ml-1 h-3 w-3" />
            </a>
            , created by hippiiee.
          </p>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-2">
        <Label htmlFor="username">GitHub Username</Label>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <Input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="octocat"
            required
            className="flex-grow"
          />
          <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            {isLoading ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </form>
      
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {(isLoading || results.github) && (
        <Card>
          {isLoading && (
            <CardHeader>
              <CardTitle className="flex items-center">
                <Github className="mr-2 h-5 w-5" />
                GitHub Information
              </CardTitle>
            </CardHeader>
          )}
          <CardContent>
            {isLoading ? (
              <GitHubInfoSkeleton />
            ) : results.github ? (
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="col-span-2 flex items-center space-x-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={results.github.avatar_url} alt={results.github.name} />
                    <AvatarFallback>{results.github.login.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-2xl font-semibold">{results.github.name}</h2>
                    <p className="text-gray-500">@{results.github.login}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Profile Information</h3>
                  <p><span className="font-medium">Bio:</span> {results.github.bio}</p>
                  <p className="flex items-center"><LinkIcon className="mr-2 h-4 w-4" /> <a href={results.github.blog} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">{results.github.blog}</a></p>
                  <p><span className="font-medium">ID:</span> {results.github.id}</p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Account Details</h3>
                  <p><span className="font-medium">Created:</span> {formatDate(results.github.created_at)}</p>
                  <p><span className="font-medium">Last Updated:</span> {formatDate(results.github.updated_at)}</p>
                  <p className="flex items-center"><Users className="mr-2 h-4 w-4" /> Followers: {results.github.followers} | Following: {results.github.following}</p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Repositories and Gists</h3>
                  <p className="flex items-center"><BookOpen className="mr-2 h-4 w-4" /> Public Repos: {results.github.public_repos}</p>
                  <p className="flex items-center"><FileText className="mr-2 h-4 w-4" /> <a href={results.github.public_gists} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">Public Gists</a></p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">GPG Key Information</h3>
                  <p><span className="font-medium">GPG Key ID:</span> {results.github.GPG_key_id}</p>
                  <p><a href={results.github.GPG_keys} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">View GPG Keys</a></p>
                </div>
                <div className="col-span-2">
                  <h3 className="text-xl font-semibold mb-2">Contact Information</h3>
                  {results.github.email.map((email, index) => (
                    <p key={index} className="flex items-center">
                      <Mail className="mr-2 h-4 w-4" />
                      {email}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Advanced OSINT Techniques for GitHub</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row">
            <div className="lg:w-3/4 pr-6">
              <div className="lg:hidden mb-6">
                <h4 className="text-lg font-semibold mb-2">Table of Contents</h4>
                <ArticleNavigation sections={articleSections} />
              </div>
              <div className="article-content" ref={articleRef}>
                <h2 id="introduction">Introduction</h2>
                <p>GitHub, as a vast repository of open-source projects and developer information, presents numerous opportunities for Open Source Intelligence (OSINT) gathering. This article explores some advanced techniques that can be used to extract valuable information from GitHub, as well as ways to protect against such methods.</p>

                <h3 id="retrieving-emails">Retrieving Emails from Commit Patches</h3>
                <p>One powerful technique involves using the '.patch' extension on commit URLs to retrieve email addresses associated with commits. Here's how it works:</p>
                <ul>
                  <li>Append '.patch' to any commit URL</li>
                  <li>The resulting page contains detailed information about the commit, including the author's email</li>
                </ul>
                <ArticleImage
                  src="/images/github/github-commit-email.png"
                  alt="GitHub .patch email retrieval"
                  width={800}
                  height={400}
                />
                <p>To prevent this, users can:</p>
                <ul>
                  <li>Use GitHub's email privacy settings to hide your email address</li>
                  <li>Use a separate email for GitHub contributions</li>
                </ul>

                <h3 id="commit-spoofing">Commit Spoofing for Profile Retrieval</h3>
                <p>It's possible to spoof commits to retrieve any GitHub profile associated with an email address. You can have more information about this technique in this challenge Writeup : <a href="https://hippie.cat/post/Writeup/EsaipCTF-2022/the-proof-of-the-malware-author" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">EsaipCTF 2022 - the-proof-of-the-malware-author</a></p>
                <p>This works because of Git's fundamental design:</p>
                <ul>
                  <li>Git allows users to set any name and email for commits</li>
                  <li>GitHub associates commits with profiles based on the email used</li>
                </ul>
                <ArticleImage
                  src="/images/github/git-config-email.png"
                  alt="git config --global user.email"
                  width={800}
                  height={400}
                />
                <ArticleImage
                  src="/images/github/github-account-spoofed.png"
                  alt="GitHub account spoofing"
                  width={800}
                  height={400}
                />
                <p>This behavior is inherent to Git's distributed nature, making it challenging for GitHub to prevent without altering Git's core functionality.</p>

                <h3 id="github-api">Utilizing GitHub API for Email Retrieval</h3>
                <p>GitHub's API can be leveraged to gather email addresses associated with users and repositories. Some methods include:</p>
                <ul>
                  <li>Querying user profiles for public email addresses</li>
                  <li>Analyzing commit data through API calls</li>
                  <li>Exploring repository contributor information</li>
                </ul>
                <p>You can hide your email address by changing your email visibility settings in your GitHub account.</p>
                <ArticleImage
                  src="/images/github/github-api.png"
                  alt="GitHub API"
                  width={800}
                  height={400}
                />
                <h3 id="public-key-retrieval">Public Key Retrieval</h3>
                <p>Adding '.keys' or '.gpg' to a GitHub user's profile URL can reveal their public keys. This information can be used to:</p>
                <ul>
                  <li>Identify a person connecting to a server</li>
                  <li>Verify the authenticity of signed commits</li>
                  <li>Potentially track a user across different platforms</li>
                </ul>
                <p>While public keys are meant to be shared, users should be aware of the implications of making them easily accessible.</p>
                <ArticleImage
                  src="/images/github/github-public-keys.png"
                  alt="GitHub public keys"
                  width={600}
                  height={300}
                />
                <h2 id="osint-tools">OSINT Tools for GitHub</h2>
                <p>Here are my favorite tools and personal recommendations for GitHub:</p>
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