# make-vessels.py - PLACEHOLDER vector parts for the COG-LOCKED GEAR CANISTER (the sealed ROLL vessel, feat/tier-rolls).
# The painted set (vessel-<tier>-{base,lid,cog,badge}.webp, vessel-shard-1..3.webp, vessel-glow-<tier>.webp) is coming
# from the hero-art session; until then these SVGs fill the SAME slots. Every part is drawn on ONE shared 512 canvas
# (registered: stacking base + lid + cog + badge = the whole vessel), except the shards (their own 64 canvas, pooled).
# House construction: flat fills, outline = a darker shade of the fill, one highlight, hard black drop, a drip, a tilt.
#   python claude/rolls-art/make-vessels.py   (writes public/rolls/vessel-*.svg + the icon / achievement glyph)
import math
import os

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'public')
T = {
    # EPIC: steel cog, purple plating
    'epic': dict(plate='#B04BFF', plateS='#7A1FC4', plateL='#D88BFF', cog='#C9D2E0', cogS='#6B7689', lid='#A9B4C8', lidS='#5A6478', crown=False),
    # LEGENDARY: gold cog with a crown, gold plating
    'legendary': dict(plate='#FFC23D', plateS='#B8860B', plateL='#FFE48A', cog='#FFD966', cogS='#A87400', lid='#FFB020', lidS='#9A6400', crown=True),
}
HEAD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">'
DROP = 'transform="translate(10 10)"'
CX, CY = 256, 238  # the cog sits on the lid/body seam - it is the lock


def base(c):
    body = 'M150 236 L362 236 L362 420 C362 446 344 458 318 458 L194 458 C168 458 150 446 150 420 Z'
    return (
        f'<path d="{body}" fill="#000" {DROP}/>'
        f'<path d="{body}" fill="{c["plate"]}" stroke="{c["plateS"]}" stroke-width="12" stroke-linejoin="round"/>'
        f'<path d="M330 248 L350 248 L350 418 C350 438 338 446 320 448 C332 436 332 424 330 410 Z" fill="{c["plateS"]}"/>'
        f'<path d="M150 300 L362 300 M150 410 L362 410" stroke="{c["plateS"]}" stroke-width="10"/>'
        f'<path d="M176 320 L176 392" stroke="{c["plateL"]}" stroke-width="12" stroke-linecap="round"/>'
        f'<path d="M210 456 C210 474 216 486 224 486 C232 486 236 474 234 458 Z" fill="{c["plate"]}" stroke="{c["plateS"]}" stroke-width="7"/>'
    )


def lid(c):
    d = 'M134 238 L134 206 C134 176 160 158 190 158 L322 158 C352 158 378 176 378 206 L378 238 Z'
    return (
        f'<path d="{d}" fill="#000" {DROP}/>'
        f'<path d="{d}" fill="{c["lid"]}" stroke="{c["lidS"]}" stroke-width="12" stroke-linejoin="round"/>'
        f'<rect x="226" y="122" width="60" height="40" rx="10" fill="{c["lid"]}" stroke="{c["lidS"]}" stroke-width="10"/>'
        f'<path d="M160 196 C164 182 176 174 194 172" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round"/>'
        f'<path d="M340 170 C356 178 364 192 364 226 L348 226 C348 200 346 186 334 176 Z" fill="{c["lidS"]}"/>'
    )


