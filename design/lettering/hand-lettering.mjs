/**
 * Editable, manually drawn centre-line Bézier lettering study.
 * Reference: the quotations embedded in musicians/1.webp, 3.webp and 6.webp.
 * No font files, font tracing/conversion, or generated bitmap lettering.
 * Coordinates: baseline 0, lowercase height ~20, tall loops ~65.
 * Built into the site's TheatreLettering SVG assets.
 */
const glyphs = {
  'Т': [57, 'M-4 -45 C-9 -60 43 -69 70 -65 M39 -68 C27 -45 4 -1 -4 7 C-13 16 -10 2 -4 -5 M25 1 C38 2 49 -1 57 -3'],
  'М': [65, 'M-8 8 C3 -5 21 -49 31 -61 C36 -67 17 -22 18 -10 C19 -5 47 -47 56 -61 C62 -70 43 -20 45 -4 C46 6 57 1 65 -3'],
  'П': [59, 'M-5 -46 C5 -62 36 -57 70 -63 M22 -57 C17 -36 4 -6 -3 4 M56 -60 C46 -34 32 -5 40 1 C44 4 53 1 59 -3'],
  'В': [57, 'M15 -35 C28 -43 44 -65 53 -66 C73 -72 48 -47 34 -38 M38 -63 C33 -49 -4 20 1 10 C8 3 29 -36 42 -39 C66 -48 59 -17 44 -6 C28 8 18 3 25 -6 M35 0 C44 0 51 -2 57 -3'],
  'а': [26, 'M0 0 C7 -3 15 -20 22 -20 C29 -21 21 -8 14 -3 C6 4 3 2 7 -7 C11 -16 22 -25 26 -21 M26 -21 C22 -14 15 -3 18 0 C20 2 23 0 26 -3'],
  'б': [28, 'M0 0 C8 -3 16 -20 27 -42 C32 -52 41 -61 45 -58 C49 -52 30 -45 26 -46 M28 -44 C22 -34 8 -6 11 -2 C15 5 32 -15 25 -20 C19 -24 11 -12 11 -6 M18 -1 C22 0 25 -1 28 -3'],
  'в': [25, 'M0 0 C11 -7 36 -44 37 -53 C38 -64 16 -27 10 -12 C6 -1 9 4 15 1 C23 -3 30 -16 26 -20 C23 -23 15 -16 12 -11 M15 1 C19 2 23 -1 25 -3'],
  'г': [24, 'M0 0 C7 -5 14 -19 20 -20 C32 -23 19 -10 13 -4 C8 2 17 3 24 -3'],
  'д': [29, 'M0 0 C7 -2 17 -21 24 -20 C29 -19 23 -10 17 -4 C10 3 5 4 7 -4 C9 -12 18 -22 26 -23 M27 -22 C19 -6 8 25 0 34 C-11 49 -11 35 -3 26 C5 18 19 10 29 -3'],
  'е': [23, 'M0 0 C10 -4 29 -20 22 -21 C17 -23 7 -11 8 -4 C9 5 20 0 23 -3'],
  'з': [26, 'M0 0 C9 -5 14 -16 21 -19 C32 -23 29 -14 17 -10 C28 -19 21 0 16 8 C4 28 -7 30 -5 22 C-3 13 17 6 26 -3'],
  'ж': [40, 'M0 0 C9 -4 18 -20 12 -21 M9 -9 C15 -13 17 -11 14 0 M30 -23 L15 2 M23 -10 C34 -14 41 -25 44 -21 C45 -17 31 -9 23 -10 C34 -13 27 5 40 -3'],
  'и': [28, 'M0 0 C5 -3 12 -13 15 -19 C11 -12 2 2 7 2 C14 1 25 -11 30 -21 C24 -11 17 -2 21 0 C22 1 25 -1 28 -3'],
  'й': [28, 'M0 0 C5 -3 12 -13 15 -19 C11 -12 2 2 7 2 C14 1 25 -11 30 -21 C24 -11 17 -2 21 0 C22 1 25 -1 28 -3 M19 -32 C16 -25 24 -24 30 -32'],
  'к': [28, 'M0 0 C6 -5 13 -15 17 -21 L6 1 M12 -10 C22 -12 29 -24 34 -21 C36 -16 19 -9 14 -10 C25 -14 17 6 28 -3'],
  'л': [27, 'M0 0 C-2 6 4 3 9 -5 C13 -11 15 -16 20 -21 C18 -13 11 -2 16 1 C19 3 24 0 27 -3'],
  'м': [35, 'M0 0 C-3 6 3 3 8 -5 C12 -11 15 -17 18 -20 C16 -13 9 0 12 0 C16 -3 25 -17 30 -21 C26 -11 21 -2 26 0 C29 1 33 -1 35 -3'],
  'н': [28, 'M0 0 C6 -4 13 -13 17 -21 C12 -12 6 -2 6 1 M12 -9 C18 -10 22 -12 27 -17 M31 -23 C24 -11 17 -2 21 0 C22 2 26 -1 28 -3'],
  'о': [28, 'M0 0 C5 -2 9 -8 12 -13 M23 -20 C15 -24 5 -7 7 -1 C9 8 29 -16 23 -20 M23 -20 C19 -12 19 -8 28 -12'],
  'п': [29, 'M0 0 C7 -5 13 -14 17 -21 C13 -13 7 -4 6 0 C13 -12 27 -25 30 -19 C31 -15 17 -2 22 0 C23 2 27 -1 29 -3'],
  'р': [27, 'M0 0 C7 -5 14 -16 18 -23 L-5 34 M12 -10 C23 -27 36 -26 29 -12 C22 4 12 4 14 -4 C16 2 22 0 27 -3'],
  'с': [24, 'M0 0 C7 -4 15 -17 23 -20 C30 -22 25 -15 23 -16 C22 -25 9 -11 9 -4 C9 4 20 0 24 -3'],
  'т': [39, 'M0 0 C7 -5 13 -15 17 -21 L5 1 C16 -14 24 -24 26 -20 C28 -16 16 -1 16 0 C25 -13 34 -24 37 -20 C40 -16 26 -2 31 0 C33 2 37 -1 39 -3 M15 -29 C25 -29 36 -30 45 -29'],
  'у': [29, 'M0 0 C6 -5 11 -13 16 -20 C12 -12 5 -1 8 1 C13 4 27 -13 32 -21 C23 -2 15 21 4 34 C-7 47 -12 43 -6 32 C0 22 22 7 29 -3'],
  'ч': [28, 'M0 0 C8 -7 13 -15 16 -21 C12 -15 9 -8 12 -7 C17 -5 24 -13 30 -21 C24 -11 18 -2 22 0 C23 2 26 -1 28 -3'],
  'ц': [30, 'M0 0 C5 -3 12 -13 15 -19 C11 -12 2 2 7 2 C14 1 25 -11 30 -21 C24 -11 17 -2 21 0 C22 1 26 -3 24 3 C19 18 10 31 9 26 C8 21 23 5 30 -3'],
  'ш': [42, 'M0 0 C7 -5 12 -15 16 -21 C12 -12 4 1 8 2 C13 4 25 -12 30 -21 C23 -9 18 0 22 1 C27 2 38 -12 43 -21 C36 -10 31 -2 35 0 C37 1 40 -1 42 -3'],
  'ы': [41, 'M0 0 C7 -5 13 -15 16 -21 C11 -11 5 2 10 2 C17 2 25 -10 23 -12 C20 -16 12 -5 11 -2 C19 3 34 -11 39 -20 C33 -9 29 -1 33 0 C36 1 39 -1 41 -3'],
  'ь': [25, 'M0 0 C7 -4 13 -15 16 -21 C11 -11 4 3 10 2 C18 1 26 -9 23 -12 C20 -16 12 -5 11 -2 C15 1 21 0 25 -3'],
  'я': [27, 'M0 0 C8 -4 18 -13 24 -19 C28 -23 29 -21 27 -19 C23 -24 11 -20 10 -12 C9 -8 18 -10 24 -16 M28 -22 C23 -12 16 -2 20 0 C23 1 25 -1 27 -3 M16 -11 C10 -4 5 1 3 2'],
  'ю': [40, 'M0 0 C7 -5 13 -15 17 -21 L6 1 M12 -10 C18 -8 24 -15 30 -19 C40 -27 41 -17 34 -8 C27 4 18 7 22 -5 C25 -14 35 -23 39 -20 C44 -16 37 -9 36 -9 C38 -8 42 -10 44 -12'],
  ' ': [20, ''],
  '—': [67, 'M8 -13 C24 -14 45 -14 59 -12'],
  ',': [12, 'M8 0 C7 4 4 6 2 7'],
  '.': [10, 'M5 0 L5.4 -.2'],
};

