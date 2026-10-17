import { useLocation } from 'react-router-dom'
import { usePublicResource } from './usePublicResource'
import type { PageMeta } from '../types'

/** The H1 set in the admin «Страницы» section (the same metadata PageSeo applies), or the default. */
export function usePageH1(fallback: string): string {
  const { pathname } = useLocation()
  const { data } = usePublicResource<PageMeta>(`/public/seo?path=${encodeURIComponent(pathname)}`)
  return data?.h1 || fallback
}
