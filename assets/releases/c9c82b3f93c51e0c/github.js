import { locale, errorMessage } from './i18n.js';
export const OWNER = 'JoMei9019-real';
export const PROJECTS = {
  airport: { repo: 'AirPort-RTW', name: 'AirPort-RTW', label: 'Native macOS Wi-Fi' },
  feixiao: { repo: 'Feixiao', name: 'Feixiao', label: 'Realtek, under your control' },
};
export const repoURL = repo => `https://github.com/${OWNER}/${repo}`;
function apiError(code, parameters = {}) {
  const error = Object.assign(new Error(), { code, ...parameters });
  error.message = errorMessage(error);
  return error;
}
const TTL = 10 * 60 * 1000;
const pending = new Map();
const memory = new Map();
let retryAfter = 0;

function readCache(key) {
  try { return JSON.parse(localStorage.getItem(key)) || memory.get(key); }
  catch { return memory.get(key); }
}
function writeCache(key, value) {
  memory.set(key, value);
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage is optional. */ }
}

export async function github(path, { force = false } = {}) {
  if (!/^\/[A-Za-z0-9_.\-/]+(?:\?[A-Za-z0-9_=&.%\-]+)?$/.test(path)) throw apiError('invalid-request');
  const key = `jomei-github-v1:${path}`;
  const cached = readCache(key);
  if (!force && cached && Date.now() - cached.time < TTL) return { ...cached, stale: false };
  if (pending.has(key)) return pending.get(key);
  const request = (async () => {
    try {
      if (Date.now() < retryAfter) throw apiError('rate-limit', { retryAt: retryAfter });
      const response = await fetch(`https://api.github.com/repos/${OWNER}${path}`, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(15000),
      });
      if (response.status === 403 || response.status === 429) {
        const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000;
        const delay = Number(response.headers.get('retry-after')) * 1000;
        retryAfter = Math.max(Date.now() + (delay || 60000), reset || 0);
        throw apiError('rate-limit', { retryAt: retryAfter });
      }
      if (!response.ok) {
        const error = apiError(response.status === 404 ? 'not-found' : 'http', { status: response.status });
        throw error;
      }
      const result = { data: await response.json(), time: Date.now(), stale: false };
      writeCache(key, result);
      return result;
    } catch (error) {
      const failure = error.code ? error : apiError('network');
      if (cached && error.status !== 404) return { ...cached, stale: true, warning: { code: failure.code, status: failure.status, retryAt: failure.retryAt } };
      throw failure;
    } finally { pending.delete(key); }
  })();
  pending.set(key, request);
  return request;
}

export function stableReleases(releases) {
  return releases.filter(r => !r.draft && !r.prerelease)
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
}
export function releaseAssets(release) {
  return (release.assets || []).filter(a => a.state === 'uploaded' && a.browser_download_url);
}
export function primaryAsset(release) {
  const files = releaseAssets(release).filter(a => /\.(zip|dmg|pkg|tar\.gz|7z)$/i.test(a.name) && !/source|debug|symbols/i.test(a.name));
  return files.find(a => /release/i.test(a.name)) || files[0] || null;
}
export function isExpired(artifact, now = Date.now()) {
  return artifact.expired || Date.parse(artifact.expires_at) <= now;
}
export function betaBuilds(runs, artifacts) {
  const eligible = runs.filter(r => /beta/i.test(r.head_branch || '') && r.status === 'completed' && r.conclusion === 'success' && r.event !== 'pull_request');
  return eligible.map(run => ({
    run,
    artifacts: artifacts.filter(a => a.workflow_run?.id === run.id && /^AirPortRTW[-_.]/i.test(a.name)),
  })).filter(build => build.artifacts.length)
    .sort((a, b) => Date.parse(b.run.created_at) - Date.parse(a.run.created_at));
}
export function artifactURL(runId, artifactId) {
  return `${repoURL('AirPort-RTW')}/actions/runs/${Number(runId)}/artifacts/${Number(artifactId)}`;
}
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString(locale(), { maximumFractionDigits: 1 })} MB`;
}
