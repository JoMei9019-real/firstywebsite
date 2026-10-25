// Runs before page content to apply the system appearance without a dark flash.
(() => {
  const root = document.documentElement;
  const key = 'jomei-appearance';
  const normalize = value => ['light', 'dark'].includes(value) ? value : 'system';
  const read = () => {
    try { return normalize(localStorage.getItem(key)); } catch { return 'system'; }
  };
  const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  let appearance = read();
  const apply = () => {
    root.dataset.appearance = appearance;
    root.dataset.theme = appearance === 'system' ? (media?.matches ? 'dark' : 'light') : appearance;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', root.dataset.theme === 'dark' ? '#101613' : '#f8faf7');
    document.dispatchEvent(new Event('themechange'));
  };
  // Old binary preferences intentionally do not suppress the new System default.
  document.addEventListener('appearancechange', () => {
    appearance = normalize(root.dataset.appearance);
    try { localStorage.setItem(key, appearance); } catch { /* Storage is optional. */ }
    apply();
  });
  const onSystemChange = () => { if (appearance === 'system') apply(); };
  if (media?.addEventListener) media.addEventListener('change', onSystemChange);
  else media?.addListener?.(onSystemChange);
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) { appearance = read(); apply(); }
  });
  apply();
  try { root.lang = localStorage.getItem('jomei-language') === 'de' ? 'de' : 'en'; } catch { root.lang = 'en'; }
})();
