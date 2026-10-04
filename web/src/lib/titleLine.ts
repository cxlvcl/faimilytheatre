const letters = (value: string) => value.toLocaleLowerCase('ru').replace(/[^\p{L}\p{N}]+/gu, '')

function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    previous = current
  }
  return previous[b.length]
}

/** True when a line only repeats the title: quotes, case, spaces and a typo or two are ignored. */
export function isTitleLine(line: string, title: string): boolean {
  const a = letters(line)
  const b = letters(title)
  return Boolean(a && b) && (a === b || (Math.abs(a.length - b.length) <= 2 && distance(a, b) <= 2))
}

/** Descriptions often start with the title on its own line; pages already show it as a heading. */
export function withoutTitleLine(text: string, title: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const first = lines.findIndex(line => line.trim() !== '')
  if (first >= 0 && isTitleLine(lines[first], title)) lines.splice(first, 1)
  return lines.join('\n').trim()
}
