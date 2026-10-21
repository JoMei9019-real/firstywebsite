import { github, repoURL, betaBuilds, isExpired, artifactURL, formatBytes } from './github.js';
import { escapeHTML as e, safeURL, date, download, arrow, initTheme } from './shared.js';
initTheme();
const list = document.querySelector('#build-list');
const status = document.querySelector('#beta-status');
const filters = document.querySelector('#branch-filters');
const search = document.querySelector('#build-search');
const older = document.querySelector('#load-older');
const refresh = document.querySelector('#refresh-builds');
const range = document.querySelector('#build-range');
let runs = [], artifacts = [], builds = [], branch = 'all', busy = false, page = 1, moreRuns = false, moreArtifacts = false;
const root = repoURL('AirPort-RTW');

function renderFilters() {
  const branches = [...new Set(builds.map(b => b.run.head_branch))].sort();
  filters.innerHTML = `<button class="${branch === 'all' ? 'active' : ''}" data-branch="all" aria-pressed="${branch === 'all'}">Alle Zweige</button>` + branches.map(b => `<button class="${branch === b ? 'active' : ''}" data-branch="${e(b)}" aria-pressed="${branch === b}">${e(b)}</button>`).join('');
}
function render() {
  const query = search.value.toLowerCase().trim();
  const visible = builds.filter(b => (branch === 'all' || b.run.head_branch === branch) && `${b.run.display_title} ${b.run.head_sha} ${b.run.head_branch} ${b.artifacts.map(a => a.name).join(' ')}`.toLowerCase().includes(query));
  list.setAttribute('aria-busy', 'false');
  if (!visible.length) {
    list.innerHTML = `<div class="release-placeholder"><span class="empty-symbol">⌁</span><h3>${builds.length ? 'Keine passenden Builds.' : 'Noch keine passenden Artifacts verfügbar.'}</h3><p>${builds.length ? 'Probiere eine andere Suche oder einen anderen Entwicklungszweig.' : 'Sobald ein erfolgreicher Beta-Build ein AirPortRTW-Artifact erzeugt, findest du es hier.'}</p><a class="button secondary" href="${root}/actions/workflows/native-build.yml" target="_blank" rel="noopener noreferrer">Workflow auf GitHub ${arrow}</a></div>`;
  } else list.innerHTML = visible.map(({ run, artifacts: files }) => files.map(a => {
    const expired = isExpired(a);
    return `<article class="build-card"><div class="build-header"><div><span class="release-badge">${e(run.head_branch)}</span><h2>${e(a.name)}</h2><div class="build-meta"><span>${e(date(a.created_at))}</span><span>·</span><span>${formatBytes(a.size_in_bytes)}</span><span>·</span><a href="${root}/commit/${e(run.head_sha)}" target="_blank" rel="noopener noreferrer">${e(run.head_sha?.slice(0, 7))} ↗</a></div></div>${expired ? '<span class="expired-label">Artifact abgelaufen</span>' : `<a class="button primary" href="${artifactURL(run.id, a.id)}" target="_blank" rel="noopener noreferrer">${download} Artifact herunterladen</a>`}</div><p class="build-commit"><strong>Änderung:</strong> ${e(run.display_title || run.head_commit?.message?.split('\n')[0] || 'Build ohne Beschreibung')}</p><div class="build-footer"><div>${expired ? 'Abgelaufen am' : 'Verfügbar bis'} ${e(date(a.expires_at))} · GitHub-Anmeldung erforderlich</div><a class="text-link" href="${e(safeURL(run.html_url))}" target="_blank" rel="noopener noreferrer">Build & Änderungen ansehen ${arrow}</a></div></article>`;
  }).join('')).join('');
  older.hidden = !(moreRuns || moreArtifacts);
  range.textContent = `${visible.length} von ${builds.length} Builds · Neueste zuerst`;
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
    const stale = runResult?.stale || artifactResult?.stale;
    status.classList.toggle('warning', Boolean(stale));
    status.textContent = stale ? 'Gespeicherter Stand. Der Live-Abgleich mit GitHub ist gerade nicht möglich.' : `Mit GitHub abgeglichen · ${new Date(runResult?.time || artifactResult?.time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
    renderFilters(); render();
  } catch (error) {
    status.textContent = error.message; status.classList.add('warning');
    list.setAttribute('aria-busy', 'false');
    if (!builds.length) list.innerHTML = `<div class="release-placeholder"><span class="empty-symbol">↗</span><h3>Die Builds konnten nicht geladen werden.</h3><p>${e(error.message)}</p><a class="button secondary" href="${root}/actions/workflows/native-build.yml" target="_blank" rel="noopener noreferrer">GitHub Actions öffnen ${arrow}</a></div>`;
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
load();
setInterval(() => { if (!document.hidden) load(); }, 10 * 60 * 1000);
setInterval(() => { if (builds.length && !document.hidden) render(); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
