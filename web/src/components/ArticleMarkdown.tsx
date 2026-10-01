import type { ReactNode } from 'react'

function inline(value: string): ReactNode[] {
  return value.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean).map((token, index) =>
    token.startsWith('**') && token.endsWith('**') && token.length > 4 ? <strong key={index}>{token.slice(2, -2)}</strong>
      : token.startsWith('*') && token.endsWith('*') && token.length > 2 ? <em key={index}>{token.slice(1, -1)}</em>
        : token)
}

/** Mirrors PageHtml::articleMarkdown: paragraphs, ##/### subheadings and "- " lists. */
export function ArticleMarkdown({ value, className }: { value: string; className?: string }) {
  const blocks = value.replace(/\r\n/g, '\n').trim().split(/\n\s*\n/)
  return <div className={className}>{blocks.map((block, index) => {
    const lines = block.split('\n').map(line => line.trim())
    const heading = lines.length === 1 ? /^(#{2,3})\s+(.+)$/.exec(lines[0]) : null
    if (heading) return heading[1].length === 2 ? <h2 key={index}>{inline(heading[2])}</h2> : <h3 key={index}>{inline(heading[2])}</h3>
    if (lines.every(line => line.startsWith('- '))) return <ul key={index}>{lines.map((line, item) => <li key={item}>{inline(line.slice(2))}</li>)}</ul>
    return <p key={index}>{inline(lines.join(' '))}</p>
  })}</div>
}
