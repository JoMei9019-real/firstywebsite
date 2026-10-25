import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
const source = await readFile(new URL('../assets/theme.js', import.meta.url), 'utf8');

function boot({ dark = false, values = {}, blocked = false, legacy = false } = {}) {
  const storage = new Map(Object.entries(values));
  const documentListeners = new Map(), windowListeners = new Map();
  const root = { dataset: {} };
  const meta = { setAttribute(name, value) { this[name] = value; } };
  let mediaListener;
  const media = { matches: dark };
  media[legacy ? 'addListener' : 'addEventListener'] = (...args) => { mediaListener = args.at(-1); };
  const document = { documentElement: root, querySelector: () => meta,
    addEventListener: (type, fn) => documentListeners.set(type, fn),
    dispatchEvent: event => documentListeners.get(event.type)?.(event),
  };
  runInNewContext(source, {
    document, window: { addEventListener: (type, fn) => windowListeners.set(type, fn) }, Event,
    matchMedia: query => { assert.equal(query, '(prefers-color-scheme: dark)'); return media; },
    localStorage: {
      getItem(key) { if (blocked) throw new Error('blocked'); return storage.get(key) || null; },
      setItem(key, value) { if (blocked) throw new Error('blocked'); storage.set(key, value); },
    },
  });
  return { root, storage, meta,
    system(dark) { media.matches = dark; mediaListener(); },
    select(value) { root.dataset.appearance = value; document.dispatchEvent(new Event('appearancechange')); },
    external(value) { if (value === null) storage.delete('jomei-appearance'); else storage.set('jomei-appearance', value); windowListeners.get('storage')({ key: 'jomei-appearance' }); },
  };
}

test('defaults to system light/dark and follows live OS changes, ignoring old binary preferences', () => {
  for (const dark of [false, true]) {
    const page = boot({ dark, values: { 'jomei-theme': dark ? 'light' : 'dark' } });
    assert.equal(page.root.dataset.appearance, 'system');
    assert.equal(page.root.dataset.theme, dark ? 'dark' : 'light');
    assert.equal(page.meta.content, dark ? '#101613' : '#f8faf7');
    page.system(!dark);
    assert.equal(page.root.dataset.theme, dark ? 'light' : 'dark');
  }
});

test('explicit choices persist across pages, can return to system, and synchronize between tabs', () => {
  const page = boot({ dark: true });
  page.select('light');
  assert.equal(page.storage.get('jomei-appearance'), 'light');
  page.system(true);
  assert.equal(page.root.dataset.theme, 'light');
  assert.equal(boot({ dark: true, values: Object.fromEntries(page.storage) }).root.dataset.theme, 'light');
  page.select('system');
  assert.equal(page.root.dataset.theme, 'dark');
  page.system(false);
  assert.equal(page.root.dataset.theme, 'light');
  page.external('dark');
  assert.equal(page.root.dataset.theme, 'dark');
  page.external(null);
  assert.equal(page.root.dataset.appearance, 'system');
  assert.equal(page.root.dataset.theme, 'light');
});

test('system behavior survives blocked storage, invalid settings and legacy media listeners', () => {
  const page = boot({ dark: true, blocked: true, legacy: true });
  assert.equal(page.root.dataset.theme, 'dark');
  page.system(false);
  assert.equal(page.root.dataset.theme, 'light');
  page.select('dark');
  assert.equal(page.root.dataset.theme, 'dark');
  assert.equal(boot({ values: { 'jomei-appearance': 'invalid' } }).root.dataset.appearance, 'system');
});
