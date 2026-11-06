# gears-nov3-apply.py — NEW GEARS batch 2 (nov3, mission control: "bombs, newgrounds energy"): 3 RARE + 1 MYTHIC + 1 SECRET
# (MYTHIC crit power / overdrive and SECRET long-word wins print as broken K numbers, so they are skipped; MEGATON is a SECRET) on the last free (main kind, tier) slots (LEGENDARY + EPIC are full; no MYTHIC game XP — it would break the 35% cap).
import sys
G = [
    # id, name, tier, mode, stat, subs, perks, art, flavour
    ('mk-cherrybomb', 'CHERRY BOMB', 'rare', None, 'streakWinsPct', 'C3 L5', [], 'cherrybomb', 'KEEP WINNING. KEEP TICKING.'),
    ('mk-spraycan', 'SPRAY CAN', 'rare', None, 'longWinsPct', 'P.25 G5', [], 'spraycan', 'BIG WORDS. BIGGER LETTERS.'),
    ('mk-popcorn', 'POPCORN', 'rare', None, 'gameXpPct', 'W2 G5', [], 'popcorn', 'EVERY GAME POPS OFF.'),
        ('mk-pinata', 'PINATA', 'mythic', None, 'gemsPct', 'C14 L50 X15', ['dropTwice', 'freeOd'], 'pinata', 'HIT IT. GET RICH.'),
    ('mk-megaton', 'MEGATON', 'secret', None, 'streakWinsPct', 'P3 W80 L40 O240', ['critKey10', 'frenzyAll', 'freeOd'], 'megaton', 'WIN STREAK GOES NUCLEAR.'),
]


def ed(p, a, b):
    s = open(p, encoding='utf8').read()
    assert s.count(a) == 1, (p, a[:80])
    open(p, 'w', encoding='utf8', newline='\n').write(s.replace(a, b))


def row(g):
    i, n, t, mode, st, subs, *_ = g
    m = f"'{mode}'" if mode else 'null'
    return f"  {{ id: '{i}', name: '{n}', tier: '{t}', mode: {m}, stat: '{st}', subs: '{subs}' }},"


by = lambda t: [g for g in G if g[2] == t]
P = 'src/progress/markRollsCore.js'
s = open(P, encoding='utf8').read()
for anchor_id, t, note in [('mk-gumball', 'rare', 'three RARES'), ('mk-supernova', 'mythic', 'one MYTHIC'), ('mk-paradox', 'secret', 'a SECRET chase piece')]:
    line = next(l for l in s.split('\n') if f"id: '{anchor_id}'" in l)
    s = s.replace(line, line + f"\n  // NEW GEARS nov3 (batch 2, bombs + Newgrounds energy): {note} on free (stat, tier) slots\n" + '\n'.join(row(g) for g in by(t)), 1)
open(P, 'w', encoding='utf8', newline='\n').write(s)

ed('src/progress/markPerks.js', "  'mk-supernova': ['overdrive15', 'freeOd'],",
   "  'mk-supernova': ['overdrive15', 'freeOd'],\n  // NEW GEARS nov3 — existing perks only\n" + '\n'.join(f"  '{g[0]}': [{', '.join(repr(x) for x in g[6])}]," for g in G if g[6]))
ed('src/progress/markFlavour.js', "  'mk-supernova': 'WIN MORE. BURN BRIGHTER.',",
   "  'mk-supernova': 'WIN MORE. BURN BRIGHTER.',\n  // ---- NEW GEARS nov3 ----\n" + '\n'.join(f"  '{g[0]}': '{g[8]}'," for g in G))
ed('src/components/markGlyphsRolled.jsx', "  'mk-supernova': ART('supernova'),",
   "  'mk-supernova': ART('supernova'),\n  // NEW GEARS nov3: 7 painted in ONE ChatGPT Plus chat (best of 4 each), the gear sheet as the style ref\n" + '\n'.join(f"  '{g[0]}': ART('{g[7]}')," for g in G))
F = 'src/components/markGlyphFinish.jsx'
f = open(F, encoding='utf8').read()
i = f.index("'mk-supernova',") + len("'mk-supernova',")
open(F, 'w', encoding='utf8', newline='\n').write(f[:i] + "\n  // NEW GEARS nov3\n  " + ', '.join(f"'{g[0]}'" for g in G) + ',' + f[i:])
print('applied', len(G))
