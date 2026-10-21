import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GERMAN, getLanguage, setLanguage, t, locale, errorMessage } from '../assets/i18n.js';
import { date, markdown } from '../assets/shared.js';
import { formatBytes } from '../assets/github.js';

function storage(t) {
  const old = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value) } });
  t.after(() => { setLanguage('en', { persist: false }); if (old) Object.defineProperty(globalThis, 'localStorage', old); else delete globalThis.localStorage; });
  return data;
}

test('English is the default; German persists across page loads and switches back', async context => {
  const data = storage(context);
  assert.equal(getLanguage(), 'en');
  assert.equal(t('Download artifact'), 'Download artifact');
  setLanguage('de');
  assert.equal(data.get('jomei-language'), 'de');
  assert.equal(t('Download artifact'), 'Artifact herunterladen');
  const nextPage = await import(`../assets/i18n.js?reload=${Math.random()}`);
  assert.equal(nextPage.getLanguage(), 'de');
  setLanguage('en');
  assert.equal(t('Download artifact'), 'Download artifact');
  assert.equal(data.get('jomei-language'), 'en');
});

test('dates, sizes, Markdown fallbacks and existing API errors follow language changes', () => {
  const error = { code: 'not-found' };
  setLanguage('en', { persist: false });
  assert.equal(locale(), 'en-GB');
  assert.match(date('2026-10-21'), /October/);
  assert.equal(formatBytes(1.5 * 1024 * 1024), '1.5 MB');
  assert.match(markdown(''), /No release notes/);
  assert.match(errorMessage(error), /Not available/);
  setLanguage('de', { persist: false });
  assert.match(date('2026-10-21'), /Oktober/);
  assert.equal(formatBytes(1.5 * 1024 * 1024), '1,5 MB');
  assert.match(markdown(''), /keine Release Notes/);
  assert.match(errorMessage(error), /noch nicht verfügbar/);
  assert.equal(t('{visible} of {total} builds · Newest first', { visible: 2, total: 8 }), '2 von 8 Builds · Neueste zuerst');
  setLanguage('en', { persist: false });
});

test('language selection works when browser storage is disabled', context => {
  storage(context);
  localStorage.getItem = () => { throw new Error('disabled'); };
  localStorage.setItem = () => { throw new Error('disabled'); };
  assert.doesNotThrow(() => setLanguage('de'));
  assert.equal(t('Projects'), 'Projekte');
  setLanguage('invalid');
  assert.equal(getLanguage(), 'en');
});

test('translations preserve all dynamic placeholders', () => {
  const placeholders = text => (text.match(/\{[a-zA-Z]+\}/g) || []).sort();
  for (const [english, german] of Object.entries(GERMAN)) {
    assert.ok(german.length, english);
    assert.deepEqual(placeholders(english), placeholders(german), english);
  }
});

test('both static pages default to English and offer an accessible EN/DE selector', async () => {
  for (const path of ['../index.html', '../beta/index.html']) {
    const html = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(html, /<html lang="en"/);
    assert.match(html, /data-language-select aria-label="Language"/);
    assert.match(html, /value="en" lang="en">EN/);
    assert.match(html, /value="de" lang="de">DE/);
    assert.ok(!/[äöüÄÖÜß]/.test(html), path);
  }
});

test('static text, metadata and selector update reversibly and announce changes', async context => {
  storage(context);
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const text = { textContent: '  Great hardware.  ', parentElement: { closest: () => false } };
  const meta = { attributes: { content: 'JoMei9019 — Open Source. New possibilities.' }, getAttribute(key) { return this.attributes[key]; }, setAttribute(key, value) { this.attributes[key] = value; } };
  const selector = { value: 'en', addEventListener(event, listener) { this.onChange = listener; } };
  const events = [];
  const doc = { documentElement: { lang: 'en' }, createTreeWalker: () => { let read = false; return { nextNode: () => { if (read) return null; read = true; return text; } }; }, querySelectorAll: query => query === '[data-language-select]' ? [selector] : [meta], dispatchEvent: event => events.push(event.type) };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  context.after(() => { if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument); else delete globalThis.document; });
  const page = await import(`../assets/i18n.js?dom=${Math.random()}`);
  page.initLanguage();
  selector.value = 'de'; selector.onChange();
  assert.equal(doc.documentElement.lang, 'de');
  assert.equal(text.textContent, '  Gute Hardware.  ');
  assert.equal(meta.attributes.content, 'JoMei9019 — Open Source. Neue Möglichkeiten.');
  page.setLanguage('en');
  assert.equal(text.textContent, '  Great hardware.  ');
  assert.equal(meta.attributes.content, 'JoMei9019 — Open Source. New possibilities.');
  assert.equal(selector.value, 'en');
  assert.ok(events.includes('languagechange'));
});
