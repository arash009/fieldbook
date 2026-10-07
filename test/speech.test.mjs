import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speechChunks } from '../app/js/speech.js';

test('speechChunks reads the guide in order, in short chunks', () => {
  const long = 'This is a sentence that goes on. '.repeat(20);
  const chunks = speechChunks({ title: 'Tower', why: long, lookFor: ['A rhino.'], facts: ['Built in 1519.'], kids: [{ q: 'Where is the rhino?', a: 'Under a turret.' }] });
  assert.equal(chunks[0], 'Tower.');
  assert.ok(chunks.every((c) => c.length <= 220), 'all chunks short');
  const joined = chunks.join(' ');
  assert.ok(joined.indexOf('Look for') < joined.indexOf('A rhino.') && joined.indexOf('Built in 1519.') < joined.indexOf('Where is the rhino?'));
  assert.match(joined, /Under a turret\./);
});
