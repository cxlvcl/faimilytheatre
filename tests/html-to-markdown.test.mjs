import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { chromium } from 'playwright-core';

// The converter needs a real DOMParser: run it in Chrome (skipped when Chrome is absent).
const source = ts.transpileModule(fs.readFileSync('admin/src/lib/htmlToMarkdown.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace(/^import .*$/gm, '').replace(/^export /gm, '');

let browser;
try { browser = await chromium.launch({ channel: 'chrome' }); } catch { browser = null; }

test('Word and Google Docs paste becomes the site Markdown', { skip: !browser && 'Chrome is not installed' }, async () => {
  const page = await browser.newPage();
  await page.setContent('<body></body>');
  await page.addScriptTag({ content: `${source}\nwindow.convert = htmlToMarkdown;` });
  const convert = html => page.evaluate(value => window.convert(value), html);
  assert.equal(
    await convert('<b style="font-weight:normal;" id="docs-internal-guid-1"><h2><span>Почему песок</span></h2><p><span>Текст и </span><span style="font-weight:700">жирный</span><span style="font-style:italic"> курсив</span></p><ul><li><p>Один</p></li><li><p>Два</p></li></ul><p><a href="https://vk.ru/lmtales">ВК</a></p></b>'),
    '## Почему песок\n\nТекст и **жирный** *курсив*\n\n- Один\n- Два\n\n[ВК](https://vk.ru/lmtales)',
  );
  assert.equal(
    await convert('<!--StartFragment--><p class=MsoNormal><b>Жирный</b><o:p></o:p></p><p style="mso-list:l0 level1 lfo1">·&nbsp;&nbsp;Первый</p><p style="mso-list:l0 level1 lfo1">·&nbsp;&nbsp;Второй</p><!--EndFragment-->'),
    '**Жирный**\n\n- Первый\n- Второй',
  );
  assert.equal(
    await convert('<table><tr><th>Спектакль</th><th>Возраст</th></tr><tr><td>А | Б</td><td>6+</td></tr></table><blockquote>Цитата</blockquote><ol><li>Раз</li><li>Два</li></ol><p><img src="x.png">Текст<a href="/local">ссылка</a></p>'),
    '| Спектакль | Возраст |\n| --- | --- |\n| А / Б | 6+ |\n\n> Цитата\n\n1. Раз\n2. Два\n\nТекстссылка',
  );
  await browser.close();
});
