# gen-worlds.py — authors the 24 WORLD backdrops (STEP 50) as flat-colour SVG files in
# public/worlds/. Same art language as the rest of the game: flat fills, thick COLOURED outlines
# (a darker shade of the fill), hard black offset shadows, drips and uneven hand-cut edges. A seeded
# RNG makes every silhouette asymmetric but reproducible. Re-run after editing a palette or motif:
#   python claude/worlds/gen-worlds.py
import math, os, random

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'worlds')
W, H = 1600, 900

def shade(hex_, k):
    h = hex_.lstrip('#'); r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return '#%02x%02x%02x' % tuple(max(0, min(255, int(c * k))) for c in (r, g, b))

def poly(pts):
    return 'M' + ' L'.join(f'{x:.0f} {y:.0f}' for x, y in pts) + ' Z'

def ridge(rng, base, amp, step, jag=0.5):
    pts = [(-20, H + 20), (-20, base)]
    x = -20
    while x < W + 40:
        x += step * (0.6 + rng.random() * 0.8)
        pts.append((x, base - amp * (0.3 + rng.random() * 0.7) * (1 if rng.random() > jag * 0.3 else 0.4)))
    pts += [(W + 20, base), (W + 20, H + 20)]
    return pts

def layer(d, fill, sw=6, shadow=True):
    s = ''
    if shadow:
        s += f'<path d="{d}" fill="#000" transform="translate(10 10)"/>'
    s += f'<path d="{d}" fill="{fill}" stroke="{shade(fill, 0.55)}" stroke-width="{sw}" stroke-linejoin="round"/>'
    return s

def drips(rng, y, fill, n=7):
    s = ''
    for _ in range(n):
        x = rng.uniform(40, W - 40); w = rng.uniform(10, 22); l = rng.uniform(30, 110)
        s += (f'<path d="M{x:.0f} {y:.0f} C{x:.0f} {y + l * 0.5:.0f} {x - w / 2:.0f} {y + l * 0.7:.0f} {x - w / 2:.0f} {y + l:.0f} '
              f'C{x - w / 2:.0f} {y + l + w:.0f} {x + w / 2:.0f} {y + l + w:.0f} {x + w / 2:.0f} {y + l:.0f} '
              f'C{x + w / 2:.0f} {y + l * 0.7:.0f} {x + w:.0f} {y + l * 0.5:.0f} {x + w:.0f} {y:.0f} Z" fill="{fill}" stroke="{shade(fill, 0.55)}" stroke-width="4"/>')
    return s

def star(cx, cy, r, fill):
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5; rr = r if i % 2 == 0 else r * 0.45
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    return f'<path d="{poly(pts)}" fill="{fill}" stroke="{shade(fill, 0.55)}" stroke-width="4" stroke-linejoin="round"/>'

# ---- motifs: each returns the SVG body for a palette ------------------------------------------------
def m_city(rng, p):
    s = ''
    for row, (base, hmax, col) in enumerate([(640, 260, p['far']), (760, 300, p['near'])]):
        x = -30; d = ''
        while x < W:
            w = rng.uniform(70, 150); h = rng.uniform(80, hmax)
            d += poly([(x, base + 200), (x, base - h), (x + w * 0.5, base - h - rng.uniform(0, 30)), (x + w, base - h), (x + w, base + 200)]) + ' '
            x += w + rng.uniform(4, 20)
        s += layer(d, col)
        if row == 1:
            for _ in range(26):
                wx, wy = rng.uniform(0, W), rng.uniform(base - 220, base - 40)
                s += f'<rect x="{wx:.0f}" y="{wy:.0f}" width="16" height="22" fill="{p["accent"]}" stroke="{shade(p["accent"], 0.55)}" stroke-width="3"/>'
    return s + drips(rng, 760, p['near'])

def m_hills(rng, p):
    return layer(poly(ridge(rng, 600, 200, 160)), p['far']) + layer(poly(ridge(rng, 740, 160, 120)), p['near']) + drips(rng, 742, p['near'])

