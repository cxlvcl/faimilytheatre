import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { cachedPublic, publicRequest } from '../lib/api'
import type { PageMeta as Metadata } from '../types'
function setMeta(key: string, value: string, property = false) {
  const attribute = property ? 'property' : 'name'
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (!tag) { tag = document.createElement('meta'); tag.setAttribute(attribute, key); document.head.append(tag) }
  tag.content = value
}
function apply(meta: Metadata) {
  document.title = meta.title
  const ogTitle = meta.og_title || meta.title
  const ogDescription = meta.og_description || meta.description
  for (const [key, value] of Object.entries({ description: meta.description, robots: meta.robots, 'twitter:card': 'summary_large_image', 'twitter:title': ogTitle, 'twitter:description': ogDescription, 'twitter:image': meta.image })) setMeta(key, value)
  for (const [key, value] of Object.entries({ 'og:title': ogTitle, 'og:description': ogDescription, 'og:url': meta.canonical, 'og:image': meta.image, 'og:type': meta.og_type || 'website', 'og:site_name': 'Театр Музыки и Песка', 'og:locale': 'ru_RU' })) setMeta(key, value, true)
  for (const key of ['og:image:width', 'og:image:height'] as const) {
    const value = key === 'og:image:width' ? meta.image_width : meta.image_height
    if (value) setMeta(key, String(value), true)
    else document.head.querySelector(`meta[property="${key}"]`)?.remove()
  }
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (meta.status === 200) {
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical) }
    canonical.href = meta.canonical
  } else canonical?.remove()
  let schema = document.getElementById('page-schema')
  if (!schema) { schema = document.createElement('script'); schema.id = 'page-schema'; schema.setAttribute('type', 'application/ld+json'); document.head.append(schema) }
  schema.textContent = JSON.stringify(meta.schema)
}
export function PageSeo() {
  const { pathname } = useLocation()
  useEffect(() => {
    let current = true
    const path = `/public/seo?path=${encodeURIComponent(pathname)}`
    const cached = cachedPublic<Metadata>(path)
    if (cached) apply(cached)
    else {
      // Never leave the previous show's canonical/schema on a new URL.
      document.title = 'Театр Музыки и Песка'
      document.querySelector('link[rel="canonical"]')?.remove()
      document.getElementById('page-schema')?.remove()
      setMeta('robots', 'noindex, follow')
      document.head.querySelectorAll('meta[name="description"], meta[property^="og:"], meta[name^="twitter:"]').forEach(tag => tag.remove())
    }
    publicRequest<Metadata>(path).then(meta => { if (current) apply(meta) }).catch(() => { /* Server HTML remains authoritative on direct loads. */ })
    return () => { current = false }
  }, [pathname])
  return null
}
