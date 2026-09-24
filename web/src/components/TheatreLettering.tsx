// Original single-line Bézier lettering, drawn for these two fixed phrases.
// This is not a font or an outline conversion of the previous typefaces.
type Letter = { width: number; path: string }
const letters: Record<string, Letter> = {
  'а': { width: 36, path: 'M0 60 Q9 52 14 38 C23 23 36 31 27 48 C19 66 5 65 9 49 C12 34 23 29 30 33 M30 33 L22 57 Q20 69 36 57' },
  'б': { width: 37, path: 'M0 60 C11 51 12 30 21 21 C29 13 40 22 44 10 M30 26 C13 22 7 47 10 57 C14 73 35 55 31 43 C28 33 16 42 12 50 M24 61 Q31 63 37 57' },
  'в': { width: 34, path: 'M0 60 C10 49 29 17 26 7 C22 -7 5 34 8 55 C10 74 30 57 29 47 C28 38 16 43 12 48 C36 38 37 21 26 25 C19 28 14 39 12 48 M23 60 Q30 63 34 57' },
  'г': { width: 30, path: 'M0 60 Q12 52 17 34 C29 27 31 32 24 43 L16 54 Q10 67 30 57' },
  'д': { width: 38, path: 'M0 60 C7 57 11 37 21 32 C36 26 31 47 23 57 C12 70 4 59 11 45 C17 31 26 29 32 33 L19 83 C11 110 -5 102 4 87 C14 73 27 66 38 57' },
  'е': { width: 30, path: 'M0 60 C14 53 32 40 24 33 C16 25 5 46 9 57 C13 68 25 62 30 57' },
  'з': { width: 32, path: 'M0 60 Q11 45 15 34 C29 24 36 34 24 45 L16 50 C37 40 29 62 18 70 C-5 88 -10 70 5 66 Q20 64 32 57' },
  'и': { width: 40, path: 'M0 60 Q9 52 16 32 L8 55 C3 77 30 53 34 32 L26 56 Q23 68 40 57' },
  'й': { width: 40, path: 'M0 60 Q9 52 16 32 L8 55 C3 77 30 53 34 32 L26 56 Q23 68 40 57 M20 17 Q24 27 36 15' },
  'к': { width: 37, path: 'M0 60 Q10 48 16 32 L7 62 M12 48 C20 42 24 28 33 31 C39 35 20 48 13 48 C28 42 18 76 37 57' },
  'л': { width: 40, path: 'M0 60 C7 73 15 43 23 32 C25 38 20 55 22 60 Q26 67 40 57' },
  'м': { width: 52, path: 'M0 60 C7 72 14 42 21 32 L17 60 L37 32 C39 39 32 52 35 59 Q39 67 52 57' },
  'н': { width: 41, path: 'M0 60 Q9 50 16 32 L6 62 M12 47 Q23 49 30 43 M36 31 L27 56 Q23 68 41 57' },
  'о': { width: 34, path: 'M0 60 Q9 52 12 40 C19 25 34 27 28 45 C23 65 7 69 8 52 C8 37 20 26 27 33 C33 39 24 49 34 47' },
  'п': { width: 41, path: 'M0 60 Q10 48 16 32 L7 61 C17 36 39 20 32 43 L27 55 Q23 68 41 57' },
  'р': { width: 37, path: 'M0 60 Q10 46 17 31 L-1 88 M13 45 C30 22 39 32 29 52 C23 65 13 66 13 55 Q19 66 37 57' },
  'с': { width: 31, path: 'M0 60 Q9 50 12 40 C19 26 33 28 27 37 C20 25 6 45 10 57 Q14 69 31 57' },
  'т': { width: 57, path: 'M0 60 Q9 49 16 32 L7 61 C18 36 34 23 28 43 L22 61 C33 34 51 24 46 43 L41 55 Q37 69 57 57' },
  'у': { width: 38, path: 'M0 60 Q10 48 16 32 L9 54 C4 76 29 52 34 32 L18 83 C8 109 -8 105 1 88 Q16 71 38 57' },
  'ч': { width: 37, path: 'M0 60 Q10 45 15 32 C5 58 23 54 32 34 L24 56 Q21 68 37 57' },
  'ш': { width: 58, path: 'M0 60 Q9 50 16 32 L8 55 C3 76 29 53 33 32 L26 54 C19 78 47 52 51 32 L44 55 Q39 69 58 57' },
  'ы': { width: 51, path: 'M0 60 Q9 49 16 32 L9 54 C3 73 30 58 27 49 C24 42 13 50 11 58 Q26 67 43 32 L36 56 Q33 68 51 57' },
  'ь': { width: 34, path: 'M0 60 Q10 48 16 32 L9 55 C3 73 32 57 27 47 C24 41 13 48 11 57 Q22 66 34 57' },
  'я': { width: 36, path: 'M0 60 C11 58 18 48 23 45 C6 54 9 36 23 32 Q30 30 31 33 L23 56 Q19 68 36 57 M19 48 Q12 48 5 64' },
  'ж': { width: 53, path: 'M0 60 C14 56 20 36 12 32 M7 46 Q19 38 21 59 M34 30 L22 63 M29 46 C43 40 46 27 50 32 C51 37 37 48 29 46 C43 43 35 72 53 57' },
  'В': { width: 59, path: 'M-12 78 C8 67 13 20 34 3 C56 -15 64 7 47 22 C34 34 19 32 20 30 C67 10 63 53 31 63 C7 72 11 43 25 43 M36 61 Q48 66 59 57' },
  'Т': { width: 61, path: 'M-19 23 C2 -6 32 12 62 2 Q78 -3 82 -13 M39 8 C26 31 28 75 9 86 C-2 90 0 72 12 60 M30 61 Q45 66 61 57' },
  'М': { width: 76, path: 'M-15 77 C4 62 17 18 26 6 C25 28 13 52 17 64 L56 5 C47 31 39 59 46 65 C52 72 70 65 76 57' },
  'П': { width: 65, path: 'M-14 22 C6 -3 29 12 66 3 M23 9 C19 26 10 65 -2 73 M53 7 C46 25 34 55 42 61 Q49 68 65 57' },
  ' ': { width: 25, path: '' },
  '—': { width: 67, path: 'M8 45 Q29 42 57 43' },
  ',': { width: 16, path: 'M8 60 Q9 70 1 75' },
}

export function TheatreLettering({ lines }: { lines: string[] }) {
  const widths = lines.map(line => [...line].reduce((sum, char) => sum + (letters[char]?.width ?? 30), 0))
  const width = Math.max(...widths) + 110
  const height = lines.length * 105 + 120
  return <svg className="theatre-lettering" viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round">
    <g transform={`translate(55 85) rotate(-5 ${width / 2} ${height / 2})`}>
      {lines.map((line, row) => {
        let x = (width - 110 - widths[row]) / 2
        return <g key={row} transform={`translate(0 ${row * 105}) skewX(-14)`}>{[...line].map((char, index) => {
          const glyph = letters[char]
          if (!glyph) throw new Error(`Missing lettering glyph: ${char}`)
          const offset = x; x += glyph.width
          return glyph.path ? <path key={index} d={glyph.path} transform={`translate(${offset} 0)`} /> : null
        })}</g>
      })}
    </g>
  </svg>
}
