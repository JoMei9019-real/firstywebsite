import { t, locale } from './i18n.js';
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export function safeURL(value, base = 'https://github.com/') {
  try {
    const url = new URL(value, base);
    return url.protocol === 'https:' ? url.href : '#';
  } catch { return '#'; }
}
export function date(value, options = {}) {
  return new Date(value).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric', ...options });
}
export const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg>';
export const download = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5"/></svg>';

// Render a deliberately small Markdown subset. Raw HTML is always text.
function inline(source, base) {
  const tokens = [];
  const token = html => `\u0000${tokens.push(html) - 1}\u0000`;
  let text = String(source).replace(/\u0000/g, '');
  text = text.replace(/`([^`]+)`/g, (_, code) => token(`<code>${escapeHTML(code)}</code>`));
  text = text.replace(/!?\[([^\]]+)\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g, (_, label, url) => {
    return token(`<a href="${escapeHTML(safeURL(url, base))}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)}</a>`);
  });
  text = escapeHTML(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return text.replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[Number(i)]);
}
export function markdown(source, base) {
  const lines = String(source || t('No release notes were provided for this version.')).replace(/\r/g, '').split('\n');
  let html = '', paragraph = [], list = '', itemLines = [], code = null;
  const flush = () => { if (paragraph.length) { html += `<p>${inline(paragraph.join(' '), base)}</p>`; paragraph = []; } };
  const flushItem = () => { if (itemLines.length) { html += `<li>${inline(itemLines.join(' '), base)}</li>`; itemLines = []; } };
  const closeList = () => { flushItem(); if (list) { html += `</${list}>`; list = ''; } };
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      flush(); closeList();
      if (code !== null) { html += `<pre><code>${escapeHTML(code.join('\n'))}</code></pre>`; code = null; }
      else code = [];
      continue;
    }
    if (code !== null) { code.push(line); continue; }
    const heading = line.match(/^#{1,6}\s+(.+)/);
    const item = line.match(/^\s*(?:([-*+])|\d+\.)\s+(.+)/);
    if (!line.trim()) { flush(); closeList(); }
    else if (heading) { flush(); closeList(); html += `<h4>${inline(heading[1], base)}</h4>`; }
    else if (item) {
      flush(); const next = item[1] ? 'ul' : 'ol';
      if (list !== next) { closeList(); html += `<${next}>`; list = next; }
      else flushItem();
      itemLines = [item[2]];
    } else if (/^>\s?/.test(line)) { flush(); closeList(); html += `<blockquote>${inline(line.replace(/^>\s?/, ''), base)}</blockquote>`; }
    else if (list) itemLines.push(line.trim());
    else paragraph.push(line);
  }
  flush(); closeList();
  if (code !== null) html += `<pre><code>${escapeHTML(code.join('\n'))}</code></pre>`;
  return html;
}

export function initTheme() {
  const button = document.querySelector('[data-theme-toggle]');
  const root = document.documentElement;
  const update = () => {
    const light = root.dataset.theme === 'light';
    button?.setAttribute('aria-label', light ? t('Enable dark theme') : t('Enable light theme'));
    button?.setAttribute('aria-pressed', String(light));
  };
  button?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('jomei-theme', root.dataset.theme); } catch { /* Optional */ }
    update();
  });
  document.addEventListener('languagechange', update);
  update();
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
}
