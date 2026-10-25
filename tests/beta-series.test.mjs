import test from 'node:test';
import assert from 'node:assert/strict';
import { betaVersion, betaSeries } from '../assets/github.js';

test('actual artifact version separates series even when the development branch is reused', () => {
  const run = { id: 42, head_branch: '1.0.0-beta', created_at: '2026-10-24' };
  const groups = betaSeries([{ run, artifacts: [
    { id: 1, name: 'AirPortRTW-1.0.2-beta.4' },
    { id: 2, name: 'AirPortRTW-1.1.0-beta.7' },
    { id: 3, name: 'AirPortRTW-2.0.0-beta.17' },
    { id: 4, name: 'AirPortRTW-1.10.0-beta.1' },
    { id: 5, name: 'AirPortRTW-3.0.0-beta.1' },
    { id: 6, name: 'AirPortRTW-development' },
  ] }]);
  assert.deepEqual(groups.map(group => group.version), ['3.0.0', '2.0.0', '1.10.0', '1.1.0', '1.0.2', 'other']);
  assert.equal(groups.find(group => group.version === '1.1.0').builds[0].artifact.id, 2);
  assert.equal(groups.find(group => group.version === 'other').builds[0].artifact.id, 6);
});

test('version extraction supports separators and avoids partial or unrelated version matches', () => {
  for (const name of ['AirPortRTW-1.2.3-beta.4', 'AirPortRTW_v1.2.3_beta.4', 'AirPortRTW.1.2.3', 'AirPortRTW-1.2.3+test']) assert.equal(betaVersion(name), '1.2.3');
  for (const name of ['AirPortRTW-1.2.3bad', 'AirPortRTW-1.2', 'AirPortRTW-development-9.9.9', 'logs-1.2.3', null]) assert.equal(betaVersion(name), 'other');
});

test('each series orders builds by actual run date while retaining older and expired artifacts', () => {
  const groups = betaSeries([
    { run: { created_at: '2026-10-01' }, artifacts: [{ id: 1, name: 'AirPortRTW-1.1.0-beta.1', expired: true }] },
    { run: { created_at: '2026-10-24' }, artifacts: [{ id: 2, name: 'AirPortRTW-1.1.0-beta.7' }] },
  ]);
  assert.deepEqual(groups[0].builds.map(build => build.artifact.id), [2, 1]);
  assert.deepEqual(betaSeries([]), []);
});