const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');

/** Natural pen lifts: a connector is only added to a genuinely adjoining letter. */
export function linePaths(line) {
  let x = 0;
  const paths = [];
  const controlPoints = [];
  for (const [i, char] of [...line].entries()) {
    const glyph = glyphs[char];
    if (!glyph) throw new Error(`Hand lettering has no drawn glyph for ${JSON.stringify(char)}`);
    const [advance, d] = glyph;
    // Match adjoining baselines directly; no vertical connector spikes.
    const connected = i > 0 && !' —,.'.includes(line[i - 1]);
    const entry = line[i - 1] === 'о' ? 'M0 -12 ' : 'M0 -3 ';
    if (d) {
      const path = connected ? d.replace(/^M0 0 /, entry) : d;
      paths.push(`<path data-letter="${escape(char)}" d="${path}" transform="translate(${x} 0)"/>`);
      // All hand-drawn paths use absolute M/L/C coordinates. Bézier curves stay
      // inside the hull of these points, so this also covers their curved tops.
      const coordinates = path.match(/[-+]?(?:\d*\.)?\d+/g).map(Number);
      for (let point = 0; point < coordinates.length; point += 2) controlPoints.push([x + coordinates[point], coordinates[point + 1]]);
    }
    x += advance;
  }
  return { paths: paths.join(''), width: x, controlPoints };
}

