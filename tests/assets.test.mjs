import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
test('published pages share one immutable asset version matching current sources', async () => {
  const names = (await readdir(new URL('assets/', root), { withFileTypes: true }))
    .filter(file => file.isFile() && /\.(js|css|svg|png|ico)$/.test(file.name)).map(file => file.name).sort();
  const versions = new Set();
  for (const page of ['index.html', 'beta/index.html', 'airport-rtw/index.html', 'feixiao/index.html']) {
    const url = new URL(page, root);
    const html = await readFile(url, 'utf8');
    const references = [...html.matchAll(/(?:src|href)="([^"#]*assets\/[^"#]+)"/g)];
    assert.ok(references.length >= 4);
    for (const [, reference] of references) {
      const version = reference.match(/\/releases\/([a-f0-9]{16})\//)?.[1];
      assert.ok(version, `${page}: unversioned ${reference}`);
      versions.add(version);
      await readFile(new URL(reference, url));
    }
  }
  assert.equal(versions.size, 1, 'All page assets must use the same published version');
  const [version] = versions;
  for (const name of names) {
    assert.deepEqual(await readFile(new URL(`assets/releases/${version}/${name}`, root)), await readFile(new URL(`assets/${name}`, root)), `Published ${name} differs from its source; run npm run prepare:assets`);
  }
});
