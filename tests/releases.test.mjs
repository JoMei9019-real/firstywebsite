import test from 'node:test';
import assert from 'node:assert/strict';
import { stableReleases, primaryAsset, releaseAssets, betaBuilds, isExpired, artifactURL, formatBytes } from '../assets/github.js';
import { markdown, safeURL } from '../assets/shared.js';

test('release history excludes drafts and prereleases and orders publication dates', () => {
  const releases = [
    { id: 1, published_at: '2026-10-01', draft: false, prerelease: false },
    { id: 2, published_at: '2026-10-21', draft: false, prerelease: true },
    { id: 3, published_at: '2026-10-20', draft: true, prerelease: false },
    { id: 4, published_at: '2026-10-19', draft: false, prerelease: false },
  ];
  assert.deepEqual(stableReleases(releases).map(r => r.id), [4, 1]);
  assert.equal(releases[0].id, 1);
});

test('binary download comes from the selected release, skipping checksums, debug and source', () => {
  const asset = name => ({ name, state: 'uploaded', browser_download_url: `https://github.com/o/r/releases/download/v2/${name}` });
  const release = { assets: [asset('driver.zip.sha256'), asset('Source.zip'), asset('driver-debug.zip'), asset('driver-release.zip'), { name: 'pending.zip', state: 'new' }] };
  assert.equal(primaryAsset(release).name, 'driver-release.zip');
  assert.equal(releaseAssets(release).length, 4);
  assert.equal(primaryAsset({ assets: [asset('driver.zip.sha256')] }), null);
  assert.equal(primaryAsset({ assets: [] }), null);
});

test('beta list only joins artifacts to successful non-PR beta runs from the workflow', () => {
  const run = (id, head_branch, conclusion = 'success', event = 'push') => ({ id, head_branch, conclusion, event, status: 'completed', created_at: `2026-10-${10 + id}` });
  const runs = [run(1, '1.0.0-beta'), run(2, 'main'), run(3, 'beta-2.0.0', 'failure'), run(4, 'beta-2.0.0', 'success', 'pull_request'), run(5, 'beta-2.0.0')];
  const artifacts = [1, 2, 3, 4, 5].map(id => ({ id: id * 10, name: `AirPortRTW-test-${id}`, workflow_run: { id } }));
  artifacts.push({ id: 60, name: 'logs', workflow_run: { id: 5 } });
  const builds = betaBuilds(runs, artifacts);
  assert.deepEqual(builds.map(b => b.run.id), [5, 1]);
  assert.equal(builds[0].artifacts.length, 1);
  assert.equal(artifactURL(5, 50), 'https://github.com/JoMei9019-real/AirPort-RTW/actions/runs/5/artifacts/50');
});

test('expired artifacts are disabled using both GitHub flag and actual expiry time', () => {
  const now = Date.parse('2026-10-21T12:00:00Z');
  assert.equal(isExpired({ expired: false, expires_at: '2026-10-21T11:59:59Z' }, now), true);
  assert.equal(isExpired({ expired: true, expires_at: '2027-01-01' }, now), true);
  assert.equal(isExpired({ expired: false, expires_at: '2026-10-22' }, now), false);
});

test('untrusted release notes cannot inject HTML or script URLs', () => {
  const html = markdown('# Notes\n\n<script>alert(1)</script>\n\n[click](javascript:alert)\n\n<img src=x onerror=alert(1)>\n\n```html\n<script>bad()</script>\n```');
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img '));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('href="#"'));
  assert.equal(safeURL('data:text/html,bad'), '#');
  assert.equal(safeURL('javascript:alert(1)'), '#');
});

test('release Markdown keeps readable lists, links, strong text and code', () => {
  const html = markdown('## Fixed\n- **RX** ownership\n- `wake` handling\n\n[Details](RELEASE.md)\n\n```sh\nsudo rtw88ctl status\n```', 'https://github.com/JoMei9019-real/Feixiao/blob/v2/');
  assert.match(html, /<h4>Fixed<\/h4>/);
  assert.match(html, /<strong>RX<\/strong>/);
  assert.match(html, /<ul>/);
  assert.match(html, /blob\/v2\/RELEASE.md/);
  assert.match(html, /<pre><code>sudo rtw88ctl status<\/code><\/pre>/);
});

test('small checksums show their real size in bytes', () => {
  assert.equal(formatBytes(86), '86 B');
  assert.equal(formatBytes(2048), '2 KB');
});