def cog(c):
    teeth, ro, ri = 10, 70, 54
    pts = []
    for i in range(teeth * 2):
        a0 = math.pi * 2 * i / (teeth * 2)
        r = ro if i % 2 == 0 else ri
        for da in (-0.11, 0.11):
            a = a0 + da
            pts.append(f'{CX + r * math.cos(a):.1f} {CY + r * math.sin(a):.1f}')
    d = 'M' + ' L'.join(pts) + ' Z'
    crown = ''
    if c['crown']:
        crown = (f'<path d="M226 250 L226 222 L240 236 L256 214 L272 236 L286 222 L286 250 Z" fill="#FFE94A" '
                 f'stroke="{c["cogS"]}" stroke-width="6" stroke-linejoin="round"/>')
    return (
        f'<path d="{d}" fill="#000" {DROP}/>'
        f'<path d="{d}" fill="{c["cog"]}" stroke="{c["cogS"]}" stroke-width="9" stroke-linejoin="round"/>'
        f'<circle cx="{CX}" cy="{CY}" r="32" fill="{c["cogS"]}" stroke="{c["cogS"]}" stroke-width="6"/>'
        f'<circle cx="{CX}" cy="{CY}" r="20" fill="{c["cog"]}"/>'
        f'{crown}'
        f'<path d="M210 206 C218 196 228 190 240 188" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/>'
    )


def badge(c):
    # BLANK on purpose: the tier is set over it in code (Bungee)
    return (
        f'<g transform="rotate(-3 256 362)">'
        f'<rect x="166" y="330" width="180" height="64" rx="10" fill="#000" {DROP}/>'
        f'<rect x="166" y="330" width="180" height="64" rx="10" fill="#F4EEDC" stroke="{c["plateS"]}" stroke-width="8"/>'
        f'<circle cx="182" cy="346" r="5" fill="{c["plateS"]}"/><circle cx="330" cy="378" r="5" fill="{c["plateS"]}"/>'
        f'</g>'
    )


def glow(c):
    # a flat ray star (no gradient), spilling up from the open top
    pts = []
    for i in range(24):
        a = math.pi * 2 * i / 24 - math.pi / 2
        r = 240 if i % 2 == 0 else 120 + (i % 4) * 14
        pts.append(f'{256 + r * math.cos(a):.1f} {200 + r * math.sin(a) * 0.9:.1f}')
    return f'<path d="M{" L".join(pts)} Z" fill="{c["plateL"]}" opacity=".85"/><circle cx="256" cy="200" r="90" fill="#fff" opacity=".7"/>'


SHARDS = [
    'M8 30 L30 6 L56 18 L40 52 L14 50 Z',
    'M10 14 L52 8 L44 40 L20 56 Z',
    'M6 40 L24 10 L58 26 L50 54 Z',
]


def write(path, inner, rot=0, head=HEAD):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf8', newline='\n') as f:
        f.write(f'{head}<g transform="rotate({rot} 256 300)">{inner}</g></svg>\n')


for name, c in T.items():
    for part, fn in (('base', base), ('lid', lid), ('cog', cog), ('badge', badge)):
        write(os.path.join(ROOT, 'rolls', f'vessel-{name}-{part}.svg'), fn(c))
    write(os.path.join(ROOT, 'rolls', f'vessel-glow-{name}.svg'), glow(c))
for i, d in enumerate(SHARDS, 1):
    with open(os.path.join(ROOT, 'rolls', f'vessel-shard-{i}.svg'), 'w', encoding='utf8', newline='\n') as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">'
                f'<path d="{d}" fill="#000" transform="translate(4 4)"/><path d="{d}" fill="#FFE94A" stroke="#B8860B" stroke-width="5" stroke-linejoin="round"/></svg>\n')
# the generic ROLL icon + the ROLL EPIC+ achievement glyph: the whole vessel, one file each
cyan = dict(T['epic'], plate='#2EFFE0', plateS='#12A99A', plateL='#A9FFF4')
whole = lambda c: base(c) + lid(c) + cog(c)  # noqa: E731
write(os.path.join(ROOT, 'rolls', 'vessel-icon.svg'), whole(cyan), 9)
write(os.path.join(ROOT, 'ach', 'roll.svg'), whole(T['epic']) + badge(T['epic']), -7)
write(os.path.join(ROOT, 'ach', 'die.svg'), whole(T['epic']) + badge(T['epic']), -7)  # old badge rows say 'die'
print('ok')
