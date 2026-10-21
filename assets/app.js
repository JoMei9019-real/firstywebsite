import { PROJECTS, github, repoURL, stableReleases, releaseAssets, primaryAsset, formatBytes } from './github.js';
import { escapeHTML as e, safeURL, date, markdown, download, arrow, initTheme } from './shared.js';

initTheme();
const states = {};
let selected = 'airport';
let loading = false;
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
    badge.textContent = state?.error ? 'GitHub prüfen' : 'Noch kein Release';
    target.innerHTML = `<a class="button secondary full" href="${repo}/releases" target="_blank" rel="noopener noreferrer">Releases auf GitHub ${arrow}</a><p class="download-meta">${e(state?.error || 'Sobald ein Release erscheint, findest du es hier.')}</p>`;
    return;
  }
  const release = state.latest;
  const asset = primaryAsset(release);
  badge.innerHTML = `<span class="status-dot"></span>${e(release.tag_name)}`;
  target.innerHTML = asset
    ? `<a class="button ${key === 'airport' ? 'primary' : 'blue-button'} full" href="${e(safeURL(asset.browser_download_url))}">${download} ${e(PROJECTS[key].name)} herunterladen <span class="button-end">↓</span></a><p class="download-meta">${e(release.tag_name)} <span>·</span> ${formatBytes(asset.size)} <span>·</span> ${e(date(release.published_at))}</p>`
    : `<a class="button secondary full" href="${e(safeURL(release.html_url))}" target="_blank" rel="noopener noreferrer">Release öffnen ${arrow}</a><p class="download-meta">${e(release.tag_name)} · Für dieses Release ist keine fertige Download-Datei hinterlegt.</p>`;
  if (state.stale) target.insertAdjacentHTML('beforeend', `<p class="cache-warning">Zwischengespeicherter Stand vom ${e(date(state.time))}. Aktuell auf GitHub prüfen.</p>`);
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
    detail.innerHTML = `<div class="release-placeholder"><span class="empty-symbol">↗</span><h3>${state?.error ? 'GitHub ist gerade nicht erreichbar.' : 'Noch keine veröffentlichten Releases.'}</h3><p>${e(state?.error || 'Hier erscheinen die Release Notes, sobald sie veröffentlicht werden.')}</p><a class="button secondary" href="${repoURL(PROJECTS[selected].repo)}/releases" target="_blank" rel="noopener noreferrer">Auf GitHub ansehen ${arrow}</a></div>`;
    return;
  }
  const files = releaseAssets(release);
  const base = `${repoURL(PROJECTS[selected].repo)}/blob/${encodeURIComponent(release.tag_name)}/`;
  detail.innerHTML = `<div class="release-detail-heading"><div><p class="eyebrow">${e(PROJECTS[selected].name)} <span class="stable-label">STABLE</span></p><h3>${e(release.tag_name)}</h3><p class="muted">Veröffentlicht am ${e(date(release.published_at))}</p></div><a class="icon-button" href="${e(safeURL(release.html_url))}" target="_blank" rel="noopener noreferrer" aria-label="Release auf GitHub öffnen">${arrow}</a></div><div class="release-markdown">${markdown(release.body, base)}</div><div class="release-files"><h4>Downloads <span>${files.length}</span></h4>${files.length ? files.map(a => `<a class="file-link" href="${e(safeURL(a.browser_download_url))}">${download}<span>${e(a.name)}</span><small>${formatBytes(a.size)}</small></a>`).join('') : '<p class="muted">Keine fertigen Dateien für diese Version. Quellcode und Details findest du auf GitHub.</p>'}</div>`;
}
function renderExplorer(keepSelection = false) {
  const old = selector.value;
  const state = states[selected];
  const releases = state?.releases || [];
  selector.innerHTML = releases.length ? releases.map(r => `<option value="${e(r.id)}">${e(r.tag_name)}${r.id === state.latest?.id ? ' — Aktuell' : ''}</option>`).join('') : '<option>Keine Version verfügbar</option>';
  selector.disabled = !releases.length;
  if (keepSelection && releases.some(r => String(r.id) === old)) selector.value = old;
  else if (state?.latest) selector.value = String(state.latest.id);
  more.hidden = !state?.hasMore;
  const sync = document.querySelector('#sync-status');
  sync.classList.toggle('warning', Boolean(state?.stale || state?.error));
  sync.textContent = state?.error || (state?.stale ? `Gespeicherter Stand · ${state.warning || 'Live-Abgleich fehlgeschlagen.'}` : state ? `Mit GitHub abgeglichen · ${new Date(state.time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : 'Verbindung mit GitHub wird hergestellt.');
  renderDetail();
}
function chooseProject(key) {
  selected = key;
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
    warning: valid.find(r => r.warning)?.warning || (latest.status === 'rejected' ? latest.reason.message : ''),
    error: !current && history.status === 'rejected' ? history.reason.message : '',
  };
  renderCard(key);
  if (key === selected) renderExplorer(true);
}
async function load(force = false) {
  if (loading) return;
  loading = true; refresh.disabled = true;
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
    if (key === selected) renderExplorer(true);
  } catch (error) { document.querySelector('#sync-status').textContent = error.message; }
  finally { more.disabled = false; }
});
load();
setInterval(() => { if (!document.hidden) load(); }, 10 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
