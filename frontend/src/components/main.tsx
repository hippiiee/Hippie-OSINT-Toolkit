'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Globe, Image as ImageIcon, Users, Menu, X, Moon, Sun, Github } from 'lucide-react'
import { FaGithub, FaReddit, FaTiktok, FaMastodon, FaGoogle } from 'react-icons/fa'
import Link from 'next/link'
import ImageSearch from './image-search'
import DomainTools from './domain-tools'
import GitHubTools from './social_media/github'
import RedditTools from './social_media/reddit'
import MastodonTools from './social_media/mastodon'
import TikTokTools from './social_media/tiktok'
import GoogleTools from './social_media/google'
import { Button } from "@/components/ui/button"
import UsernameSearch from './username/username'
import { useTheme } from "next-themes"
import { useRouter } from 'next/navigation'

export default function HippieOSINTToolkit() {
  const [isSocialExpanded, setIsSocialExpanded] = useState(false)
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme) {
      setTheme(savedTheme)
    }
  }, [setTheme])

  const renderTool = () => {
    switch (selectedTool) {
      case 'domain':
        return <DomainTools />
      case 'image':
        return <ImageSearch />
      case 'github':
        return <GitHubTools />
      case 'reddit':
        return <RedditTools />
      case 'mastodon':
        return <MastodonTools />
      case 'tiktok':
        return <TikTokTools />
      case 'google':
        return <GoogleTools />
      case 'username':
        return <UsernameSearch />
      default:
        return (
          <section className="max-w-2xl mx-auto text-center">
            <img src="/hippie-osint-toolkit.png" alt="Hippie OSINT Toolkit Logo" className="w-32 h-32 mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-4">Welcome to Hippie OSINT Toolkit</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              I have developed this website to share my knowledge in OSINT and provide everyone with access to a practical toolkit, especially useful for CTFs or investigations, without the need to install all the tools for quick searches. I have carefully selected the tools that I personally find most useful and relevant.
            </p>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              However, I had to make some compromises and couldn't implement everything, as some tools require a complex setup if made publicly accessible (such as IP rotation, sock puppets, etc.). You can also host your own instance of the toolkit.
            </p>
            <p className="text-gray-600 dark:text-gray-300">
              If you would like to add a tool, provide additional information, or correct any errors, please feel free to contribute to the project on GitHub.
            </p>
          </section>
        )
    }
  }

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const selectTool = (tool: string) => {
    setSelectedTool(tool)
    setIsSidebarOpen(false)
  }

  const handleThemeToggle = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
  }

  const handleTitleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setSelectedTool(null)
    router.push('/')
  }

  if (!mounted) {
    return null
  }

  return (
    <div className={`flex flex-col h-screen bg-gray-100 dark:bg-gray-900 transition-all duration-300`}>
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-md p-4 flex justify-between items-center transition-all duration-300">
        <div className="flex items-center">
          <a
            href="/"
            onClick={handleTitleClick}
            className="text-2xl md:text-3xl font-bold text-purple-800 dark:text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 transition-all duration-300"
          >
            Hippie OSINT Toolkit
          </a>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleThemeToggle}
            aria-label="Toggle theme"
            className="transition-all duration-300"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <a
            href="https://github.com/hippiiee/Hippie-OSINT-Toolkit"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-all duration-300"
          >
            <Github className="h-6 w-6" />
          </a>
          <Button variant="ghost" size="icon" className="md:hidden transition-all duration-300" onClick={toggleSidebar}>
            {isSidebarOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className={`bg-white dark:bg-gray-800 shadow-md w-64 absolute md:relative inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-all duration-300 ease-in-out z-10`}>
          <nav className="mt-4">
            <ul>
              <li className="px-4 py-2 hover:bg-purple-100 dark:hover:bg-purple-900 transition-all duration-300">
                <button
                  onClick={() => selectTool('domain')}
                  className="flex items-center w-full text-left text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-300"
                >
                  <Globe className="mr-2 h-5 w-5" />
                  Domain
                </button>
              </li>
              <li className="px-4 py-2 hover:bg-purple-100 dark:hover:bg-purple-900 transition-all duration-300">
                <button
                  onClick={() => setIsSocialExpanded(!isSocialExpanded)}
                  className="flex items-center w-full text-left text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-300"
                >
                  <Users className="mr-2 h-5 w-5" />
                  Social Networks
                  {isSocialExpanded ? (
                    <ChevronDown className="ml-auto h-5 w-5" />
                  ) : (
                    <ChevronRight className="ml-auto h-5 w-5" />
                  )}
                </button>
                {isSocialExpanded && (
                  <ul className="ml-6 mt-2">
                    {[
                      { name: 'TikTok', icon: FaTiktok, tool: 'tiktok' },
                      { name: 'Google', icon: FaGoogle, tool: 'google' },
                      { name: 'Reddit', icon: FaReddit, tool: 'reddit' },
                      { name: 'GitHub', icon: FaGithub, tool: 'github' },
                      { name: 'Mastodon', icon: FaMastodon, tool: 'mastodon' },
                    ].map((item) => (
                      <li key={item.name} className="py-1">
                        <button
                          onClick={() => selectTool(item.tool)}
                          className="flex items-center w-full text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-300"
                        >
                          <item.icon className="mr-2 h-4 w-4" />
                          {item.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
              <li className="px-4 py-2 hover:bg-purple-100 dark:hover:bg-purple-900 transition-all duration-300">
                <button
                  onClick={() => selectTool('image')}
                  className="flex items-center w-full text-left text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-300"
                >
                  <ImageIcon className="mr-2 h-5 w-5" />
                  Image
                </button>
              </li>
              <li className="px-4 py-2 hover:bg-purple-100 dark:hover:bg-purple-900 transition-all duration-300">
                <button
                  onClick={() => selectTool('username')}
                  className="flex items-center w-full text-left text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-300"
                >
                  <Users className="mr-2 h-5 w-5" />
                  Username
                </button>
              </li>
            </ul>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-4 md:p-8 overflow-auto bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-all duration-300">
          {renderTool()}
        </main>
      </div>
    </div>
  )
}