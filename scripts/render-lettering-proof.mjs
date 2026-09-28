import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { heroLines, letteringSvg } from '../design/lettering/hand-lettering.mjs';

const require = createRequire(import.meta.url);
const { Resvg } = require('../.local-tools/lettering/node_modules/@resvg/resvg-js');
const out = path.resolve('release/lettering-proof');
fs.mkdirSync(out, { recursive: true });
const rasterize = (svg, name, width) => {
  // System fonts only label the comparison board, never the drawn lettering.
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: true } }).render().asPng();
  fs.writeFileSync(path.join(out, name), png);
};
const lettering = letteringSvg(heroLines);
fs.writeFileSync(path.join(out, 'hero-hand-drawn.svg'), lettering);
const placeSvg = (svg, x, y, w, h) => svg.replace('<svg ', `<svg x="${x}" y="${y}" width="${w}" height="${h}" `);
const quote = letteringSvg(['В музыке я ценю', 'тишину —', 'она помогает слышать', 'главное.'], { stroke: 1.01, lineHeight: 61, align: 'left' });
// resvg has no WebP decoder. Only transcode the unchanged reference for embedding.
const photo = execFileSync('.local-tools/ffmpeg/node_modules/ffmpeg-static/ffmpeg', ['-v', 'error', '-i', 'web/public/media/musicians/3.webp', '-f', 'image2pipe', '-vcodec', 'png', '-'], { maxBuffer: 10 * 1024 * 1024 }).toString('base64');
const board = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1230" viewBox="0 0 1600 1230">
<rect width="1600" height="1230" fill="#131413"/>
<text x="72" y="65" fill="#b9b9af" font-family="Arial" font-size="18" letter-spacing="3">РУЧНАЯ ОТРИСОВКА · ОБРАЗЕЦ ДЛЯ СОГЛАСОВАНИЯ</text>
<text x="72" y="130" fill="#ffffff" font-family="Arial" font-size="28">Новая фраза на главной</text>
${placeSvg(lettering, 220, 154, 1160, 493)}
<path d="M72 660H1528" stroke="#3b3c38"/>
<text x="72" y="710" fill="#b9b9af" font-family="Arial" font-size="18">ОРИГИНАЛ НА ФОТО</text>
<svg x="72" y="755" width="680" height="350" viewBox="36 913 560 294"><image href="data:image/png;base64,${photo}" width="820" height="1230"/></svg>
<text x="860" y="710" fill="#b9b9af" font-family="Arial" font-size="18">ТА ЖЕ ЦИТАТА · РУЧНЫЕ КРИВЫЕ</text>
${placeSvg(quote, 840, 754, 680, 359)}
<text x="72" y="1182" fill="#8f9088" font-family="Arial" font-size="18">SVG-контуры, без готового шрифта. В главной фразе штрих немного толще, чем в цитате.</text>
</svg>`;
fs.writeFileSync(path.join(out, 'comparison.svg'), board);
rasterize(board, 'comparison.png', 1600);
const plain = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="760"><rect width="1600" height="760" fill="#111211"/>${placeSvg(lettering, 150, 115, 1300, 550)}</svg>`;
rasterize(plain, 'hero-hand-drawn.png', 1600);
fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ручная отрисовка — образец</title><style>body{margin:0;background:#131413}img{display:block;width:100%;max-width:1600px;margin:auto}a{color:#ddd;font:18px sans-serif;display:block;margin:24px;text-align:center}</style><img src="comparison.png" alt="Ручная отрисовка главной фразы и сравнение с цитатой на фотографии музыканта"><a href="hero-hand-drawn.svg">Открыть главную фразу в векторе</a></html>`);
console.log(`Lettering proof generated in ${out}`);
