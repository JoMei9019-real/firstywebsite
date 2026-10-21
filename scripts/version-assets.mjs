import { createHash } from 'node:crypto';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Each publication uses one immutable module directory. Relative ES module imports
// stay within that directory, so cached files cannot mix application versions.
const root = resolve(import.meta.dirname, '..');
const assets = resolve(root, 'assets');
const files = (await readdir(assets, { withFileTypes: true }))
  .filter(file => file.isFile() && /\.(js|css|svg)$/.test(file.name))
  .map(file => file.name).sort();
const hash = createHash('sha256');
const sources = new Map();
for (const file of files) {
  const source = await readFile(resolve(assets, file));
  sources.set(file, source);
  hash.update(file).update('\0').update(source).update('\0');
}
const version = hash.digest('hex').slice(0, 16);
const directory = resolve(assets, 'releases', version);
await mkdir(directory, { recursive: true });
for (const [file, source] of sources) await writeFile(resolve(directory, file), source);
for (const page of ['index.html', 'beta/index.html']) {
  const path = resolve(root, page);
  const html = await readFile(path, 'utf8');
  const updated = html.replace(/((?:\.\.\/)?assets\/)(?:releases\/[a-f0-9]+\/)?([\w.-]+\.(?:js|css|svg))/g,
    (_, prefix, filename) => `${prefix}releases/${version}/${filename}`);
  await writeFile(path, updated);
}
// Retain earlier directories: an already-open or cached page may still use them.
console.log(`Public assets: ${version} (${files.length} files)`);
