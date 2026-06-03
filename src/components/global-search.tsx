"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CornerDownRight, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { config, getCategoryName, getSourceName, type RssSource } from "@/config/rss-config"
import { dateLocales, useI18n } from "@/i18n"
import { loadFeedData } from "@/lib/data-store"
import type { FeedData, FeedItem } from "@/lib/types"
import { cn } from "@/lib/utils"

interface IndexedFeedItem {
  id: string
  item: FeedItem
  source: RssSource
  sourceTitle: string
  categoryTitle: string
  searchText: string
  summaryText: string
  originalText: string
}

interface SearchResult extends IndexedFeedItem {
  score: number
  matchedField: "title" | "summary" | "original"
  snippet: string
}

const MAX_RESULTS = 24
const SNIPPET_LENGTH = 140

interface GlobalSearchProps {
  onSelectResult: (sourceUrl: string, itemId: string) => void
}

export function GlobalSearch({ onSelectResult }: GlobalSearchProps) {
  const { locale, t } = useI18n()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [indexedItems, setIndexedItems] = useState<IndexedFeedItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  useEffect(() => {
    setHasLoaded(false)
    setIndexedItems([])
  }, [locale])

  useEffect(() => {
    if (!open || hasLoaded) {
      return
    }

    let isActive = true

    async function loadSearchIndex() {
      setIsLoading(true)
      const results = await Promise.all(
        config.sources.map(async (source) => {
          const feedData = await loadFeedData(source.url)
          return feedData ? createIndexedItems(source, feedData, locale) : []
        }),
      )

      if (!isActive) {
        return
      }

      setIndexedItems(results.flat())
      setHasLoaded(true)
      setIsLoading(false)
    }

    loadSearchIndex().catch((error) => {
      console.error("Error loading search index:", error)
      if (isActive) {
        setHasLoaded(true)
        setIsLoading(false)
      }
    })

    return () => {
      isActive = false
    }
  }, [hasLoaded, locale, open])

  const results = useMemo(() => searchItems(indexedItems, query), [indexedItems, query])
  const normalizedQuery = normalizeSearchText(query)
  const hasQuery = normalizedQuery.length > 0

  const handleSelect = (result: SearchResult) => {
    onSelectResult(result.source.url, result.id)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start text-muted-foreground md:w-[260px]">
          <Search className="h-4 w-4" />
          <span className="truncate">{t("globalSearch.trigger")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(680px,calc(100vw-2rem))] p-0"
        onCloseAutoFocus={(event) => event.preventDefault()}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2 rounded-md border bg-background px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder={t("globalSearch.placeholder")}
              onChange={(event) => setQuery(event.target.value)}
            />
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </div>

        <div className="source-scroll max-h-[min(68vh,560px)] overflow-y-auto p-2">
          {isLoading && (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-md border p-3">
                  <div className="mb-2 h-4 w-3/5 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-full animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && !hasQuery && (
            <div className="px-4 py-10 text-center">
              <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground/70" />
              <p className="text-sm font-medium">{t("globalSearch.emptyQueryTitle")}</p>
            </div>
          )}

          {!isLoading && hasQuery && results.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium">{t("globalSearch.noResultsTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("globalSearch.noResultsDescription")}</p>
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <div className="space-y-1">
              {results.map((result) => (
                <SearchResultItem
                  key={`${result.source.id}-${result.id}`}
                  locale={locale}
                  query={query}
                  result={result}
                  t={t}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function SearchResultItem({
  locale,
  query,
  result,
  t,
  onSelect,
}: {
  locale: string
  query: string
  result: SearchResult
  t: (key: string) => string
  onSelect: (result: SearchResult) => void
}) {
  const itemDateLabel = getItemDateLabel(result.item, locale)
  const highlightTerms = useMemo(() => getHighlightTerms(query), [query])

  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-md border border-transparent px-3 py-3 text-left transition-colors",
        "hover:border-border hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
      onClick={() => onSelect(result)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="line-clamp-2 text-[15px] font-semibold leading-6 text-foreground">
            <HighlightedText text={result.item.title} terms={highlightTerms} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <Badge variant="outline" className="h-5 rounded-md px-1.5 py-0 text-[11px] font-medium">
              {result.categoryTitle}
            </Badge>
            <span className="font-medium text-muted-foreground">{result.sourceTitle}</span>
            {itemDateLabel && (
              <>
                <span className="text-muted-foreground/60">·</span>
                <time>{itemDateLabel}</time>
              </>
            )}
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {getMatchedFieldLabel(result.matchedField, t)}
            </span>
          </div>
        </div>
        <CornerDownRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground/90">
        <HighlightedText text={result.snippet} terms={highlightTerms} />
      </p>
    </button>
  )
}

function HighlightedText({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) {
    return <>{text}</>
  }

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi")
  const parts = text.split(pattern)

  return (
    <>
      {parts.map((part, index) => {
        if (!part) {
          return null
        }

        const isMatch = terms.some((term) => normalizeSearchText(part) === term)
        if (!isMatch) {
          return <span key={`${part}-${index}`}>{part}</span>
        }

        return (
          <mark
            key={`${part}-${index}`}
            className="search-highlight"
          >
            {part}
          </mark>
        )
      })}
    </>
  )
}

function createIndexedItems(source: RssSource, feedData: FeedData, locale: string): IndexedFeedItem[] {
  const sourceTitle = getSourceName(source, locale)
  const categoryTitle = getCategoryName(source.category, locale)

  return feedData.items.map((item, index) => {
    const itemNumber = index + 1
    const summaryText = getSummaryText(item, locale)
    const originalText = stripHtml(item.content || item.contentSnippet || "")
    const searchText = [item.title, item.creator, summaryText, originalText].filter(Boolean).join("\n")

    return {
      id: `item-${source.id}-${itemNumber}`,
      item,
      source,
      sourceTitle,
      categoryTitle,
      searchText,
      summaryText,
      originalText,
    }
  })
}

function searchItems(items: IndexedFeedItem[], query: string): SearchResult[] {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) {
    return []
  }

  return items
    .map((item) => scoreItem(item, terms))
    .filter((result): result is SearchResult => result !== null)
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_RESULTS)
}

function scoreItem(item: IndexedFeedItem, terms: string[]): SearchResult | null {
  const title = item.item.title || ""
  const titleText = normalizeSearchText(title)
  const summaryText = normalizeSearchText(item.summaryText)
  const originalText = normalizeSearchText(item.originalText)
  const wholeText = normalizeSearchText(item.searchText)

  if (!terms.every((term) => wholeText.includes(term))) {
    return null
  }

  let score = 0
  let matchedField: SearchResult["matchedField"] = "original"
  let snippetSource = item.originalText

  for (const term of terms) {
    if (titleText.includes(term)) {
      score += 12
      matchedField = "title"
      snippetSource = title
      continue
    }

    if (summaryText.includes(term)) {
      score += 6
      if (matchedField !== "title") {
        matchedField = "summary"
        snippetSource = item.summaryText
      }
      continue
    }

    if (originalText.includes(term)) {
      score += 2
    }
  }

  return {
    ...item,
    score,
    matchedField,
    snippet: createSnippet(snippetSource || item.searchText, terms),
  }
}

function getSummaryText(item: FeedItem, locale: string): string {
  return item.summaries?.[locale] || item.summary || Object.values(item.summaries || {})[0] || ""
}

function getItemDateLabel(item: FeedItem, locale: string): string {
  const dateValue = item.pubDate || item.isoDate
  if (!dateValue) {
    return ""
  }

  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) {
    return ""
  }

  return date.toLocaleDateString(dateLocales[locale], {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function stripHtml(value: string): string {
  const template = document.createElement("template")
  template.innerHTML = value
  return (template.content.textContent || "").replace(/\s+/g, " ").trim()
}

function normalizeSearchText(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim()
}

function getHighlightTerms(query: string): string[] {
  return Array.from(new Set(normalizeSearchText(query).split(/\s+/).filter(Boolean))).sort(
    (left, right) => right.length - left.length,
  )
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function createSnippet(value: string, terms: string[]): string {
  const normalizedValue = normalizeSearchText(value)
  const firstIndex = terms
    .map((term) => normalizedValue.indexOf(term))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0]

  if (firstIndex === undefined || value.length <= SNIPPET_LENGTH) {
    return value.trim()
  }

  const start = Math.max(0, firstIndex - 44)
  const end = Math.min(value.length, start + SNIPPET_LENGTH)
  return `${start > 0 ? "..." : ""}${value.slice(start, end).trim()}${end < value.length ? "..." : ""}`
}

function getMatchedFieldLabel(field: SearchResult["matchedField"], t: (key: string) => string): string {
  if (field === "title") {
    return t("globalSearch.matchedTitle")
  }

  if (field === "summary") {
    return t("globalSearch.matchedSummary")
  }

  return t("globalSearch.matchedOriginal")
}
