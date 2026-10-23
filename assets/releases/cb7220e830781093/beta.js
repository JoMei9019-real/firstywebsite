import { github, repoURL, betaBuilds, isExpired, artifactURL, formatBytes } from './github.js';
import { escapeHTML as e, safeURL, date, download, arrow, initTheme } from './shared.js';
import { t, time, errorMessage, initLanguage } from './i18n.js';
initLanguage();
initTheme();
const list = document.querySelector('#build-list');
const status = document.querySelector('#beta-status');
const filters = document.querySelector('#branch-filters');
const search = document.querySelector('#build-search');
const older = document.querySelector('#load-older');
const refresh = document.querySelector('#refresh-builds');
const range = document.querySelector('#build-range');
let runs = [], artifacts = [], builds = [], branch = 'all', busy = false, page = 1, moreRuns = false, moreArtifacts = false;
let lastSync = null, lastError = null;
const root = repoURL('AirPort-RTW');

function renderStatus() {
  status.classList.toggle('warning', Boolean(lastError || lastSync?.stale));
  status.textContent = lastError ? errorMessage(lastError) : lastSync?.stale ? t('Cached data. Live updates from GitHub are currently unavailable.') : lastSync ? t('Checked GitHub · {time}', { time: time(lastSync.time) }) : t('Checking test builds on GitHub …');
}
function renderFilters() {
  const branches = [...new Set(builds.map(b => b.run.head_branch))].sort();
  filters.innerHTML = `<button class="${branch === 'all' ? 'active' : ''}" data-branch="all" aria-pressed="${branch === 'all'}">${t('All branches')}</button>` + branches.map(b => `<button class="${branch === b ? 'active' : ''}" data-branch="${e(b)}" aria-pressed="${branch === b}">${e(b)}</button>`).join('');
}
function render() {
  const query = search.value.toLowerCase().trim();
  const visible = builds.filter(b => (branch === 'all' || b.run.head_branch === branch) && `${b.run.display_title} ${b.run.head_sha} ${b.run.head_branch} ${b.artifacts.map(a => a.name).join(' ')}`.toLowerCase().includes(query));
  list.setAttribute('aria-busy', 'false');
  if (lastError && !builds.length) {
    list.innerHTML = `<div class="release-placeholder"><span class="empty-symbol">↗</span><h3>${t('Could not load the builds.')}</h3><p>${e(errorMessage(lastError))}</p><a class="button secondary" href="${root}/actions/workflows/native-build.yml" target="_blank" rel="noopener noreferrer">${t('Open GitHub Actions')} ${arrow}</a></div>`;
  } else if (!visible.length) {
    list.innerHTML = `<div class="release-placeholder"><span class="empty-symbol">⌁</span><h3>${t(builds.length ? 'No matching builds.' : 'No matching artifacts available yet.')}</h3><p>${t(builds.length ? 'Try a different search or development branch.' : 'Successful beta builds will appear here when they produce an AirPortRTW artifact.')}</p><a class="button secondary" href="${root}/actions/workflows/native-build.yml" target="_blank" rel="noopener noreferrer">${t('View workflow on GitHub')} ${arrow}</a></div>`;
  } else list.innerHTML = visible.map(({ run, artifacts: files }) => files.map(a => {
    const expired = isExpired(a);
    return `<article class="build-card"><div class="build-header"><div><span class="release-badge">${e(run.head_branch)}</span><h2>${e(a.name)}</h2><div class="build-meta"><span>${e(date(a.created_at))}</span><span>·</span><span>${formatBytes(a.size_in_bytes)}</span><span>·</span><a href="${root}/commit/${e(run.head_sha)}" target="_blank" rel="noopener noreferrer">${e(run.head_sha?.slice(0, 7))} ↗</a></div></div>${expired ? `<span class="expired-label">${t('Artifact expired')}</span>` : `<a class="button primary" href="${artifactURL(run.id, a.id)}" target="_blank" rel="noopener noreferrer">${download} ${t('Download artifact')}</a>`}</div><p class="build-commit"><strong>${t('Change:')}</strong> ${e(run.display_title || run.head_commit?.message?.split('\n')[0] || t('Build without a description'))}</p><div class="build-footer"><div>${t(expired ? 'Expired on' : 'Available until')} ${e(date(a.expires_at))} · ${t('GitHub sign-in required')}</div><a class="text-link" href="${e(safeURL(run.html_url))}" target="_blank" rel="noopener noreferrer">${t('View build & changes')} ${arrow}</a></div></article>`;
  }).join('')).join('');
  older.hidden = !(moreRuns || moreArtifacts);
  range.textContent = t('{visible} of {total} builds · Newest first', { visible: visible.length, total: builds.length });
}
function mergeById(previous, next) {
  return [...new Map([...previous, ...next].map(item => [item.id, item])).values()];
}
async function load(force = false, append = false) {
  if (busy) return;
  busy = true; refresh.disabled = true; older.disabled = true;
  const nextPage = append ? page + 1 : 1;
  const queries = [
    append && !moreRuns ? Promise.resolve(null) : github(`/AirPort-RTW/actions/workflows/native-build.yml/runs?per_page=20&page=${nextPage}`, { force }),
    append && !moreArtifacts ? Promise.resolve(null) : github(`/AirPort-RTW/actions/artifacts?per_page=20&page=${nextPage}`, { force }),
  ];
  try {
    const [runResult, artifactResult] = await Promise.all(queries);
    runs = append ? mergeById(runs, runResult?.data.workflow_runs || []) : runResult.data.workflow_runs;
    artifacts = append ? mergeById(artifacts, artifactResult?.data.artifacts || []) : artifactResult.data.artifacts;
    if (runResult) moreRuns = runResult.data.workflow_runs.length === 20;
    if (artifactResult) moreArtifacts = artifactResult.data.artifacts.length === 20;
    page = nextPage;
    builds = betaBuilds(runs, artifacts);
    if (branch !== 'all' && !builds.some(b => b.run.head_branch === branch)) branch = 'all';
    lastSync = { stale: runResult?.stale || artifactResult?.stale, time: runResult?.time || artifactResult?.time };
    lastError = null;
    renderStatus(); renderFilters(); render();
  } catch (error) {
    lastError = error;
    renderStatus(); render();
  } finally { busy = false; refresh.disabled = false; older.disabled = false; }
}
filters.addEventListener('click', event => {
  const button = event.target.closest('[data-branch]');
  if (!button) return;
  branch = button.dataset.branch; renderFilters(); render();
});
search.addEventListener('input', render);
refresh.addEventListener('click', () => load(true));
older.addEventListener('click', () => load(false, true));
document.addEventListener('languagechange', () => {
  renderStatus(); renderFilters();
  if (lastSync || lastError) render();
});
load();
setInterval(() => { if (!document.hidden) load(); }, 10 * 60 * 1000);
setInterval(() => { if (builds.length && !document.hidden) render(); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
