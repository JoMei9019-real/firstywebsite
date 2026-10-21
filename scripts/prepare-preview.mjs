import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'dist');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const path of ['index.html', 'assets', 'beta', 'robots.txt', 'site', 'discord', 'discord.html', '.nojekyll', 'CNAME', 'favicon.ico', 'apple-touch-icon.png']) {
  await cp(resolve(root, path), resolve(out, path), { recursive: true });
}
