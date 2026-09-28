import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { heroLines, letteringSvg } from '../design/lettering/hand-lettering.mjs';
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const directory = 'web/public/media/lettering';
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(`${directory}/hero.svg`, letteringSvg(heroLines));
fs.writeFileSync(`${directory}/about.svg`, letteringSvg(['Театр Музыки и Песка —', 'истории, рассказанные', 'музыкой, словом и песком'], { color: '#111111', lineHeight: 93 }));
console.log('Built manually drawn SVG lettering: hero, about (5 degree rise, 1.4 stroke)');
