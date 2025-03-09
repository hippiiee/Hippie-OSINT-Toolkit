"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Globe, ImageIcon, Users, Menu, X, Moon, Sun, Github, Search, ExternalLink, Sparkles } from "lucide-react"
import { FaGithub, FaReddit, FaTiktok, FaMastodon, FaGoogle, FaDiscord } from "react-icons/fa"
import ImageSearch from "./image-search"
import DomainTools from "./domain-tools"
import GitHubTools from "./social_media/github"
import RedditTools from "./social_media/reddit"
import MastodonTools from "./social_media/mastodon"
import TikTokTools from "./social_media/tiktok"
import GoogleTools from "./social_media/google"
import DiscordTools from "./social_media/discord"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import UsernameSearch from "./username/username"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

interface ToolItem {
  name: string
  icon: React.ElementType
  tool: string
  description: string
}

export default function HippieOSINTToolkit() {
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem("theme")
    if (savedTheme) {
      setTheme(savedTheme)
    }
  }, [setTheme])

  const socialTools: ToolItem[] = [
    {
      name: "TikTok",
      icon: FaTiktok,
      tool: "tiktok",
      description: "Find video upload timestamps and user information",
    },
    { name: "Google", icon: FaGoogle, tool: "google", description: "Search Google account user information" },
    { name: "Reddit", icon: FaReddit, tool: "reddit", description: "Find Reddit user details" },
    { name: "GitHub", icon: FaGithub, tool: "github", description: "Discover GitHub user information" },
    { name: "Mastodon", icon: FaMastodon, tool: "mastodon", description: "Search Mastodon users and instances" },
    { name: "Discord", icon: FaDiscord, tool: "discord", description: "Discord user information" },
  ]

  const mainTools = [
    { name: "Domain", icon: Globe, tool: "domain", description: "Analyze domains and subdomains" },
    { name: "Image", icon: ImageIcon, tool: "image", description: "Reverse image search and analysis" },
    { name: "Username", icon: Users, tool: "username", description: "Search usernames across platforms" },
  ]

  const renderTool = () => {
    switch (selectedTool) {
      case "domain":
        return <DomainTools />
      case "image":
        return <ImageSearch />
      case "github":
        return <GitHubTools />
      case "reddit":
        return <RedditTools />
      case "mastodon":
        return <MastodonTools />
      case "tiktok":
        return <TikTokTools />
      case "google":
        return <GoogleTools />
      case "username":
        return <UsernameSearch />
      case "discord":
        return <DiscordTools />
      default:
        return (
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 rounded-2xl p-8 mb-8 text-center shadow-sm">
              <img
                src="/hippie-osint-toolkit.png"
                alt="Hippie OSINT Toolkit Logo"
                className="w-32 h-32 mx-auto mb-6 drop-shadow-md"
              />
              <h2 className="text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400">
                Welcome to Hippie OSINT Toolkit
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4 max-w-2xl mx-auto">
                A collection of carefully selected OSINT tools for investigations and CTFs, all in one place.
              </p>
              <div className="flex justify-center gap-3 mt-6">
                <Button
                  onClick={() => selectTool("domain")}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                >
                  <Search className="mr-2 h-4 w-4" />
                  Start Exploring
                </Button>
                <Button variant="outline" asChild>
                  <a
                    href="https://github.com/hippiiee/Hippie-OSINT-Toolkit"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center"
                  >
                    <Github className="mr-2 h-4 w-4" />
                    View on GitHub
                  </a>
                </Button>
              </div>
            </div>

            <div className="mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mainTools.map((tool) => (
                  <div
                    key={tool.tool}
                    className="bg-gray-100 dark:bg-gray-800/80 rounded-xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer border border-gray-200 dark:border-gray-700 hover:border-purple-200 dark:hover:border-purple-800/50"
                    onClick={() => selectTool(tool.tool)}
                  >
                    <div className="flex items-center mb-3">
                      <div className="bg-white dark:bg-gray-900 p-2 rounded-lg mr-3 shadow-sm">
                        <tool.icon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <h3 className="font-semibold text-lg">{tool.name}</h3>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 text-sm">{tool.description}</p>
                  </div>
                ))}
              </div>

              <h3 className="text-xl font-semibold mt-8 mb-4 flex items-center text-gray-800 dark:text-gray-200">
                <Users className="mr-2 h-5 w-5 text-purple-600 dark:text-purple-400" />
                Social Networks
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {socialTools.map((tool) => (
                  <div
                    key={tool.tool}
                    className="bg-gray-100 dark:bg-gray-800/80 rounded-xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer border border-gray-200 dark:border-gray-700 hover:border-purple-200 dark:hover:border-purple-800/50"
                    onClick={() => selectTool(tool.tool)}
                  >
                    <div className="flex items-center mb-3">
                      <div className="bg-white dark:bg-gray-900 p-2 rounded-lg mr-3 shadow-sm">
                        <tool.icon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <h3 className="font-semibold text-lg">{tool.name}</h3>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 text-sm">{tool.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <Sparkles className="mr-2 h-5 w-5 text-purple-600 dark:text-purple-400" />
                About This Project
              </h3>
              <div className="space-y-4 text-gray-700 dark:text-gray-300">
                <p>
                  I have developed this website to share my knowledge in OSINT and provide everyone with access to a
                  practical toolkit, especially useful for CTFs or investigations, without the need to install all the
                  tools for quick searches.
                </p>
                <p>
                  I've carefully selected the tools that I personally find most useful and relevant. However, I had to
                  make some compromises and couldn't implement everything, as some tools require a complex setup if made
                  publicly accessible (such as IP rotation, sock puppets, etc.).
                </p>
                <p>
                  If you would like to add a tool, provide additional information, or correct any errors, please feel
                  free to contribute to the project on GitHub.
                </p>
                <div className="pt-2 text-center">
                  <a
                    href="https://github.com/hippiiee/Hippie-OSINT-Toolkit"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 font-medium"
                  >
                    Contribute to the project
                    <ExternalLink className="ml-1 h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
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
    const newTheme = theme === "dark" ? "light" : "dark"
    setTheme(newTheme)
    localStorage.setItem("theme", newTheme)
  }

  const handleTitleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setSelectedTool(null)
    router.push("/")
  }

  if (!mounted) {
    return null
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 transition-all duration-300">
        {/* Header */}
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex justify-between items-center transition-all duration-300 sticky top-0 z-30">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="mr-2 md:hidden" onClick={toggleSidebar}>
              {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <a
              href="/"
              onClick={handleTitleClick}
              className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400 hover:opacity-90 transition-all duration-300"
            >
              Hippie OSINT Toolkit
            </a>
            {selectedTool && (
              <div className="hidden md:flex items-center ml-4">
                <Separator orientation="vertical" className="h-6 mx-2" />
                <Badge variant="secondary" className="text-xs font-normal">
                  {selectedTool.charAt(0).toUpperCase() + selectedTool.slice(1)}
                </Badge>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleThemeToggle}
                  aria-label="Toggle theme"
                  className="transition-all duration-300"
                >
                  {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle {theme === "dark" ? "light" : "dark"} mode</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" asChild>
                  <a
                    href="https://github.com/hippiiee/Hippie-OSINT-Toolkit"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-all duration-300"
                  >
                    <Github className="h-5 w-5" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View on GitHub</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden relative">
          {/* Mobile sidebar overlay */}
          {isSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/20 dark:bg-black/50 z-20 md:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <aside
            className={cn(
              "bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 w-64 fixed md:relative inset-y-0 left-0 transform",
              isSidebarOpen ? "translate-x-0" : "-translate-x-full",
              "md:translate-x-0 transition-transform duration-300 ease-in-out z-40 md:z-10 pt-0 mt-0 top-[57px] md:top-0 h-[calc(100vh-57px)] overflow-y-auto",
            )}
          >
            <nav className="p-4">
              <div className="mb-6">
                {mainTools.map((tool) => (
                  <Tooltip key={tool.tool}>
                    <TooltipTrigger asChild>
                      <Button
                        variant={selectedTool === tool.tool ? "secondary" : "ghost"}
                        className="w-full justify-start mb-1 font-normal"
                        onClick={() => selectTool(tool.tool)}
                      >
                        <tool.icon className="mr-2 h-4 w-4" />
                        {tool.name}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{tool.description}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>

              <div>
                <h3 className="text-xs uppercase font-semibold text-gray-500 dark:text-gray-400 mb-2 px-3">
                  Social Networks
                </h3>
                <div className="space-y-1">
                  {socialTools.map((tool) => (
                    <Tooltip key={tool.tool}>
                      <TooltipTrigger asChild>
                        <Button
                          variant={selectedTool === tool.tool ? "secondary" : "ghost"}
                          className="w-full justify-start mb-1 font-normal"
                          onClick={() => selectTool(tool.tool)}
                        >
                          <tool.icon className="mr-2 h-4 w-4" />
                          {tool.name}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{tool.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
                <div className="px-3 py-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Made with ❤️ by{" "}
                    <a
                      href="https://x.com/hiippiiie"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 dark:text-purple-400 hover:underline"
                    >
                      @hiippiiie
                    </a>
                  </p>
                </div>
              </div>
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 p-4 md:p-6 overflow-auto bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-all duration-300">
            {renderTool()}
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}

