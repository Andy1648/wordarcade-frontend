# make-capsules.py - PLACEHOLDER vector art for the sealed ROLL capsules (feat/tier-rolls). The painted webp set is
# requested from the hero-art session (same paths, .webp); until it lands these SVGs ship. House construction: flat
# fills, outline = a darker shade of the fill, ONE highlight, a hard black drop, a drip, a slight tilt.
#   python claude/rolls-art/make-capsules.py   (writes public/rolls/*.svg + public/ach/roll.svg)
import os

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'public')
TIERS = {
    'epic': dict(body='#B04BFF', shade='#7A1FC4', light='#D88BFF', cap='#2EFFE0', capshade='#12A99A', plate='EPIC+', pfs=26),
    'legendary': dict(body='#FFC23D', shade='#B8860B', light='#FFE48A', cap='#FF6B3D', capshade='#B8431F', plate='LEGEND+', pfs=21),
    'roll': dict(body='#2EFFE0', shade='#12A99A', light='#A9FFF4', cap='#FF4FA3', capshade='#C2185B', plate='', pfs=0),
}

HEAD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">'


def top(c):
    # the upper dome (the cap colour) down to the seam at y=100, with a highlight + a little rivet row
    return (
        f'<g>'
        f'<path d="M44 100 L44 86 C44 40 72 18 100 18 C128 18 156 40 156 86 L156 100 Z" fill="#000" transform="translate(6 6)"/>'
        f'<path d="M44 100 L44 86 C44 40 72 18 100 18 C128 18 156 40 156 86 L156 100 Z" fill="{c["cap"]}" stroke="{c["capshade"]}" stroke-width="7" stroke-linejoin="round"/>'
        f'<path d="M132 34 C148 48 152 66 152 96 L138 96 C138 70 136 52 124 40 Z" fill="{c["capshade"]}"/>'
        f'<path d="M62 70 C62 52 74 38 90 32" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/>'
        f'</g>'
    )


def bottom(c):
    # the lower body (the tier colour) from the seam down, the band + plate, and a drip off the bottom
    plate = ''
    if c['plate']:
        plate = (
            f'<rect x="54" y="108" width="92" height="34" rx="6" fill="#0d0618" stroke="{c["shade"]}" stroke-width="5"/>'
            f'<text x="100" y="{133 if c["pfs"] > 22 else 131}" text-anchor="middle" font-family="Bungee, Impact, sans-serif" '
            f'font-size="{c["pfs"]}" fill="{c["body"]}">{c["plate"]}</text>'
        )
    return (
        f'<g>'
        f'<path d="M44 100 L156 100 L156 114 C156 160 128 182 100 182 C72 182 44 160 44 114 Z" fill="#000" transform="translate(6 6)"/>'
        f'<path d="M44 100 L156 100 L156 114 C156 160 128 182 100 182 C72 182 44 160 44 114 Z" fill="{c["body"]}" stroke="{c["shade"]}" stroke-width="7" stroke-linejoin="round"/>'
        f'<path d="M140 104 L152 104 L152 116 C152 150 134 170 112 176 C130 164 140 144 140 116 Z" fill="{c["shade"]}"/>'
        f'<path d="M86 181 C86 190 90 196 94 196 C98 196 100 190 99 182 Z" fill="{c["body"]}" stroke="{c["shade"]}" stroke-width="4"/>'
        f'<path d="M58 150 C64 164 74 172 84 176" fill="none" stroke="{c["light"]}" stroke-width="7" stroke-linecap="round"/>'
        f'{plate}'
        f'<path d="M40 100 L160 100" stroke="{c["shade"]}" stroke-width="7" stroke-linecap="round"/>'
        f'</g>'
    )


def write(path, inner, rot):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf8', newline='\n') as f:
        f.write(f'{HEAD}<g transform="rotate({rot} 100 100)">{inner}</g></svg>\n')


for name, c in TIERS.items():
    rot = -7 if name == 'epic' else 6 if name == 'legendary' else 9
    if name == 'roll':
        write(os.path.join(ROOT, 'rolls', 'capsule-roll.svg'), bottom(c) + top(c), rot)
        continue
    write(os.path.join(ROOT, 'rolls', f'capsule-{name}.svg'), bottom(c) + top(c), rot)
    write(os.path.join(ROOT, 'rolls', f'capsule-{name}-top.svg'), top(c), rot)
    write(os.path.join(ROOT, 'rolls', f'capsule-{name}-bottom.svg'), bottom(c), rot)
# the ROLL EPIC+ achievement glyph: the EPIC capsule
write(os.path.join(ROOT, 'ach', 'roll.svg'), bottom(TIERS['epic']) + top(TIERS['epic']), -7)
print('ok')
