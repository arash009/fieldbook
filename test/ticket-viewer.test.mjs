import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retryable } from '../app/js/ticket-viewer.js';

test('a failed load is tried again next time, and a good one is kept', async () => {
  let calls = 0;
  const load = retryable(async () => { calls++; if (calls === 1) throw new Error('offline'); return 'lib'; });
  await assert.rejects(load(), /offline/);
  assert.equal(await load(), 'lib');
  assert.equal(await load(), 'lib');
  assert.equal(calls, 2);
});
