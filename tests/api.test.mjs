import test from 'node:test';
import assert from 'node:assert/strict';

async function api(t, cache = {}) {
  const entries = new Map(Object.entries(cache));
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: { getItem: key => entries.get(key) || null, setItem: (key, value) => entries.set(key, value) }, configurable: true });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else delete globalThis.localStorage; });
  return import(`../assets/github.js?test=${Math.random()}`);
}

test('API fetch is cached and simultaneous requests are deduplicated', async t => {
  const { github } = await api(t);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return { ok: true, status: 200, json: async () => [{ tag_name: 'v2' }] }; });
  const [a, b] = await Promise.all([github('/Feixiao/releases'), github('/Feixiao/releases')]);
  assert.equal(calls, 1);
  assert.deepEqual(a.data, b.data);
  assert.equal((await github('/Feixiao/releases')).data[0].tag_name, 'v2');
  assert.equal(calls, 1);
  await github('/Feixiao/releases', { force: true });
  assert.equal(calls, 2);
});

test('offline data is explicitly marked stale and keeps its original timestamp', async t => {
  const time = Date.now() - 3600000;
  const { github } = await api(t, { 'jomei-github-v1:/Feixiao/releases': JSON.stringify({ time, data: [{ tag_name: 'v1' }] }) });
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  const result = await github('/Feixiao/releases');
  assert.equal(result.stale, true);
  assert.equal(result.time, time);
  assert.equal(result.warning.code, 'network');
});

test('404 does not resurrect a cached deleted release', async t => {
  const { github } = await api(t, { 'jomei-github-v1:/Feixiao/releases/latest': JSON.stringify({ time: 1, data: { tag_name: 'v1' } }) });
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 404 }));
  await assert.rejects(github('/Feixiao/releases/latest'), { status: 404 });
});

test('rate limit pauses further calls and supplies an actionable error', async t => {
  const { github } = await api(t);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return { ok: false, status: 429, headers: new Headers({ 'retry-after': '60' }) }; });
  await assert.rejects(github('/Feixiao/releases/latest'), /GitHub rate limit/);
  await assert.rejects(github('/AirPort-RTW/releases/latest'), /GitHub rate limit/);
  assert.equal(calls, 1);
});

test('storage-disabled browsers still load release data', async t => {
  const { github } = await api(t);
  globalThis.localStorage.getItem = () => { throw new Error('disabled'); };
  globalThis.localStorage.setItem = () => { throw new Error('disabled'); };
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ tag_name: 'v3' }) }));
  assert.equal((await github('/Feixiao/releases/latest')).data.tag_name, 'v3');
});
