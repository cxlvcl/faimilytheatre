import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { heroLines, letteringSvg, linePaths } from '../design/lettering/hand-lettering.mjs';

const aboutLines = ['Театр Музыки и Песка —', 'истории, рассказанные', 'музыкой, словом и песком'];
for (const [name, lines, lineHeight] of [['hero', heroLines, 95], ['about', aboutLines, 93]]) {
  test(`${name}: every tilted stroke, including capital П, fits inside the SVG viewport`, () => {
    const svg = letteringSvg(lines, { lineHeight });
    const [left, top, width, height] = svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
    const rows = lines.map(linePaths);
    const originalWidth = Math.max(...rows.map(row => row.width)) + 56;
    const angle = -5 * Math.PI / 180;
    rows.forEach((row, index) => row.controlPoints.forEach(([x, y]) => {
      const rotatedX = (originalWidth - row.width) / 2 + x * Math.cos(angle) - y * Math.sin(angle);
      const rotatedY = 91 + index * lineHeight + x * Math.sin(angle) + y * Math.cos(angle);
      assert.ok(rotatedX - .7 >= left && rotatedX + .7 <= left + width, 'Horizontal pen stroke is not cropped');
      assert.ok(rotatedY - .7 >= top && rotatedY + .7 <= top + height, 'Vertical pen stroke is not cropped');
    }));
    if (name === 'about') {
      assert.ok(top < 0, 'Long tilted capitals need extra space above the original viewport');
      assert.ok(svg.includes('data-letter="П"'));
    }
  });
}

test('The displayed image dimensions match the expanded SVG viewports', () => {
  for (const [name, expected] of [['hero', [567, 246]], ['about', [780, 357]]]) {
    const file = fs.readFileSync(`web/public/media/lettering/${name}.svg`, 'utf8');
    assert.deepEqual(file.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number).slice(2), expected);
  }
  const component = fs.readFileSync('web/src/components/TheatreLettering.tsx', 'utf8');
  assert.ok(component.includes("width={variant === 'hero' ? 567 : 780}"));
  assert.ok(component.includes("height={variant === 'hero' ? 246 : 357}"));
});