def m_spikes(rng, p):
    s = layer(poly(ridge(rng, 620, 320, 90, jag=1)), p['far'])
    s += layer(poly(ridge(rng, 760, 260, 70, jag=1)), p['near'])
    for _ in range(9):
        x = rng.uniform(0, W); h = rng.uniform(120, 260)
        s += layer(poly([(x - 30, 900), (x, 900 - h - 200), (x + 34, 900)]), p['accent'], sw=5)
    return s

def m_waves(rng, p):
    s = ''
    for i, (y, col) in enumerate([(560, p['far']), (660, p['near']), (780, p['accent'])]):
        d = f'M-20 {H + 20} L-20 {y}'
        x = -20
        while x < W + 40:
            x2 = x + rng.uniform(140, 220)
            d += f' Q{(x + x2) / 2:.0f} {y - rng.uniform(40, 90):.0f} {x2:.0f} {y}'
            x = x2
        d += f' L{W + 20} {H + 20} Z'
        s += layer(d, col)
    return s

def m_grid(rng, p):
    s = layer(poly(ridge(rng, 560, 120, 200)), p['far'])
    s += f'<rect x="-20" y="600" width="{W + 40}" height="320" fill="{p["near"]}" stroke="{shade(p["near"], 0.55)}" stroke-width="6"/>'
    for i in range(-12, 13):
        x2 = W / 2 + i * 160
        s += f'<path d="M{W / 2 + i * 18:.0f} 600 L{x2:.0f} 920" stroke="{p["accent"]}" stroke-width="6"/>'
    y = 610
    k = 10
    while y < 920:
        s += f'<path d="M-20 {y:.0f} L{W + 20} {y:.0f}" stroke="{p["accent"]}" stroke-width="5"/>'
        y += k; k *= 1.35
    return s

def m_blobs(rng, p):
    s = layer(poly(ridge(rng, 640, 150, 140)), p['far'])
    for _ in range(11):
        x, y, r = rng.uniform(0, W), rng.uniform(620, 860), rng.uniform(50, 120)
        col = rng.choice([p['near'], p['accent']])
        s += f'<circle cx="{x + 10:.0f}" cy="{y + 10:.0f}" r="{r:.0f}" fill="#000"/><circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.0f}" fill="{col}" stroke="{shade(col, 0.55)}" stroke-width="6"/>'
    return s + drips(rng, 700, p['near'], 5)

def m_space(rng, p):
    s = ''
    for _ in range(22):
        s += star(rng.uniform(0, W), rng.uniform(40, 520), rng.uniform(8, 22), p['accent'])
    cx, cy, r = rng.uniform(250, 1350), rng.uniform(180, 320), rng.uniform(90, 150)
    s += f'<circle cx="{cx + 12:.0f}" cy="{cy + 12:.0f}" r="{r:.0f}" fill="#000"/><circle cx="{cx:.0f}" cy="{cy:.0f}" r="{r:.0f}" fill="{p["far"]}" stroke="{shade(p["far"], 0.55)}" stroke-width="7"/>'
    s += f'<ellipse cx="{cx:.0f}" cy="{cy:.0f}" rx="{r * 1.7:.0f}" ry="{r * 0.32:.0f}" fill="none" stroke="{p["accent"]}" stroke-width="9" transform="rotate(-12 {cx:.0f} {cy:.0f})"/>'
    s += layer(poly(ridge(rng, 780, 120, 110)), p['near'])
    for _ in range(6):
        x = rng.uniform(0, W); s += f'<ellipse cx="{x:.0f}" cy="{rng.uniform(800, 880):.0f}" rx="{rng.uniform(30, 70):.0f}" ry="14" fill="{shade(p["near"], 0.7)}"/>'
    return s

MOTIFS = {'city': m_city, 'hills': m_hills, 'spikes': m_spikes, 'waves': m_waves, 'grid': m_grid, 'blobs': m_blobs, 'space': m_space}

