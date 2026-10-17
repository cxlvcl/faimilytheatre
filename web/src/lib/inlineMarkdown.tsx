import type { ReactNode } from 'react'
import { withoutTitleLine } from './titleLine'

function emphasis(value: string, prefix: string): ReactNode[] {
  const result: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > cursor) result.push(value.slice(cursor, match.index))
    const token = match[0]
    if (token.startsWith('**')) {
      result.push(<strong key={`${prefix}${match.index}-strong`}>{token.slice(2, -2)}</strong>)
    } else {
      result.push(<em key={`${prefix}${match.index}-em`}>{token.slice(1, -1)}</em>)
    }
    cursor = match.index + token.length
  }

  if (cursor < value.length) result.push(value.slice(cursor))
  return result
}

/** **bold**, *italic* and [links](https://… or /path) inside one paragraph (mirrors PageHtml::inline). */
export function inlineMarkdown(value: string): ReactNode[] {
  const parts = value.split(/(\[[^[\]\n]{1,300}\]\((?:https?:\/\/|\/)[^\s()<>"]{0,500}\))/u)
  return parts.flatMap((part, index): ReactNode[] => {
    const link = index % 2 === 1 ? /^\[([^\]]+)\]\(([^)]+)\)$/u.exec(part) : null
    if (!link) return emphasis(part, `${index}-`)
    const external = !link[2].startsWith('/')
    return [<a key={`${index}-link`} href={link[2]} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{emphasis(link[1], `${index}-a-`)}</a>]
  })
}

const photoMarker = /^\[фото\]$/iu

/**
 * Splits a performance description into paragraphs and finds where the second photo goes:
 * at the «[фото]» line set in the admin, otherwise in the middle of the text (same rule as PageHtml.php).
 */
export function paperLayout(value: string, title = ''): { paragraphs: string[]; photoAt: number } {
  const blocks = (title ? withoutTitleLine(value, title) : value).trim().split(/\n\s*\n/).map(block => block.trim()).filter(Boolean)
  const marker = blocks.findIndex(block => photoMarker.test(block))
  const paragraphs = blocks.filter(block => !photoMarker.test(block))
  const photoAt = marker >= 0 ? blocks.slice(0, marker).filter(block => !photoMarker.test(block)).length : Math.ceil(paragraphs.length / 2)
  return { paragraphs, photoAt }
}
