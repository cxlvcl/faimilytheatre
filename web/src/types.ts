export interface PerformanceSummary {
  id: number
  slug: string
  title: string
  short_description: string
  cover_image: string
  is_premiere: boolean
  categories?: string[]
}

export interface PerformanceDetails {
  genre: string
  work_author: string
  work_title: string
  alternate_names: string[]
  age_rating: string | null
  duration_min: number | null
  duration_max: number | null
  has_intermission: boolean
  price_from: number | null
}

export interface FaqPair {
  question: string
  answer: string
}

export interface Performance extends PerformanceSummary {
  h1: string
  cover_alt: string
  hero_alt: string
  details: PerformanceDetails
  faq: FaqPair[]
  articles: ArticleSummary[]
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
  poster_alt: string
  ticket_url: string
  is_cancelled: boolean
  performance: Pick<PerformanceSummary, 'id' | 'slug' | 'title' | 'short_description' | 'is_premiere'> & { details?: PerformanceDetails }
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

export interface ArticleSummary {
  id: number
  slug: string
  title: string
  excerpt: string
  cover_image: string
  cover_alt?: string
  published_on: string
  rubric?: { slug: string; name: string } | null
}

export interface Article extends ArticleSummary {
  h1: string
  body: string
  updated_at: string
  updated_on: string | null
  author: { name: string; position: string; photo: string } | null
  faq: FaqPair[]
  performances: (PerformanceSummary & { next_event: { id: number; event_date: string; event_time: string | null; venue: string; ticket_url: string } | null })[]
}

export interface PageMeta {
  status: number
  title: string
  description: string
  h1: string
  canonical: string
  image: string
  image_width: number | null
  image_height: number | null
  og_title: string
  og_description: string
  og_type: string
  robots: string
  schema: unknown
}
