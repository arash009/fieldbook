import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seal, open, openWithKey, deriveKey, randomBytes, toBase64, fromBase64, sealBytes, openBytes } from '../app/js/crypto.js';

const FAST = { iterations: 1000 };

test('seal then open round-trips with a passphrase', async () => {
  const env = await seal({ hello: 'world' }, 'correct horse battery staple vivid', FAST);
  assert.equal(env.fieldbook, 1);
  assert.equal(env.iterations, 1000);
  const { data, key } = await open(env, 'correct horse battery staple vivid');
  assert.deepEqual(data, { hello: 'world' });
  assert.deepEqual(await openWithKey(env, key), { hello: 'world' });
});

test('a wrong passphrase is rejected', async () => {
  const env = await seal({ a: 1 }, 'one two three four five', FAST);
  await assert.rejects(open(env, 'one two three four six'));
});

test('a stable salt lets a saved key open later envelopes', async () => {
  const salt = randomBytes(16);
  const first = await seal({ v: 1 }, 'p q r s t u', { salt, ...FAST });
  const { key } = await open(first, 'p q r s t u');
  const second = await seal({ v: 2 }, 'p q r s t u', { salt, ...FAST });
  assert.equal(second.salt, first.salt);
  assert.notEqual(second.iv, first.iv);
  assert.deepEqual(await openWithKey(second, key), { v: 2 });
});

test('base64 helpers survive large binary', () => {
  const bytes = randomBytes(100000);
  assert.deepEqual(fromBase64(toBase64(bytes)), bytes);
});

test('derived keys cannot be exported', async () => {
  const key = await deriveKey('x', randomBytes(16), 1000);
  await assert.rejects(globalThis.crypto.subtle.exportKey('raw', key));
});

test('bytes round-trip with a key', async () => {
  const { key } = await open(await seal({ a: 1 }, 'p q r s t u', FAST), 'p q r s t u');
  const bytes = randomBytes(5000);
  const env = await sealBytes(bytes, key);
  assert.equal(env.kind, 'file');
  assert.deepEqual(await openBytes(env, key), bytes);
});
