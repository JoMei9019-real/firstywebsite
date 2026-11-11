import { PROJECTS, github, repoURL, stableReleases, releaseAssets, primaryAsset, formatBytes } from './github.js';
import { escapeHTML as e, safeURL, date, markdown, download, arrow, initTheme } from './shared.js';
import { t, time, errorMessage, initLanguage } from './i18n.js';

initLanguage();
initTheme();
const states = {};
let selected = 'airport';
let loading = false;
let historyError = null;
const selector = document.querySelector('#version-select');
const detail = document.querySelector('#release-detail');
const more = document.querySelector('#history-more');
const refresh = document.querySelector('#refresh-releases');

function renderCard(key) {
  const state = states[key];
  const badge = document.querySelector(`[data-version="${key}"]`);
  const target = document.querySelector(`[data-download="${key}"]`);
  const repo = repoURL(PROJECTS[key].repo);
  if (!state?.latest) {
    badge.textContent = t(state?.error ? 'Check GitHub' : 'No release yet');
    target.innerHTML = `<a class="button secondary full" href="${repo}/releases" target="_blank" rel="noopener noreferrer">${t('Releases on GitHub')} ${arrow}</a><p class="download-meta">${e(state?.error ? errorMessage(state.error) : t('Published releases will appear here.'))}</p>`;
    return;
  }
  const release = state.latest;
  const asset = primaryAsset(release);
  badge.innerHTML = `<span class="status-dot"></span>${e(release.tag_name)}`;
  target.innerHTML = asset
    ? `<a class="button ${key === 'airport' ? 'primary' : 'blue-button'} full" href="${e(safeURL(asset.browser_download_url))}">${download} ${e(t('Download {project}', { project: PROJECTS[key].name }))} <span class="button-end">↓</span></a><p class="download-meta">${e(release.tag_name)} <span>·</span> ${formatBytes(asset.size)} <span>·</span> ${e(date(release.published_at))}</p>`
    : `<a class="button secondary full" href="${e(safeURL(release.html_url))}" target="_blank" rel="noopener noreferrer">${t('View release')} ${arrow}</a><p class="download-meta">${e(release.tag_name)} · ${t('No ready-to-download file is attached to this release.')}</p>`;
  if (state.stale) target.insertAdjacentHTML('beforeend', `<p class="cache-warning">${e(t('Cached data from {date}. Check GitHub for the latest version.', { date: date(state.time) }))}</p>`);
}
function selectedRelease() {
  const state = states[selected];
  return state?.releases?.find(r => String(r.id) === selector.value) || state?.latest || state?.releases?.[0];
}
function renderDetail() {
  const state = states[selected];
  const release = selectedRelease();
  detail.setAttribute('aria-busy', String(!state));
  if (!release) {
    detail.innerHTML = `<div class="release-placeholder"><span class="empty-symbol">↗</span><h3>${t(state?.error ? 'GitHub is currently unavailable.' : 'No published releases yet.')}</h3><p>${e(state?.error ? errorMessage(state.error) : t('Release notes will appear here once published.'))}</p><a class="button secondary" href="${repoURL(PROJECTS[selected].repo)}/releases" target="_blank" rel="noopener noreferrer">${t('View on GitHub')} ${arrow}</a></div>`;
    return;
  }
  const files = releaseAssets(release);
  const outdated = Boolean(state.latest && release.id !== state.latest.id);
  const notice = outdated ? `<aside class="outdated-notice"><strong>${t('Outdated')}</strong><p>${t('A newer release is available. This download is kept for reference.')}</p><a href="${e(safeURL(state.latest.html_url))}" target="_blank" rel="noopener noreferrer">${e(t('Get latest release ({version}) ↗', { version: state.latest.tag_name }))}</a></aside>` : '';
  const base = `${repoURL(PROJECTS[selected].repo)}/blob/${encodeURIComponent(release.tag_name)}/`;
  detail.innerHTML = `<div class="release-detail-heading"><div><p class="eyebrow">${e(PROJECTS[selected].name)} <span class="stable-label">STABLE</span></p><h3>${e(release.tag_name)} <span class="${outdated ? 'outdated-label' : 'latest-build-label'}">${t(outdated ? 'Outdated' : 'Latest')}</span></h3><p class="muted">${e(t('Published on {date}', { date: date(release.published_at) }))}</p></div><a class="icon-button" href="${e(safeURL(release.html_url))}" target="_blank" rel="noopener noreferrer" aria-label="${t('Open release on GitHub')}">${arrow}</a></div>${notice}<p class="release-original-note">${t('Release notes are shown as published on GitHub.')}</p><div class="release-markdown">${markdown(release.body, base)}</div><div class="release-files"><h4>${t('Downloads')} <span>${files.length}</span></h4>${files.length ? files.map(a => `<a class="file-link" href="${e(safeURL(a.browser_download_url))}">${download}<span>${e(a.name)}</span><small>${formatBytes(a.size)}</small></a>`).join('') : `<p class="muted">${t('No files for this version. Find the source code and details on GitHub.')}</p>`}</div>`;
}
function renderExplorer(keepSelection = false) {
  const old = selector.value;
  const state = states[selected];
  const releases = state?.releases || [];
  selector.innerHTML = releases.length ? releases.map(r => `<option value="${e(r.id)}">${e(r.tag_name)}${r.id === state.latest?.id ? t(' — Latest') : t(' — Outdated')}</option>`).join('') : `<option>${t('No version available')}</option>`;
  selector.disabled = !releases.length;
  if (keepSelection && releases.some(r => String(r.id) === old)) selector.value = old;
  else if (state?.latest) selector.value = String(state.latest.id);
  more.hidden = !state?.hasMore;
  const sync = document.querySelector('#sync-status');
  sync.classList.toggle('warning', Boolean(state?.stale || state?.error || historyError));
  sync.textContent = historyError ? errorMessage(historyError) : state?.error ? errorMessage(state.error) : state?.stale ? t('Cached data · {message}', { message: state.warning ? errorMessage(state.warning) : t('Live update failed.') }) : state ? t('Checked GitHub · {time}', { time: time(state.time) }) : t('Connecting to GitHub.');
  renderDetail();
}
function chooseProject(key) {
  selected = key;
  historyError = null;
  document.querySelectorAll('[data-project-tab]').forEach(button => {
    const active = button.dataset.projectTab === key;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  renderExplorer();
}
async function loadProject(key, force) {
  const repo = PROJECTS[key].repo;
  const [history, latest] = await Promise.allSettled([
    github(`/${repo}/releases?per_page=100&page=1`, { force }),
    github(`/${repo}/releases/latest`, { force }),
  ]);
  const list = history.status === 'fulfilled' ? stableReleases(history.value.data) : [];
  const current = latest.status === 'fulfilled' && !latest.value.data.draft && !latest.value.data.prerelease ? latest.value.data : list[0];
  if (current) {
    const index = list.findIndex(r => r.id === current.id);
    if (index !== -1) list.splice(index, 1);
    list.unshift(current);
  }
  const valid = [latest, history].filter(r => r.status === 'fulfilled').map(r => r.value);
  states[key] = {
    latest: current, releases: list, page: 1,
    hasMore: history.status === 'fulfilled' && history.value.data.length === 100,
    time: valid[0]?.time || Date.now(),
    stale: valid.some(r => r.stale) || latest.status === 'rejected' && latest.reason.status !== 404 || history.status === 'rejected',
    warning: valid.find(r => r.warning)?.warning || (latest.status === 'rejected' ? latest.reason : null),
    error: !current && history.status === 'rejected' ? history.reason : null,
  };
  renderCard(key);
  if (key === selected) renderExplorer(true);
}
async function load(force = false) {
  if (loading) return;
  loading = true; refresh.disabled = true; historyError = null;
  await Promise.allSettled(Object.keys(PROJECTS).map(key => loadProject(key, force)));
  loading = false; refresh.disabled = false;
}
selector.addEventListener('change', renderDetail);
document.querySelectorAll('[data-project-tab]').forEach(button => button.addEventListener('click', () => chooseProject(button.dataset.projectTab)));
document.querySelectorAll('[data-show-changelog]').forEach(button => button.addEventListener('click', () => {
  chooseProject(button.dataset.showChangelog);
  document.querySelector('#changelog').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  selector.focus({ preventScroll: true });
}));
refresh.addEventListener('click', () => load(true));
more.addEventListener('click', async () => {
  const key = selected; const state = states[key]; more.disabled = true;
  try {
    const result = await github(`/${PROJECTS[key].repo}/releases?per_page=100&page=${state.page + 1}`);
    const existing = new Set(state.releases.map(r => r.id));
    state.releases.push(...stableReleases(result.data).filter(r => !existing.has(r.id)));
    state.page++; state.hasMore = result.data.length === 100;
    historyError = null;
    if (key === selected) renderExplorer(true);
  } catch (error) { historyError = error; renderExplorer(true); }
  finally { more.disabled = false; }
});
document.addEventListener('languagechange', () => {
  Object.keys(states).forEach(renderCard);
  if (states[selected]) renderExplorer(true);
});
load();
setInterval(() => { if (!document.hidden) load(); }, 10 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
