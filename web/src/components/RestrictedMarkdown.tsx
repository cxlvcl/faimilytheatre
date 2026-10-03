import { inlineMarkdown } from '../lib/inlineMarkdown'

interface Props {
  value: string
  className?: string
}

export function RestrictedMarkdown({ value, className }: Props) {
  const paragraphs = value.trim().split(/\n\s*\n/)
  return (
    <div className={className}>
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 16)}`}>{inlineMarkdown(paragraph.replace(/\n/g, ' '))}</p>
      ))}
    </div>
  )
}
