import { initLanguage, t } from './i18n.js';
import { initTheme } from './shared.js';
initLanguage();
initTheme();

const storageKey = 'jomei-feixiao-1.1.0-guide';
const checkboxes = [...document.querySelectorAll('[data-step-complete]')];
const progress = document.querySelector('#guide-progress');
const progressLabel = document.querySelector('#guide-progress-label');
const copyStatus = document.querySelector('#guide-copy-status');
let completed = new Set();
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (Array.isArray(saved)) completed = new Set(saved.filter(value => typeof value === 'string' && /^[1-6]$/.test(value)));
} catch { /* A checklist also works without browser storage. */ }
function updateProgress() {
  for (const input of checkboxes) {
    input.checked = completed.has(input.dataset.stepComplete);
    input.closest('.guide-step')?.classList.toggle('is-complete', input.checked);
  }
  for (const link of document.querySelectorAll('[data-step-link]')) link.classList.toggle('is-complete', completed.has(link.dataset.stepLink));
  if (progress) progress.value = completed.size;
  if (progressLabel) progressLabel.textContent = t('{count} of 6 steps checked', { count: completed.size });
}
function saveProgress() {
  try { localStorage.setItem(storageKey, JSON.stringify([...completed])); } catch { /* Optional storage. */ }
  updateProgress();
}
for (const input of checkboxes) input.addEventListener('change', () => {
  if (input.checked) completed.add(input.dataset.stepComplete);
  else completed.delete(input.dataset.stepComplete);
  saveProgress();
});
document.querySelector('[data-reset-guide]')?.addEventListener('click', () => {
  completed.clear(); saveProgress();
  if (copyStatus) copyStatus.textContent = t('Checklist reset.');
});
async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return; } catch { /* Try the local fallback. */ }
  }
  const field = document.createElement('textarea');
  field.value = text; field.style.cssText = 'position:fixed;left:-9999px;top:0';
  field.setAttribute('readonly', '');
  document.body.append(field); field.select();
  try { if (!document.execCommand('copy')) throw new Error('Copy unavailable'); }
  finally { field.remove(); }
}
for (const button of document.querySelectorAll('[data-copy-target]')) button.addEventListener('click', async () => {
  const target = document.getElementById(button.dataset.copyTarget);
  if (!target) return;
  try {
    await copyText(target.textContent);
    button.focus();
    button.textContent = t('Copied');
    if (copyStatus) copyStatus.textContent = t('Copied to clipboard.');
    setTimeout(() => { button.textContent = t('Copy'); }, 2000);
  } catch {
    if (copyStatus) copyStatus.textContent = t('Copy failed. Select the command and copy it manually.');
  }
});
document.addEventListener('languagechange', () => {
  updateProgress();
  for (const button of document.querySelectorAll('[data-copy-target]')) button.textContent = t('Copy');
  if (copyStatus) copyStatus.textContent = '';
});
updateProgress();
