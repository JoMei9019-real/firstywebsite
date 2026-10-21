import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPage } from './helpers/render.mjs';

const release = (project, id, version) => ({
  id, tag_name: version, draft: false, prerelease: false, published_at: '2026-10-21T12:00:00Z',
  html_url: `https://github.com/JoMei9019-real/${project}/releases/tag/${version}`,
  body: '## Changes\n- Wi-Fi stability improvements.',
  assets: [{ name: `${project}.zip`, size: 690000, state: 'uploaded', browser_download_url: `https://github.com/JoMei9019-real/${project}/releases/download/${version}/${project}.zip` }],
});

test('deployed home renders both English download buttons and dates, including after DE → EN', async context => {
  const page = await renderPage(context, 'index.html', url => {
    const project = url.includes('/Feixiao/') ? 'Feixiao' : 'AirPort-RTW';
    const current = release(project, project === 'Feixiao' ? 3 : 2, 'v1.1.0');
    return url.endsWith('/latest') ? current : [current, release(project, 1, 'v1.0.0')];
  });
  const airport = () => page.element('[data-download="airport"]').innerHTML;
  const feixiao = () => page.element('[data-download="feixiao"]').innerHTML;
  const details = () => page.element('#release-detail').innerHTML;
  for (const [name, html] of [['AirPort-RTW', airport()], ['Feixiao', feixiao()]]) {
    assert.ok(html.includes(`Download ${name}`));
    assert.ok(html.includes('21 October 2026'));
    assert.ok(!html.includes('herunterladen') && !html.includes('Oktober'));
  }
  page.element('#version-select').value = '1';
  page.element('#version-select').trigger('change');
  const requests = page.requests();
  page.language.setLanguage('de');
  assert.match(airport(), /AirPort-RTW herunterladen/);
  assert.match(feixiao(), /Feixiao herunterladen/);
  assert.match(details(), /Veröffentlicht am 21. Oktober 2026/);
  page.language.setLanguage('en');
  assert.equal(page.element('#version-select').value, '1');
  assert.match(details(), /Published on 21 October 2026/);
  assert.match(airport(), /Download AirPort-RTW/);
  assert.match(feixiao(), /Download Feixiao/);
  assert.ok(![airport(), feixiao(), details()].join('').match(/herunterladen|Oktober|Veröffentlicht/));
  assert.equal(page.requests(), requests);
});
