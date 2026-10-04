import type {
  Article,
  ArticleSummary,
  EventItem,
  FaqItem,
  FranchiseApplication,
  Performance,
  PerformanceSummary,
} from '../types'

interface ApiEnvelope<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    fields?: Record<string, string>
  }
}

export class ApiError extends Error {
  readonly code: string
  readonly fields: Record<string, string>

  constructor(code: string, message: string, fields: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.fields = fields
  }
}

const apiBase = (import.meta.env.VITE_API_BASE ?? '/api').replace(/\/$/, '')

declare global {
  interface Window { __THEATRE_DATA__?: Record<string, unknown> }
}
// Data younger than a minute is used as is. Older data (up to 30 minutes) is shown at once
// and refreshed in the background: the hosting API answers in 0.4–1.5 s, and a page change
// must not wait for it again.
const freshFor = 60000
const staleFor = 30 * 60000
const publicCache = new Map<string, { value: unknown; saved: number }>(Object.entries(typeof window === 'undefined' ? {} : window.__THEATRE_DATA__ ?? {}).map(([path, value]) => [path, { value, saved: Date.now() }]))
const pending = new Map<string, Promise<unknown>>()
export function cachedPublic<T>(path: string): T | undefined {
  const cached = publicCache.get(path)
  return cached && Date.now() - cached.saved < staleFor ? cached.value as T : undefined
}
export function publicRequest<T>(path: string, refresh = false): Promise<T> {
  if (refresh) publicCache.delete(path)
  const cached = cachedPublic<T>(path)
  if (cached !== undefined) {
    if (Date.now() - (publicCache.get(path)?.saved ?? 0) >= freshFor) void loadPublic(path).catch(() => undefined)
    return Promise.resolve(cached)
  }
  return loadPublic<T>(path)
}
function loadPublic<T>(path: string): Promise<T> {
  if (pending.has(path)) return pending.get(path) as Promise<T>
  const result = request<T>(path).then(value => {
    publicCache.set(path, { value, saved: Date.now() })
    return value
  }).finally(() => pending.delete(path))
  pending.set(path, result)
  return result
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: 'same-origin',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  })

  let payload: ApiEnvelope<T>
  try {
    payload = (await response.json()) as ApiEnvelope<T>
  } catch {
    throw new ApiError('invalid_response', 'Не удалось загрузить содержимое')
  }

  if (!response.ok || !payload.success || payload.data === undefined) {
    throw new ApiError(
      payload.error?.code ?? 'request_failed',
      payload.error?.message ?? 'Не удалось загрузить содержимое',
      payload.error?.fields,
    )
  }

  return payload.data
}

let memoryVisitor: string | undefined
function visitorId(): string {
  const key = 'theatre_visitor_id'
  try {
    const current = localStorage.getItem(key)
    if (current) return current
    memoryVisitor ??= crypto.randomUUID()
    localStorage.setItem(key, memoryVisitor)
  } catch { memoryVisitor ??= crypto.randomUUID() }
  return memoryVisitor
}

function beacon(path: string, body: Record<string, unknown>): void {
  try {
  const payload = JSON.stringify({ ...body, visitor_id: visitorId() })
  const url = `${apiBase}${path}`
  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' })
    if (navigator.sendBeacon(url, blob)) return
  }
  void fetch(url, {
    method: 'POST',
    body: payload,
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    credentials: 'same-origin',
  }).catch(() => undefined)
  } catch { /* Analytics must never interrupt navigation. */ }
}

export const publicApi = {
  performances: () => publicRequest<PerformanceSummary[]>('/public/performances'),
  performance: (slug: string) => publicRequest<Performance>(`/public/performances/${encodeURIComponent(slug)}`),
  events: () => publicRequest<EventItem[]>('/public/events'),
  faq: () => publicRequest<FaqItem[]>('/public/faq'),
  articles: () => publicRequest<ArticleSummary[]>('/public/articles'),
  article: (slug: string) => publicRequest<Article>(`/public/articles/${encodeURIComponent(slug)}`),
  franchise: (application: FranchiseApplication) =>
    request<{ id: number }>('/public/franchise/applications', {
      method: 'POST',
      body: JSON.stringify(application),
    }),
  pageView: (pagePath: string) => beacon('/public/analytics/page-view', { page_path: pagePath }),
  ticketClick: (eventId: number) => beacon('/public/analytics/ticket-click', { event_id: eventId }),
}
