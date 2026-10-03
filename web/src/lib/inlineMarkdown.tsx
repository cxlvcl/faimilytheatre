import type { ReactNode } from 'react'

/** **bold** and *italic* inside one paragraph of restricted Markdown. */
export function inlineMarkdown(value: string): ReactNode[] {
  const result: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > cursor) result.push(value.slice(cursor, match.index))
    const token = match[0]
    if (token.startsWith('**')) {
      result.push(<strong key={`${match.index}-strong`}>{token.slice(2, -2)}</strong>)
    } else {
      result.push(<em key={`${match.index}-em`}>{token.slice(1, -1)}</em>)
    }
    cursor = match.index + token.length
  }

  if (cursor < value.length) result.push(value.slice(cursor))
  return result
}

const photoMarker = /^\[фото\]$/iu

/**
 * Splits a performance description into paragraphs and finds where the second photo goes:
 * at the «[фото]» line set in the admin, otherwise in the middle of the text (same rule as PageHtml.php).
 */
export function paperLayout(value: string, title = ''): { paragraphs: string[]; photoAt: number } {
  const blocks = value.trim().split(/\n\s*\n/).map(block => block.trim()).filter(Boolean)
  // Descriptions often repeat the title on the first line; the page already shows it as the heading.
  const lines = blocks[0]?.split('\n') ?? []
  if (title && lines[0]?.trim().toLocaleLowerCase('ru') === title.trim().toLocaleLowerCase('ru')) {
    const rest = lines.slice(1).join('\n').trim()
    if (rest) blocks[0] = rest
    else blocks.shift()
  }
  const marker = blocks.findIndex(block => photoMarker.test(block))
  const paragraphs = blocks.filter(block => !photoMarker.test(block))
  const photoAt = marker >= 0 ? blocks.slice(0, marker).filter(block => !photoMarker.test(block)).length : Math.ceil(paragraphs.length / 2)
  return { paragraphs, photoAt }
}
