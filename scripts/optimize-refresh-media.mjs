import { execFileSync } from 'node:child_process';
const ffmpeg = '.local-tools/ffmpeg/node_modules/ffmpeg-static/ffmpeg';
const assets = [
  ['hero-team-desktop.png', 'hero-desktop.webp', 1672],
  ['hero-team-desktop.png', 'hero-desktop-1000.webp', 1000],
  ['hero-team-mobile.png', 'hero-mobile.webp', 941],
  ['hero-team-mobile.png', 'hero-mobile-600.webp', 600],
  ['about-team.png', 'about-team.webp', 1024],
  ['contact-logo.jpg', 'contact-logo.webp', 800],
  ['franchise-swan.png', 'franchise-swan.webp', 1500, 82],
  ['franchise-masterpieces.png', 'franchise-masterpieces.webp', 1664, 82],
  // Menu background (Little Prince); phones get a portrait crop centred on the prince.
  ['menu-prince.jpg', 'menu-prince.webp', 1920, 82],
  ['menu-prince.jpg', 'menu-prince-mobile.webp', 760, 82, 'crop=760:1080:120:0,'],
];
const requested = new Set(process.argv.slice(2));
for (const [source, destination, width, quality = 91, crop = ''] of assets) {
  if (requested.size && !requested.has(destination)) continue;
  const pixelFormat = destination === 'franchise-swan.webp' ? ['-pix_fmt', 'yuva420p'] : destination.startsWith('menu-') ? ['-pix_fmt', 'yuv420p'] : [];
  execFileSync(ffmpeg, ['-v', 'error', '-y', '-i', `web/public/media/${source}`, '-vf', `${crop}scale=${width}:-1:flags=lanczos`, '-c:v', 'libwebp', ...pixelFormat, '-quality', String(quality), '-compression_level', '6', 'web/public/media/' + destination]);
  console.log(destination);
}
