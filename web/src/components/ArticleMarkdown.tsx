import { inlineMarkdown } from '../lib/inlineMarkdown'

const cells = (line: string) => line.replace(/^\||\|$/g, '').split('|').map(cell => cell.trim())

/** Mirrors PageHtml::articleMarkdown: ##/### headings, «- » and «1. » lists, «> » quotes,
 *  | tables |, ![подпись](/uploads/…) photos and paragraphs with bold, italic and links. */
export function ArticleMarkdown({ value, className }: { value: string; className?: string }) {
  const blocks = value.replace(/\r\n/g, '\n').trim().split(/\n\s*\n/)
  return <div className={className}>{blocks.map((block, index) => {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean)
    if (!lines.length) return null
    const all = (pattern: RegExp) => lines.every(line => pattern.test(line))
    const heading = lines.length === 1 ? /^(#{2,3})\s+(.+)$/.exec(lines[0]) : null
    if (heading) return heading[1].length === 2 ? <h2 key={index}>{inlineMarkdown(heading[2])}</h2> : <h3 key={index}>{inlineMarkdown(heading[2])}</h3>
    const photo = lines.length === 1 ? /^!\[([^\]]*)\]\(((?:\/uploads\/|https:\/\/)[^\s()<>"]+)\)$/u.exec(lines[0]) : null
    if (photo) return <figure className="article-photo" key={index}><img src={photo[2]} alt={photo[1].trim()} loading="lazy" decoding="async" />{photo[1].trim() && <figcaption>{photo[1].trim()}</figcaption>}</figure>
    if (all(/^- /)) return <ul key={index}>{lines.map((line, item) => <li key={item}>{inlineMarkdown(line.slice(2))}</li>)}</ul>
    if (all(/^\d{1,3}\.\s/)) return <ol key={index}>{lines.map((line, item) => <li key={item}>{inlineMarkdown(line.replace(/^\d{1,3}\.\s+/, ''))}</li>)}</ol>
    if (all(/^>/)) return <blockquote key={index}><p>{inlineMarkdown(lines.map(line => line.slice(1).trimStart()).join(' '))}</p></blockquote>
    if (lines.length >= 2 && all(/^\|.*\|$/) && /^\|(\s*:?-{3,}:?\s*\|)+$/.test(lines[1])) {
      return <div className="article-table" key={index}><table>
        <thead><tr>{cells(lines[0]).map((cell, key) => <th key={key}>{inlineMarkdown(cell)}</th>)}</tr></thead>
        <tbody>{lines.slice(2).map((row, rowKey) => <tr key={rowKey}>{cells(row).map((cell, key) => <td key={key}>{inlineMarkdown(cell)}</td>)}</tr>)}</tbody>
      </table></div>
    }
    return <p key={index}>{inlineMarkdown(lines.join(' '))}</p>
  })}</div>
}
