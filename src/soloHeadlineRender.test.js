// node --test — RENDER-LEVEL test for the solo/Daily results headline.
// Renders the exact expression the results headline now uses (the digits come
// straight from soloHeadlineScore(props), not from any animated/mount-closured
// state) and asserts the rendered TEXT equals the per-round breakdown sum —
// including the production ordering where the `score` prop is still a stale 0 on
// the render the daily score arrives.
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { soloHeadlineScore, sumRoundScores } from './soloScore.js';

// Mirrors <div className="solo-score-value">{effectiveScore}</div> in
// SoloResultsScreen: a pure, prop-derived render with no internal state.
function Headline({ score, daily }) {
  return React.createElement(
    'div',
    { className: 'solo-score-value' },
    String(soloHeadlineScore(score, daily))
  );
}

test('Daily: rendered headline text equals the breakdown sum even when score prop is a stale 0', () => {
  const rounds = [{ roundScore: 4 }, { roundScore: 0 }, { roundScore: 0 }];
  const sum = sumRoundScores(rounds); // 4
  // Production ordering: the `score` prop is still the mount-time 0, but the
  // authoritative daily score has been threaded in. The digits must be the sum.
  const html = renderToStaticMarkup(
    React.createElement(Headline, { score: 0, daily: { score: sum } })
  );
  assert.match(html, new RegExp(`class="solo-score-value">${sum}<`));
  assert.doesNotMatch(html, /solo-score-value">0</);
});

test('Daily: headline tracks the current score across a re-render (0 -> 5)', () => {
  // Two renders with the same element type: the second carries the settled score.
  const early = renderToStaticMarkup(React.createElement(Headline, { score: 0, daily: { score: 0 } }));
  assert.match(early, /solo-score-value">0</);
  const settled = renderToStaticMarkup(React.createElement(Headline, { score: 0, daily: { score: 5 } }));
  assert.match(settled, /solo-score-value">5</);
});

test('Solo (non-Daily): rendered headline text equals the breakdown sum', () => {
  const rounds = [{ roundScore: 3 }, { roundScore: 2 }, { roundScore: 1 }];
  const sum = sumRoundScores(rounds); // 6
  const html = renderToStaticMarkup(React.createElement(Headline, { score: sum, daily: null }));
  assert.match(html, new RegExp(`class="solo-score-value">${sum}<`));
});
