import { initLanguage, t } from './i18n.js';
import { initTheme } from './shared.js';
initLanguage();
initTheme();

// Both platform guides remain readable when JavaScript is unavailable.
const osSelect = document.querySelector('#airport-os');
function showPlatform() {
  for (const panel of document.querySelectorAll('[data-os-panel]')) {
    panel.hidden = panel.dataset.osPanel !== osSelect.value;
  }
}
if (osSelect) {
  osSelect.closest('.airport-os-choice').hidden = false;
  osSelect.addEventListener('change', showPlatform);
  showPlatform();
}
const status = document.querySelector('#airport-copy-status');
for (const button of document.querySelectorAll('[data-airport-copy]')) {
  button.addEventListener('click', async () => {
    const command = document.getElementById(button.dataset.airportCopy)?.textContent;
    if (!command) return;
    let field;
    try {
      let copied = false;
      if (navigator.clipboard?.writeText) {
        try { await navigator.clipboard.writeText(command); copied = true; } catch { /* Use local fallback. */ }
      }
      if (!copied) {
        field = document.createElement('textarea');
        field.value = command;
        field.style.cssText = 'position:fixed;left:-9999px;top:0';
        field.setAttribute('readonly', '');
        document.body.append(field);
        field.select();
        if (!document.execCommand('copy')) throw new Error('Copy unavailable');
      }
      button.textContent = t('Copied');
      status.textContent = t('Copied to clipboard.');
      setTimeout(() => { button.textContent = t('Copy'); }, 2000);
    } catch {
      status.textContent = t('Copy failed. Select the command and copy it manually.');
    } finally {
      field?.remove();
      button.focus();
    }
  });
}
document.addEventListener('languagechange', () => {
  for (const button of document.querySelectorAll('[data-airport-copy]')) button.textContent = t('Copy');
  if (status) status.textContent = '';
});
