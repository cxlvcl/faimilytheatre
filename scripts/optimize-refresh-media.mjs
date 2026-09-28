import { execFileSync } from 'node:child_process';
const ffmpeg = '.local-tools/ffmpeg/node_modules/ffmpeg-static/ffmpeg';
const assets = [
  ['hero-team-desktop.png', 'hero-desktop.webp', 1672],
  ['hero-team-desktop.png', 'hero-desktop-1000.webp', 1000],
  ['hero-team-mobile.png', 'hero-mobile.webp', 941],
  ['hero-team-mobile.png', 'hero-mobile-600.webp', 600],
  ['about-team.png', 'about-team.webp', 1024],
  ['contact-logo.jpg', 'contact-logo.webp', 800],
];
for (const [source, destination, width] of assets) {
  execFileSync(ffmpeg, ['-v', 'error', '-y', '-i', `web/public/media/${source}`, '-vf', `scale=${width}:-1:flags=lanczos`, '-c:v', 'libwebp', '-quality', '91', '-compression_level', '6', 'web/public/media/' + destination]);
  console.log(destination);
}
