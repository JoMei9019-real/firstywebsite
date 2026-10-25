import { readFile } from 'node:fs/promises';

// A data-only DOM adapter exercises the actual deployed renderers and module
// graph without launching a browser or fetching public services.
export async function renderPage(context, page, payload) {
  const elements = new Map();
  const element = key => {
    if (!elements.has(key)) elements.set(key, {
      value: '', innerHTML: '', textContent: '', dataset: {}, attributes: {}, listeners: new Map(),
      classList: { toggle() {} }, setAttribute(name, value) { this.attributes[name] = value; },
      addEventListener(name, listener) { this.listeners.set(name, listener); },
      trigger(name, event = {}) { return this.listeners.get(name)?.(event); },
      querySelector(selector) { return element(`${key} ${selector}`); },
      focus() {}, scrollIntoView() {},
    });
    return elements.get(key);
  };
  const events = new Map();
  const languageSelect = element('language');
  const tabs = ['airport', 'feixiao'].map(key => {
    const button = element(`tab:${key}`); button.dataset.projectTab = key; return button;
  });
  const document = {
    hidden: false, documentElement: { lang: 'en', dataset: { theme: 'dark' } },
    createTreeWalker() { return { nextNode: () => null }; },
    querySelector: element,
    querySelectorAll(query) {
      if (query === '[data-language-select]') return [languageSelect];
      if (query === '[data-project-tab]') return tabs;
      return [];
    },
    addEventListener(name, listener) { if (!events.has(name)) events.set(name, []); events.get(name).push(listener); },
    dispatchEvent(event) { for (const listener of events.get(event.type) || []) listener(event); },
  };
  const storage = new Map();
  let requests = 0;
  const globals = {
    document,
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    setInterval: () => 0,
    matchMedia: () => ({ matches: false }),
    fetch: async url => { requests++; return { ok: true, status: 200, json: async () => payload(String(url)) }; },
  };
  for (const [key, value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    context.after(() => { if (previous) Object.defineProperty(globalThis, key, previous); else delete globalThis[key]; });
  }
  const htmlURL = new URL(`../../${page}`, import.meta.url);
  const html = await readFile(htmlURL, 'utf8');
  const entry = new URL(html.match(/<script type="module" src="([^"]+)"/)[1], htmlURL);
  await import(entry.href);
  const language = await import(new URL('./i18n.js', entry));
  for (let i = 0; i < 10; i++) await new Promise(setImmediate);
  return { element, document, language, tabs, requests: () => requests };
}
