import test from 'node:test';
import assert from 'node:assert/strict';
import { isReleasedBeta } from '../assets/github.js';

test('stable releases supersede matching and older beta series using numeric versions', () => {
  for (const [series, release] of [['1.1.0', 'v1.1.0'], ['1.0.2', 'v1.1.0'], ['1.2.0', 'v1.10.0']]) {
    assert.equal(isReleasedBeta(series, release), true);
  }
  for (const [series, release] of [['2.0.0', 'v1.1.0'], ['1.10.0', 'v1.2.0'], ['other', 'v1.1.0'], ['1.1.0', null], ['1.1.0', 'v1.2.0-beta.1']]) {
    assert.equal(isReleasedBeta(series, release), false);
  }
});
