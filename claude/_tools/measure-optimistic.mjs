// JOB C measure-first: Enter -> visible ACCEPT feedback for Word Bomb, at simulated RTTs.
// The mock captures the sent submit_word, waits `rtt` ms, then pushes word_result{accepted}.
// We time (in-page) from the Enter keypress to when .wb-pending-accept first appears.
import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';
const ME = 'e2e-player';
const wbPlayers = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 2 }];
const waitImg = (p) => p.getByRole('img', { name: 'Type a Word' }).waitFor();

async function reach(p, mock) {
  await p.goto('/?portal=1'); await waitImg(p);
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: wbPlayers } }); await p.waitForTimeout(60);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } }); await p.waitForTimeout(60);
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: wbPlayers, combo: 'at', usedWords: [], timerSeconds: 30 } });
  await p.waitForTimeout(3200); // let the turn-start 3-2-1 clear so the input is enabled
}

async function measure(rtt, word) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ baseURL: 'http://localhost:4173', viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage(); const mock = await installBackendMock(p);
  await reach(p, mock);
  await p.evaluate(() => {
    window.__acceptAt = null;
    const o = new MutationObserver(() => {
      if (document.querySelector('.wb-pending-accept') && window.__acceptAt == null) window.__acceptAt = performance.now();
    });
    o.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  });
  const input = p.locator('.game-input');
  await input.waitFor();
  await input.fill(word);
  await p.evaluate(() => { window.__t0 = performance.now(); });
  await input.press('Enter');
  await mock.waitForSent('submit_word');
  await p.waitForTimeout(rtt);
  mock.pushToClient({ type: 'word_result', payload: { accepted: true, word } });
  await p.waitForFunction(() => window.__acceptAt != null, { timeout: 6000 }).catch(() => {});
  const latency = await p.evaluate(() => (window.__acceptAt == null ? null : Math.round(window.__acceptAt - window.__t0)));
  console.log(`RTT ${String(rtt).padStart(3)}ms  ->  Enter→accept ${latency == null ? 'NO ACCEPT SEEN' : latency + 'ms'}`);
  await b.close();
  return latency;
}

// median of 3 per RTT to smooth jitter; distinct valid words (contain 'at', >=3, unused)
const WORDS = ['cat', 'bat', 'rat'];
for (const rtt of [30, 150, 450]) {
  const runs = [];
  for (let i = 0; i < 3; i++) runs.push(await measure(rtt, WORDS[i]));
  const ok = runs.filter((x) => x != null).sort((a, b) => a - b);
  console.log(`  -> median @ ${rtt}ms RTT: ${ok.length ? ok[Math.floor(ok.length / 2)] + 'ms' : 'n/a'}  (runs: ${runs.join(', ')})\n`);
}
