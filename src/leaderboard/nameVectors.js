// nameVectors.js — the shared truth table for the leaderboard name filter. nameFilter.test.js runs
// it through the client filter; claude/step24/db-parity.mjs runs it through the live DB function.
// Both must agree with `blocked` on every row.
export const NAME_VECTORS = [
  // blocked: exact, leet, roots, runs, decoration
  ['fuck', true], ['FUCK', true], ['fuuuuck', true], ['xXfuckerXx', true], ['f_u_c_k', true],
  ['sh1tlord', true], ['5h1t', true], ['b1tch_99', true], ['n1gg4', true], ['Nigga', true],
  ['c0ck', true], ['d1ck', true], ['a55', false], ['assh0le', true], ['wh0r3', true], ['p0rn_king', true],
  ['HitlerFan', true], ['k1ke', true], ['retard', true], ['tw4t', true], ['kkk_member', true],
  ['dildo', true], ['slut', true], ['motherfker', true], ['motherfucker', true],
  // clean: innocent names that contain blocked fragments
  ['Peacock', false], ['Hancock', false], ['Dickens', false], ['classy', false], ['Bobs', false],
  ['grape', false], ['document', false], ['Essex', false], ['canal', false], ['spicy', false],
  ['Nigeria_fan', false], ['nightowl', false], ['torpedo', false], ['title', false], ['shoes', false],
  ['Scunthorpe', true] /* the classic false positive: accepted for a username */, ['Andy', false], ['word_wizard', false], ['Pixel99', false], ['xx_Bob_xx', false],
  ['assassin', false], ['passport', false], ['cocktail', false], ['analyst', false], ['bass', false],
];
