// analytics.test.js (perf/first-load) — Sentry is LAZY: captureException queues before init and
// flushes into the (mocked) module once initSentry has loaded it; later calls forward directly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { initSentry, captureException, sentryReady, __setSentryLoaderForTests } from './analytics.js';

function fakeSentry() {
  const calls = { init: [], captured: [] };
  const mod = {
    init: (o) => calls.init.push(o),
    captureException: (e, ctx) => calls.captured.push({ message: e.message, ctx }),
  };
  return { mod, calls };
}

test('before init: captureException queues (bounded) and never throws; init flushes the queue in order', async () => {
  const { mod, calls } = fakeSentry();
  let loads = 0;
  __setSentryLoaderForTests(async () => { loads++; return mod; });
  assert.equal(sentryReady(), false);
  captureException(new Error('boot-1'));
  captureException('boot-2 (a string, wrapped)');
  assert.equal(loads, 0, 'nothing loaded until initSentry');
  assert.equal(calls.captured.length, 0);
  await initSentry({ dsn: 'https://x@o.ingest.sentry.io/1' });
  assert.equal(loads, 1);
  assert.deepEqual(calls.init, [{ dsn: 'https://x@o.ingest.sentry.io/1' }]);
  assert.deepEqual(calls.captured.map((c) => c.message), ['boot-1', 'boot-2 (a string, wrapped)']);
  assert.equal(sentryReady(), true);
});

test('after init: captureException forwards directly with its CaptureContext', async () => {
  const { mod, calls } = fakeSentry();
  __setSentryLoaderForTests(async () => mod);
  await initSentry({ dsn: 'dsn' });
  captureException(new Error('live'), { tags: { screen: 'home' } });
  assert.deepEqual(calls.captured, [{ message: 'live', ctx: { tags: { screen: 'home' } } }]);
});

test('no DSN: Sentry is never loaded, the queue is dropped, nothing throws', async () => {
  let loads = 0;
  __setSentryLoaderForTests(async () => { loads++; return fakeSentry().mod; });
  captureException(new Error('dormant'));
  await initSentry({ dsn: '' });
  assert.equal(loads, 0);
  assert.equal(sentryReady(), false);
  captureException(new Error('still dormant')); // queues again, harmless
});

test('a loader that rejects leaves Sentry dormant and never throws', async () => {
  __setSentryLoaderForTests(async () => { throw new Error('offline'); });
  captureException(new Error('x'));
  await initSentry({ dsn: 'dsn' });
  assert.equal(sentryReady(), false);
});

test('the pending queue is bounded at 20', async () => {
  const { mod, calls } = fakeSentry();
  __setSentryLoaderForTests(async () => mod);
  for (let i = 0; i < 50; i++) captureException(new Error(`e${i}`));
  await initSentry({ dsn: 'dsn' });
  assert.equal(calls.captured.length, 20);
  assert.equal(calls.captured[0].message, 'e0');
});
