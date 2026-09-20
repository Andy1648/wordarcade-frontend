// ErrorBoundary.test.js (perf/first-load) — the plain class boundary that replaced
// Sentry.ErrorBoundary: a thrown render error shows the fallback (CrashFallback at the root, the
// per-screen panel in ScreenBoundary) and reaches Sentry via captureException once it is up.
// No DOM in the node suite, so this drives React's boundary lifecycle directly
// (getDerivedStateFromError → componentDidCatch → render) and reads the returned element tree.
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import ErrorBoundary from './ErrorBoundary.js';
import { initSentry, __setSentryLoaderForTests } from '../lib/analytics.js';

function CrashFallback() {
  return React.createElement('div', { className: 'crash' }, 'SOMETHING BROKE.');
}

// Mount-less instance: props in, state driven the way React drives it.
function boundary(props) {
  const b = new ErrorBoundary(props);
  b.setState = (next) => { b.state = { ...b.state, ...(typeof next === 'function' ? next(b.state) : next) }; };
  return b;
}

test('is a real React error boundary (static getDerivedStateFromError + componentDidCatch)', () => {
  assert.equal(typeof ErrorBoundary.getDerivedStateFromError, 'function');
  assert.equal(typeof ErrorBoundary.prototype.componentDidCatch, 'function');
  assert.ok(ErrorBoundary.prototype instanceof React.Component);
  assert.deepEqual(ErrorBoundary.getDerivedStateFromError(new Error('x')).error.message, 'x');
});

test('renders children when healthy, the node fallback (CrashFallback) after a thrown render error', () => {
  const child = React.createElement('p', null, 'app');
  const b = boundary({ fallback: React.createElement(CrashFallback), children: child });
  assert.equal(b.render(), child);
  b.state = ErrorBoundary.getDerivedStateFromError(new Error('render boom'));
  const out = b.render();
  assert.equal(out.type, CrashFallback, 'the root fallback element is rendered');
});

test('a render-fn fallback receives { error, reset, resetError } and reset restores the children', () => {
  const seen = [];
  const b = boundary({
    fallback: ({ error, reset, resetError }) => { seen.push({ error, reset, resetError }); return React.createElement('div', { role: 'alert' }, error.message); },
    children: 'ok',
  });
  b.state = ErrorBoundary.getDerivedStateFromError(new Error('screen boom'));
  const out = b.render();
  assert.equal(out.props.role, 'alert');
  assert.equal(out.props.children, 'screen boom');
  assert.equal(seen[0].reset, seen[0].resetError, 'resetError mirrors Sentry.ErrorBoundary prop shape');
  seen[0].resetError();
  assert.equal(b.render(), 'ok');
});

test('componentDidCatch reports through captureException → reaches Sentry (mock) after init, with context', async () => {
  const captured = [];
  const mod = { init() {}, captureException: (e, ctx) => captured.push({ message: e.message, ctx }) };
  __setSentryLoaderForTests(async () => mod);
  // 1. crash BEFORE Sentry is up → queued
  const b = boundary({ fallback: null, captureContext: { tags: { screen: 'stats' } } });
  let onErrorCalls = 0;
  b.props = { ...b.props, onError: () => { onErrorCalls++; } };
  b.componentDidCatch(new Error('early crash'), { componentStack: 'x' });
  assert.equal(onErrorCalls, 1);
  assert.equal(captured.length, 0);
  // 2. Sentry initialises → the queued report lands
  await initSentry({ dsn: 'dsn' });
  assert.deepEqual(captured.map((c) => c.message), ['early crash']);
  // 3. a crash AFTER init forwards immediately with its screen tag
  b.componentDidCatch(new Error('late crash'), {});
  assert.deepEqual(captured[1], { message: 'late crash', ctx: { tags: { screen: 'stats' } } });
});

test('a throwing onError never masks the report', async () => {
  const captured = [];
  __setSentryLoaderForTests(async () => ({ init() {}, captureException: (e) => captured.push(e.message) }));
  await initSentry({ dsn: 'dsn' });
  const b = boundary({ onError: () => { throw new Error('bad handler'); } });
  b.componentDidCatch(new Error('real'), {});
  assert.deepEqual(captured, ['real']);
});
