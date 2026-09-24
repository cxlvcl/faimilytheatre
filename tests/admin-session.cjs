const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function client(remember = false) {
  const calls = []
  const storage = new Map(remember ? [['theatre-admin-remember-session', 'yes']] : [])
  const source = fs.readFileSync('admin/src/api.ts', 'utf8').replaceAll('import.meta.env', '({ DEV: false, VITE_API_BASE: "http://127.0.0.1:8080/api" })')
  const exports = {}
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, require: () => ({ isTauri: () => true, invoke: async (command) => { calls.push(command); return command === 'load_token' ? 'saved-session' : undefined } }),
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    URL, FormData, AbortSignal,
  })
  return { api: exports, calls, storage }
}

test('Default startup and temporary login never access Keychain', async () => {
  const { api, calls, storage } = client()
  assert.equal(await api.restoreToken(), null)
  await api.saveToken('temporary-session')
  await api.clearToken()
  assert.deepEqual(calls, [])
  assert.equal(storage.size, 0)
})
test('Token stays in memory and never enters persistent storage', async () => {
  const { api, calls, storage } = client()
  await api.saveToken('private-token')
  assert.equal(storage.size, 0)
  assert.ok(![...storage.values()].includes('private-token'))
  await api.clearToken()
  assert.deepEqual(calls, [])
})
test('Legacy remember preference cannot trigger any Keychain request', async () => {
  const { api, calls, storage } = client(true)
  assert.equal(await api.restoreToken(), null)
  assert.deepEqual(calls, [])
  assert.equal(storage.size, 0)
})
