import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPage } from './helpers/render.mjs';

test('deployed beta download, creation and expiry dates consistently follow English', async context => {
  const run = { id: 42, head_branch: '1.0.0-beta', status: 'completed', conclusion: 'success', event: 'push', created_at: '2026-10-21T12:00:00Z', head_sha: 'abcdef123456', display_title: 'Improve RX stability', html_url: 'https://github.com/JoMei9019-real/AirPort-RTW/actions/runs/42' };
  const artifact = { id: 99, workflow_run: { id: 42 }, name: 'AirPortRTW-1.1.0-beta.3', size_in_bytes: 640000, expired: false, created_at: '2026-10-21T12:01:00Z', expires_at: '2099-10-22T12:00:00Z' };
  const page = await renderPage(context, 'beta/index.html', url => url.includes('/actions/artifacts?') ? { artifacts: [artifact] } : { workflow_runs: [run] });
  const builds = () => page.element('#build-list').innerHTML;
  assert.match(builds(), /Download artifact/);
  assert.match(builds(), /21 October 2026/);
  assert.match(builds(), /Available until 22 October 2099/);
  page.element('#build-search').value = 'beta.3';
  page.element('#build-search').trigger('input');
  const requests = page.requests();
  page.language.setLanguage('de');
  assert.match(builds(), /Artifact herunterladen/);
  assert.match(builds(), /Verfügbar bis 22. Oktober 2099/);
  page.language.setLanguage('en');
  assert.equal(page.element('#build-search').value, 'beta.3');
  assert.match(builds(), /Download artifact/);
  assert.match(builds(), /Available until 22 October 2099/);
  assert.ok(!builds().match(/herunterladen|Oktober|Verfügbar|Anmeldung/));
  assert.equal(page.requests(), requests);
});
