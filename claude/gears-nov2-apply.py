# gears12.py — the nov2 NEW GEARS batch, applied to the repo (pool rows, perks, flavour, glyph ART, finish list, test
# id list). Free (main kind, tier) slots only, no new flat XP, substats copied from a same-tier peer's pattern.
import re, sys
G = [
    # id, name, tier, mode, stat, subs, perks, art, flavour
    ('mk-bullseye', 'BULLSEYE', 'epic', None, 'gameXpPct', 'C9 G15', [], 'bullseye', 'HITS THE GAME. SCORES THE XP.'),
    ('mk-rocketskates', 'ROCKET SKATES', 'epic', 'wordRace', 'raceWinsPct', 'C3 L10 X3', [], 'rocketskates', 'BRAKES ARE FOR LOSERS.'),
    ('mk-snowball', 'SNOWBALL', 'epic', None, 'streakWinsPct', 'W4 G10 O30', ['combo'], 'snowball', 'ONLY GETS BIGGER.'),
    ('mk-telescope', 'TELESCOPE', 'epic', None, 'longWinsPct', 'C6 P.5 L10', ['bigWords'], 'telescope', 'SPOTS A LONG WORD A MILE OFF.'),
    ('mk-drumsticks', 'DRUMSTICKS', 'epic', None, 'critEvery', 'C6 W4 X2', ['critKey10'], 'drumsticks', 'KEEPS TIME. BREAKS RECORDS.'),
    ('mk-anchor', 'ANCHOR', 'mythic', 'chain', 'chainWinsPct', 'W30 G25 O240', ['combo', 'freeOd'], 'anchor', 'DROPS THE CHAIN. HOLDS THE LEAD.'),
    ('mk-comet', 'COMET', 'mythic', 'wordRace', 'raceWinsPct', 'C14 X30 O120', ['winner2', 'freeOd'], 'comet', 'FIRST ACROSS. LEAVES A TRAIL.'),
    ('mk-meltdown', 'MELTDOWN', 'mythic', None, 'longWinsPct', 'C14 P2 W60', ['bigWords', 'freeOd'], 'meltdown', 'BIG WORDS GO NUCLEAR.'),
    ('mk-genie', 'GENIE', 'mythic', None, 'luckPct', 'P2 W30 G50', ['dropTwice', 'freeOd'], 'genie', 'THREE WISHES. ALL GEARS.'),
    ('mk-gauntlet', 'GAUNTLET', 'mythic', 'fuse', 'fuseWinsPct', 'C28 P2 X15', ['critKey10', 'freeOd'], 'gauntlet', 'ONE PUNCH LIGHTS THE FUSE.'),
    ('mk-grimoire', 'GRIMOIRE', 'mythic', 'satRush', 'satWinsPct', 'L50 X15 O120', ['fortune', 'freeOd'], 'grimoire', 'EVERY WORD, ALREADY WRITTEN.'),
    ('mk-supernova', 'SUPERNOVA', 'mythic', None, 'streakWinsPct', 'C14 P4 O120', ['overdrive15', 'freeOd'], 'supernova', 'WIN MORE. BURN BRIGHTER.'),
]
STAGE = sys.argv[1] if len(sys.argv) > 1 else 'all'


def ed(p, a, b, n=1):
    s = open(p, encoding='utf8').read()
    assert a in s, (p, a[:80])
    s = s.replace(a, b, n)
    open(p, 'w', encoding='utf8', newline='\n').write(s)


def row(g):
    i, n, t, mode, st, subs, *_ = g
    m = f"'{mode}'" if mode else 'null'
    return f"  {{ id: '{i}', name: '{n}', tier: '{t}', mode: {m}, stat: '{st}', subs: '{subs}' }},"


by = lambda t: [g for g in G if g[2] == t]
P = 'src/progress/markRollsCore.js'
ed(P, "  // ---- LEGENDARY (9) + perk ----",
   "  // NEW GEARS nov2 (Andy \"make hella sick gears\"): five EPICS on free (stat, tier) slots — painted in ChatGPT Plus\n"
   + '\n'.join(row(g) for g in by('epic')) + "\n  // ---- LEGENDARY (9) + perk ----")
ed(P, "  // ---- MYTHIC (4) + perks",
   "  // NEW GEARS nov2: four LEGENDARIES (each now 1 IN 130 x 16)\n" + '\n'.join(row(g) for g in by('legendary')) + "\n  // ---- MYTHIC (4) + perks")
ed(P, "  // ---- SECRET (1) + game-changing perks ----",
   "  // NEW GEARS nov2: seven MYTHIC chase pieces (every LEGENDARY main slot is taken by a rolled or UNLISTED gear, so the big ones are MYTHIC)\n" + '\n'.join(row(g) for g in by('mythic')) + "\n  // ---- SECRET (1) + game-changing perks ----")

K = 'src/progress/markPerks.js'
ed(K, "  'mk-paradox': ['twinSouls', 'freeOd'],",
   "  'mk-paradox': ['twinSouls', 'freeOd'],\n  // NEW GEARS nov2 — existing perks only (no new perk code)\n"
   + '\n'.join(f"  '{g[0]}': [{', '.join(repr(x) for x in g[6])}]," for g in G if g[6]))

F = 'src/progress/markFlavour.js'
ed(F, "  'mk-paradox': 'TWO GEARS. ONE SOUL.',",
   "  'mk-paradox': 'TWO GEARS. ONE SOUL.',\n  // ---- NEW GEARS nov2 ----\n" + '\n'.join(f"  '{g[0]}': '{g[8]}'," for g in G))

A = 'src/components/markGlyphsRolled.jsx'
ed(A, "  'mk-paradox': ART('paradox'),",
   "  'mk-paradox': ART('paradox'),\n  // NEW GEARS nov2: 12 painted in ONE ChatGPT Plus chat (best of 4-6 variants each), the gear sheet as the style ref\n"
   + '\n'.join(f"  '{g[0]}': ART('{g[7]}')," for g in G))
print('ok')
ed('src/components/markGlyphFinish.jsx', "'mk-trident', 'mk-paradox',", "'mk-trident', 'mk-paradox',\n  // NEW GEARS nov2\n  " + ', '.join(f"'{g[0]}'" for g in G) + ',')
print('finish ok')
