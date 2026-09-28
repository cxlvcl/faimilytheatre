const { test } = require('node:test')
const assert = require('node:assert/strict')
const ts = require('typescript')
const fs = require('node:fs')
const vm = require('node:vm')
const exportsFromSource = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('web/src/lib/scrollPolicy.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, { exports: exportsFromSource })
const { listReturnState, scrollDestination } = exportsFromSource

test('Only a list-to-performance link captures the exact history entry and scroll position', () => {
  for (const path of ['/repertoire', '/afisha']) {
    const origin = listReturnState(path, 'entry-1', 3540, '/repertoire/show')
    assert.equal(origin.pathname, path)
    assert.equal(origin.key, 'entry-1')
    assert.equal(origin.y, 3540)
    assert.equal(listReturnState(path, 'entry-1', -20, '/repertoire/show').y, 0)
    for (const target of ['/', '/faq', '/afisha', '/repertoire']) assert.equal(listReturnState(path, 'entry-1', 3540, target), undefined)
  }
  assert.equal(listReturnState('/faq', 'entry-1', 3540, '/repertoire/show'), undefined)
})

test('Back from a performance restores only its originating repertoire/afisha entry', () => {
  for (const path of ['/repertoire', '/afisha']) {
    const origin = listReturnState(path, 'entry-1', 3540, '/repertoire/show')
    assert.equal(scrollDestination('POP', '/repertoire/show', path, 'entry-1', origin), 3540)
    assert.equal(scrollDestination('POP', '/repertoire/show', path, 'other-entry', origin), 0)
    assert.equal(scrollDestination('PUSH', '/repertoire/show', path, 'entry-1', origin), 0)
    assert.equal(scrollDestination('REPLACE', '/repertoire/show', path, 'entry-1', origin), 0)
    assert.equal(scrollDestination('POP', '/faq', path, 'entry-1', origin), 0)
    assert.equal(scrollDestination('POP', '/repertoire/show', '/faq', 'entry-1', origin), 0)
  }
})

test('Direct visits, reloads and all other history navigations start at the top', () => {
  for (const path of ['/', '/repertoire', '/afisha', '/faq', '/franchise', '/repertoire/show']) {
    assert.equal(scrollDestination('POP', '', path, 'default'), 0)
    assert.equal(scrollDestination('POP', '/faq', path, 'entry'), 0)
  }
})
