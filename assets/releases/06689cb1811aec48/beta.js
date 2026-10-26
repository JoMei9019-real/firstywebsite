import { github, repoURL, betaBuilds, betaSeries, isExpired, artifactURL, formatBytes } from './github.js';
import { escapeHTML as e, safeURL, date, download, arrow, initTheme } from './shared.js';
import { t, time, errorMessage, initLanguage } from './i18n.js';
initLanguage();
initTheme();
const list = document.querySelector('#build-list');
const status = document.querySelector('#beta-status');
const filters = document.querySelector('#version-filters');
const heading = document.querySelector('#series-heading');
const summary = document.querySelector('#series-summary');
const search = document.querySelector('#build-search');
const older = document.querySelector('#load-older');
const refresh = document.querySelector('#refresh-builds');
const range = document.querySelector('#build-range');
let runs = [], artifacts = [], builds = [], series = [], version = null, busy = false, page = 1, moreRuns = false, moreArtifacts = false;
let lastSync = null, lastError = null;
const pageSize = 100;
const root = repoURL('AirPort-RTW');
const versionLabel = value => value === 'other' ? t('Other builds') : value;
const buildCount = count => t(count === 1 ? '{count} build' : '{count} builds', { count });

function renderStatus() {
  status.classList.toggle('warning', Boolean(lastError || lastSync?.stale));
  status.textContent = lastError ? errorMessage(lastError) : lastSync?.stale ? t('Cached data. Live updates from GitHub are currently unavailable.') : lastSync ? t('Checked GitHub · {time}', { time: time(lastSync.time) }) : t('Checking test builds on GitHub …');
}
function renderFilters() {
  filters.setAttribute('aria-busy', 'false');
  filters.innerHTML = series.length ? series.map(group => {
    const latest = group.builds[0];
    const label = versionLabel(group.version);
    const latestName = latest.artifact.name.replace(/^AirPortRTW[-_.]/i, '');
    return `<button class="version-card ${version === group.version ? 'active' : ''}" data-version="${e(group.version)}" aria-pressed="${version === group.version}" aria-controls="build-list" aria-label="${e(t('Explore {version}', { version: label }))}"><span class="version-card-top"><span>${t(group.version === 'other' ? 'UNVERSIONED' : 'BETA SERIES')}</span><span class="version-check" aria-hidden="true">${version === group.version ? '✓' : '↗'}</span></span><strong>${e(label)}</strong><span class="version-latest">${t('Latest build:')} <span>${e(latestName)}</span></span><span class="version-card-bottom"><span>${buildCount(group.builds.length)}</span><span>${e(date(latest.artifact.created_at))}</span></span></button>`;
  }).join('') : `<p class="muted">${t(lastError ? 'Could not load the builds.' : 'No matching artifacts available yet.')}</p>`;
}
function renderBuild({ run, artifact: a }, index) {
  const expired = isExpired(a);
  return `<article class="build-card"><div class="build-header"><div><div class="build-badges"><span class="release-badge">${e(versionLabel(version))}</span>${index === 0 ? `<span class="latest-build-label">${t('Latest in series')}</span>` : ''}<span class="build-branch">${t('Branch:')} ${e(run.head_branch)}</span></div><h3>${e(a.name)}</h3><div class="build-meta"><span>${e(date(a.created_at))}</span><span>·</span><span>${formatBytes(a.size_in_bytes)}</span><span>·</span><a href="${root}/commit/${e(run.head_sha)}" target="_blank" rel="noopener noreferrer">${e(run.head_sha?.slice(0, 7))} ↗</a></div></div>${expired ? `<span class="expired-label">${t('Artifact expired')}</span>` : `<a class="button primary" href="${artifactURL(run.id, a.id)}" target="_blank" rel="noopener noreferrer">${download} ${t('Download artifact')}</a>`}</div><p class="build-commit"><strong>${t('Change:')}</strong> ${e(run.display_title || run.head_commit?.message?.split('\n')[0] || t('Build without a description'))}</p><div class="build-footer"><div>${t(expired ? 'Expired on' : 'Available until')} ${e(date(a.expires_at))} · ${t('GitHub sign-in required')}</div><a class="text-link" href="${e(safeURL(run.html_url))}" target="_blank" rel="noopener noreferrer">${t('View build & changes')} ${arrow}</a></div></article>`;
}
function render() {
  const query = search.value.toLowerCase().trim();
  const selected = series.find(group => group.version === version);
  const entries = selected?.builds || [];
  const visible = entries.filter(({ run, artifact }) => `${run.display_title} ${run.head_sha} ${run.head_branch} ${artifact.name}`.toLowerCase().includes(query));
  heading.textContent = selected ? t('{version} beta builds', { version: versionLabel(version) }) : t('Beta builds');
  summary.textContent = selected ? t('{count} · Newest first', { count: buildCount(entries.length) }) : '';
  list.setAttribute('aria-busy', 'false');
  if (lastError && !builds.length) {
    list.innerHTML = `<div class="release-placeholder"><span class="empty-symbol">↗</span><h3>${t('Could not load the builds.')}</h3><p>${e(errorMessage(lastError))}</p><a class="button secondary" href="${root}/actions/workflows/native-build.yml" target="_blank" rel="noopener noreferrer">${t('Open GitHub Actions')} ${arrow}</a></div>`;
  } else if (!visible.length) {
    list.innerHTML = `<div class="release-placeholder"><span class="empty-symbol">⌁</span><h3>${t(builds.length ? 'No matching builds.' : 'No matching artifacts available yet.')}</h3><p>${t(builds.length ? 'Try a different search or version series.' : 'Successful beta builds will appear here when they produce an AirPortRTW artifact.')}</p><a class="button secondary" href="${root}/actions/workflows/native-build.yml" target="_blank" rel="noopener noreferrer">${t('View workflow on GitHub')} ${arrow}</a></div>`;
  } else list.innerHTML = visible.map(entry => renderBuild(entry, entries.indexOf(entry))).join('');
  older.hidden = !(moreRuns || moreArtifacts);
  range.textContent = t('{visible} of {total} builds · Newest first', { visible: visible.length, total: entries.length });
}
function mergeById(previous, next) {
  return [...new Map([...previous, ...next].map(item => [item.id, item])).values()];
}
async function load(force = false, append = false) {
  if (busy) return;
  busy = true; refresh.disabled = true; older.disabled = true;
  const nextPage = append ? page + 1 : 1;
  const queries = [
    append && !moreRuns ? Promise.resolve(null) : github(`/AirPort-RTW/actions/workflows/native-build.yml/runs?per_page=${pageSize}&page=${nextPage}`, { force }),
    append && !moreArtifacts ? Promise.resolve(null) : github(`/AirPort-RTW/actions/artifacts?per_page=${pageSize}&page=${nextPage}`, { force }),
  ];
  try {
    const [runResult, artifactResult] = await Promise.all(queries);
    runs = append ? mergeById(runs, runResult?.data.workflow_runs || []) : runResult.data.workflow_runs;
    artifacts = append ? mergeById(artifacts, artifactResult?.data.artifacts || []) : artifactResult.data.artifacts;
    if (runResult) moreRuns = runResult.data.workflow_runs.length === pageSize;
    if (artifactResult) moreArtifacts = artifactResult.data.artifacts.length === pageSize;
    page = nextPage;
    builds = betaBuilds(runs, artifacts);
    series = betaSeries(builds);
    // Keep a deliberate selection on refresh; initially show the most recently
    // updated series, which may differ from the highest semantic version.
    if (!series.some(group => group.version === version)) {
      version = [...series].sort((a, b) => Date.parse(b.builds[0].run.created_at) - Date.parse(a.builds[0].run.created_at))[0]?.version || null;
    }
    lastSync = { stale: runResult?.stale || artifactResult?.stale, time: runResult?.time || artifactResult?.time };
    lastError = null;
    renderStatus(); renderFilters(); render();
  } catch (error) {
    lastError = error;
    renderStatus(); renderFilters(); render();
  } finally { busy = false; refresh.disabled = false; older.disabled = false; }
}
filters.addEventListener('click', event => {
  const button = event.target.closest('[data-version]');
  if (!button || button.dataset.version === version) return;
  version = button.dataset.version;
  search.value = '';
  renderFilters(); render();
  filters.querySelector(`[data-version="${version}"]`)?.focus();
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