# ---- the 24 worlds (tier 1..24; tier 0 is the bare wall) -------------------------------------------
WORLDS = [
    ('rooftops', 'ROOFTOPS', 'city', '#1b0f33', '#3a2266', '#5b2fa0', '#FFE94A'),
    ('scrapyard', 'SCRAPYARD', 'blobs', '#1f140b', '#5c3d1e', '#8a5a2b', '#FF6B3D'),
    ('foundry', 'FOUNDRY', 'spikes', '#1a0d0d', '#4a1f1f', '#7a2b2b', '#FFB23D'),
    ('highway', 'HIGHWAY', 'grid', '#120826', '#2b1a55', '#1a0b2e', '#FF4FA3'),
    ('dunes', 'DUNES', 'hills', '#2a1505', '#b8661f', '#e0913a', '#FFE94A'),
    ('arcade', 'ARCADE', 'grid', '#05081a', '#1a2a66', '#0d0618', '#2EFFE0'),
    ('volcano', 'VOLCANO', 'spikes', '#180402', '#4a0f08', '#7a1a0d', '#FF6B3D'),
    ('glacier', 'GLACIER', 'spikes', '#061428', '#2a5f8f', '#7fc4e8', '#e6f1ff'),
    ('jungle', 'JUNGLE', 'blobs', '#04140a', '#145c2e', '#1f8f45', '#C8FF3D'),
    ('lagoon', 'LAGOON', 'waves', '#04121f', '#0f4c6b', '#1784a8', '#2EFFE0'),
    ('candyland', 'CANDYLAND', 'blobs', '#24081a', '#a3175e', '#ff4fa3', '#FFE94A'),
    ('stormfront', 'STORMFRONT', 'hills', '#0a0a16', '#2b2b4a', '#45456e', '#FFE94A'),
    ('crystal-cave', 'CRYSTAL CAVE', 'spikes', '#0d0618', '#3d1a6e', '#6a2bb0', '#2EFFE0'),
    ('moonbase', 'MOONBASE', 'space', '#06060f', '#b9c6d6', '#5f6f84', '#FFE94A'),
    ('nebula', 'NEBULA', 'space', '#120624', '#9A1AFF', '#3d1a6e', '#FF4FA3'),
    ('sunburst', 'SUNBURST', 'hills', '#2a1000', '#FF6B3D', '#FFB23D', '#FFE94A'),
    ('night-rooftops', 'NIGHT CITY', 'city', '#04030a', '#1a1040', '#2b1a55', '#2EFFE0'),
    ('neon-jungle', 'NEON JUNGLE', 'blobs', '#020a05', '#0a3d1e', '#145c2e', '#FF4FA3'),
    ('deep-sea', 'DEEP SEA', 'waves', '#01060d', '#06263d', '#0b3f63', '#9A1AFF'),
    ('lava-lake', 'LAVA LAKE', 'waves', '#120201', '#5c0f05', '#a3200a', '#FFE94A'),
    ('frost-grid', 'FROST GRID', 'grid', '#030b17', '#1a3d66', '#06142b', '#e6f1ff'),
    ('gold-rush', 'GOLD RUSH', 'hills', '#1a1200', '#a8800f', '#FFD54A', '#ffffff'),
    ('event-horizon', 'EVENT HORIZON', 'space', '#000000', '#2b0a4a', '#120624', '#FFE94A'),
    ('legend', 'LEGEND', 'spikes', '#0d0618', '#9A1AFF', '#FF4FA3', '#FFE94A'),
]

def main():
    os.makedirs(OUT, exist_ok=True)
    for i, (wid, name, motif, sky, far, near, accent) in enumerate(WORLDS):
        rng = random.Random(1648 + i * 97)
        p = {'sky': sky, 'far': far, 'near': near, 'accent': accent}
        body = MOTIFS[motif](rng, p)
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMax slice">'
               f'<rect width="{W}" height="{H}" fill="{sky}"/>{body}</svg>')
        with open(os.path.join(OUT, f'{i + 1:02d}-{wid}.svg'), 'w', encoding='utf8') as f:
            f.write(svg)
    with open(os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'progress', 'worldsData.js'), 'w', encoding='utf8') as f:
        f.write('// GENERATED by claude/worlds/gen-worlds.py — the 24 WORLDS, one per border tier (1..24).\n')
        f.write('export const WORLDS = [\n')
        for i, (wid, name, motif, sky, far, near, accent) in enumerate(WORLDS):
            f.write(f"  {{ tier: {i + 1}, id: '{wid}', name: '{name}', src: '/worlds/{i + 1:02d}-{wid}.svg', sky: '{sky}', accent: '{accent}' }},\n")
        f.write('];\n')
    print('wrote', len(WORLDS), 'worlds')

main()
