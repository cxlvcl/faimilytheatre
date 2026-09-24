import type {
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
  performances: () => request<PerformanceSummary[]>('/public/performances'),
  performance: (slug: string) => request<Performance>(`/public/performances/${encodeURIComponent(slug)}`),
  events: () => request<EventItem[]>('/public/events'),
  faq: () => request<FaqItem[]>('/public/faq'),
  franchise: (application: FranchiseApplication) =>
    request<{ id: number }>('/public/franchise/applications', {
      method: 'POST',
      body: JSON.stringify(application),
    }),
  pageView: (pagePath: string) => beacon('/public/analytics/page-view', { page_path: pagePath }),
  ticketClick: (eventId: number) => beacon('/public/analytics/ticket-click', { event_id: eventId }),
}
