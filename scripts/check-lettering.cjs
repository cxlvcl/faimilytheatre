// Render the actual React component without a browser, catching missing glyphs.
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const source = path.resolve('web/src/components/TheatreLettering.tsx')
const compiled = ts.transpileModule(fs.readFileSync(source, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText
const mod = new Module(source, module)
mod.filename = source
mod.paths = Module._nodeModulePaths(path.dirname(source))
mod._compile(compiled, source)
fs.mkdirSync('release/lettering', { recursive: true })
for (const [name, lines] of Object.entries({ hero: ['Волшебство', 'начинается — здесь'], about: ['Театр Музыки и Песка —', 'где сказка становится кино,', 'а кино — живым'] })) {
  const svg = renderToStaticMarkup(React.createElement(mod.exports.TheatreLettering, { lines })).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ').replace('currentColor', '#111111')
  fs.writeFileSync(`release/lettering/${name}.svg`, svg)
  console.log(`${name}: all glyphs rendered as SVG paths`)
}
