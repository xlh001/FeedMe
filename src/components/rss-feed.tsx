"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { loadFeedData } from "@/lib/data-store"
import type { FeedData } from "@/lib/types"
import { findSourceByUrl, getCategoryName, getSourceName } from "@/config/rss-config"
import { dateLocales, useI18n } from "@/i18n"
import { ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchTarget {
  itemId: string
  requestId: number
}

interface RssFeedProps {
  sourceUrl: string
  searchTarget: SearchTarget | null
}

export function RssFeed({ sourceUrl, searchTarget }: RssFeedProps) {
  const { locale, t } = useI18n()

  const [feedData, setFeedData] = useState<FeedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedItemId, setSelectedItemId] = useState("")
  const selectedItemIdRef = useRef("")
  const handledSearchRequestRef = useRef(0)

  const fetchFeed = async (url: string) => {
    try {
      setLoading(true)
      setError(null)

      const cachedData = await loadFeedData(url)
      
      if (cachedData) {
        setFeedData(cachedData)
      } else {
        setError(t("feed.emptyData"))
      }
    } catch (err) {
      console.error("Error fetching feed:", err)
      setError(t("feed.fetchError"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFeed(sourceUrl)
  }, [sourceUrl, t])

  useEffect(() => {
    if (!searchTarget) {
      handledSearchRequestRef.current = 0
      setSelectedItemId("")
      selectedItemIdRef.current = ""
      return
    }

    if (handledSearchRequestRef.current === searchTarget.requestId) {
      return
    }

    if (!feedData) {
      return
    }

    const targetId = searchTarget.itemId
    setSelectedItemId(targetId)
    selectedItemIdRef.current = targetId

    const cancelScroll = scheduleTargetScroll(() => {
      if (scrollToItemTarget(targetId)) {
        handledSearchRequestRef.current = searchTarget.requestId
      }
    })

    return cancelScroll
  }, [feedData, searchTarget])

  useEffect(() => {
    const clearSelectionOnOutsidePointerDown = (event: globalThis.PointerEvent) => {
      if (!selectedItemIdRef.current) {
        return
      }

      if (event.target instanceof Element && event.target.closest("[data-feed-card]")) {
        return
      }

      setSelectedItemId("")
      selectedItemIdRef.current = ""
    }

    document.addEventListener("pointerdown", clearSelectionOnOutsidePointerDown, true)
    return () => document.removeEventListener("pointerdown", clearSelectionOnOutsidePointerDown, true)
  }, [])

  const selectItem = (itemId: string) => {
    setSelectedItemId(itemId)
    selectedItemIdRef.current = itemId
  }

  const source = findSourceByUrl(sourceUrl)
  const displayTitle = source ? getSourceName(source, locale) : feedData?.title || t("feed.sourceFallback")

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">{displayTitle}</h2>
          {source && <Badge variant="outline">{getCategoryName(source.category, locale)}</Badge>}
          {feedData?.lastUpdated && (
            <span className="text-xs text-muted-foreground">
              {t("feed.updatedAt")}: {new Date(feedData.lastUpdated).toLocaleString(dateLocales[locale])}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="feed-card">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {feedData?.items.map((item, index) => {
            const itemNumber = index + 1
            const itemId = `item-${source?.id || "source"}-${itemNumber}`
            const isSelected = selectedItemId === itemId

            return (
              <Card
                key={index}
                id={itemId}
                aria-current={isSelected ? "true" : undefined}
                className={cn("feed-card relative scroll-mt-6", isSelected && "feed-card-selected")}
                data-feed-card
                style={
                  isSelected
                    ? {
                        borderColor: "var(--feed-card-selected-border)",
                        boxShadow: "var(--feed-card-selected-shadow)",
                        ["--feed-card-hover-line" as string]: "var(--feed-card-selected-line)",
                        transform: "translateY(-1px)",
                      }
                    : undefined
                }
                onPointerDown={() => selectItem(itemId)}
              >
                <div className="absolute -left-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold shadow-md">
                  {itemNumber}
                </div>
                <CardHeader>
                  <CardTitle className="text-xl">
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      {item.title}
                      <ExternalLink className="h-4 w-4 inline" />
                    </a>
                  </CardTitle>
                  <CardDescription>
                    {new Date(item.pubDate || item.isoDate || "").toLocaleString(dateLocales[locale])}
                    {item.creator && ` · ${item.creator}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="summary">
                    <TabsList className="mb-4">
                      <TabsTrigger value="summary">{t("feed.summary")}</TabsTrigger>
                      <TabsTrigger value="original">{t("feed.original")}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="summary" className="space-y-2">
                      <div className="text-sm text-muted-foreground mb-2">{t("feed.summaryGeneratedByAi")}</div>
                      <div className="text-foreground whitespace-pre-line">
                        {item.summaries?.[locale] || item.summary || t("feed.summaryUnavailable")}
                      </div>
                    </TabsContent>
                    <TabsContent value="original">
                      <div
                        className="text-sm prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: item.content || item.contentSnippet || t("feed.noContent"),
                        }}
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function scheduleTargetScroll(callback: () => void) {
  let timeoutId: number | undefined
  const frameId = requestAnimationFrame(() => {
    timeoutId = window.setTimeout(callback, 0)
  })

  return () => {
    cancelAnimationFrame(frameId)
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId)
    }
  }
}

function scrollToItemTarget(targetId: string): boolean {
  const targetElement = document.getElementById(targetId)
  if (!targetElement) {
    return false
  }

  const rect = targetElement.getBoundingClientRect()
  const top = Math.max(0, window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2)
  window.scrollTo({ top, behavior: "smooth" })
  return true
}
