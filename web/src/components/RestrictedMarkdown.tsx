import type { ReactNode } from 'react'

interface Props {
  value: string
  className?: string
}

function inline(value: string): ReactNode[] {
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

export function RestrictedMarkdown({ value, className }: Props) {
  const paragraphs = value.trim().split(/\n\s*\n/)
  return (
    <div className={className}>
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 16)}`}>{inline(paragraph.replace(/\n/g, ' '))}</p>
      ))}
    </div>
  )
}

