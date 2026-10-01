import { execFileSync } from 'node:child_process';

const ffmpeg = '.local-tools/ffmpeg/node_modules/ffmpeg-static/ffmpeg';
const [desktopSource, mobileSource] = process.argv.slice(2);
if (!desktopSource || !mobileSource) {
  console.error('Usage: node scripts/optimize-hero-video.mjs <desktop.mp4> <mobile.mp4>');
  process.exit(1);
}

const media = 'web/public/media';
const crf = '28';
const videos = [
  [desktopSource, 'hero-2026-desktop.mp4', 1920, 1080],
  [desktopSource, 'hero-2026-desktop-1280.mp4', 1280, 720],
  [mobileSource, 'hero-2026-mobile.mp4', 720, 1280],
];

for (const [source, destination, width, height] of videos) {
  execFileSync(ffmpeg, ['-v', 'error', '-y', '-i', source, '-map', '0:v:0', '-vf', `fps=25,scale=${width}:${height}:flags=lanczos`, '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', crf, '-preset', 'slow', '-movflags', '+faststart', '-an', `${media}/${destination}`]);
  console.log(destination);
}

for (const [source, destination] of [
  [`${media}/hero-2026-desktop.mp4`, 'hero-2026-desktop-poster.webp'],
  [`${media}/hero-2026-mobile.mp4`, 'hero-2026-mobile-poster.webp'],
]) {
  execFileSync(ffmpeg, ['-v', 'error', '-y', '-i', source, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '80', '-compression_level', '6', `${media}/${destination}`]);
  console.log(destination);
}