export function letteringSvg(lines, { color = '#f4f3ef', stroke = 1.4, title = lines.join(' '), lineHeight = 95, align = 'center', angle = -5 } = {}) {
  const rows = lines.map(linePaths);
  const width = Math.max(...rows.map(row => row.width)) + 56;
  const height = (rows.length - 1) * lineHeight + 146;
  const rowX = row => align === 'left' ? 28 : (width - row.width) / 2;
  const radians = angle * Math.PI / 180;
  const points = rows.flatMap((row, index) => row.controlPoints.map(([x, y]) => [
    rowX(row) + x * Math.cos(radians) - y * Math.sin(radians),
    91 + index * lineHeight + x * Math.sin(radians) + y * Math.cos(radians),
  ]));
  // The rise of a long, tilted line can put capitals above y=0 (notably П).
  // Expand the viewport around actual rotated geometry instead of clipping it.
  const padding = 4 + stroke / 2;
  const left = Math.min(0, ...points.map(([x]) => Math.floor(x - padding)));
  const top = Math.min(0, ...points.map(([, y]) => Math.floor(y - padding)));
  const right = Math.max(width, ...points.map(([x]) => Math.ceil(x + padding)));
  const bottom = Math.max(height, ...points.map(([, y]) => Math.ceil(y + padding)));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${right - left} ${bottom - top}" role="img" aria-label="${escape(title)}"><title>${escape(title)}</title><g fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${rows.map((row, i) => `<g transform="translate(${rowX(row)} ${91 + i * lineHeight}) rotate(${angle})">${row.paths}</g>`).join('')}</g></svg>`;
}

export const heroLines = ['Волшебство', 'начинается — здесь'];
