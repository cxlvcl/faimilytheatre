import { build } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
await build({ root: resolve('web'), configFile: resolve('web/vite.config.ts'), build: { ssr: 'src/entry-server.tsx', outDir: '.ssr', emptyOutDir: true, manifest: false, copyPublicDir: false } });
const { render } = await import(pathToFileURL(resolve('web/.ssr/entry-server.js')).href);
await mkdir('web/dist/.vite/ssr', { recursive: true });
for (const [path, name] of [['/', 'home'], ['/franchise', 'franchise']]) {
  await writeFile(`web/dist/.vite/ssr/${name}.html`, render(path));
  console.log(`Server HTML: ${path}`);
}
