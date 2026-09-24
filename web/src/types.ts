export interface PerformanceSummary {
  id: number
  slug: string
  title: string
  short_description: string
  cover_image: string
  is_premiere: boolean
}

export interface Performance extends PerformanceSummary {
  description: string
  hero_image: string
  hero_focus_desktop_x: number
  hero_focus_desktop_y: number
  hero_focus_mobile_x: number
  hero_focus_mobile_y: number
}

export interface EventItem {
  id: number
  event_date: string
  event_time: string | null
  venue: string
  poster_image: string
  ticket_url: string
  performance: Pick<PerformanceSummary, 'slug' | 'title' | 'is_premiere'>
}

export interface FaqItem {
  id: number
  question: string
  answer: string
}

export interface FranchiseApplication {
  name: string
  city: string
  phone: string
  website?: string
}
