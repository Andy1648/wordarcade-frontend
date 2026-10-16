# split-sheet.py â€” cut a white-background sticker SHEET (several separate props on one image) into one RGBA webp per
# piece: flood-fill the white from the edges (stopped by the ink outline, like cutout-art.py), then label the connected
# pieces left-to-right / top-to-bottom and save each, cropped + squared.
# Usage: python -I scripts/split-sheet.py sheet.png out_dir/prefix [size=128] [min_px=400] [fit]
# ('fit' keeps each piece's aspect: size = its longest side, no square padding — podium blocks, banners)
# Prints one line per piece: index, bbox, mean colour â€” so the caller can name/sort them.
import sys, os
from collections import deque
from PIL import Image
src, prefix = sys.argv[1], sys.argv[2]
size = int(sys.argv[3]) if len(sys.argv) > 3 else 128
min_px = int(sys.argv[4]) if len(sys.argv) > 4 else 400
fit = len(sys.argv) > 5 and sys.argv[5] == 'fit'
im = Image.open(src).convert('RGBA')
w, h = im.size
px = im.load()
def bg(p):
    r, g, b, a = p
    return min(r, g, b) > 185 and max(r, g, b) - min(r, g, b) < 30
seen = bytearray(w * h)
q = deque((x, y) for x in range(w) for y in (0, h - 1))
q.extend((x, y) for y in range(h) for x in (0, w - 1))
while q:
    x, y = q.popleft()
    i = y * w + x
    if seen[i] or not bg(px[x, y]): continue
    seen[i] = 1
    px[x, y] = (0, 0, 0, 0)
    if x > 0: q.append((x - 1, y))
    if x < w - 1: q.append((x + 1, y))
    if y > 0: q.append((x, y - 1))
    if y < h - 1: q.append((x, y + 1))
# enclosed white HOLES (inside a streamer loop, between an arm and a body) are not edge-connected, so the fill above
# misses them. A hole is ringed by INK; a highlight is ringed by fill colour â€” clear the white regions whose border is
# mostly dark.
for y0 in range(h):
    for x0 in range(w):
        if seen[y0 * w + x0] or not bg(px[x0, y0]): continue
        reg = []; ring = dark = 0
        dq = deque([(x0, y0)]); seen[y0 * w + x0] = 1
        while dq:
            x, y = dq.popleft(); reg.append((x, y))
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if not (0 <= nx < w and 0 <= ny < h): continue
                p = px[nx, ny]
                if p[3] and bg(p):
                    if not seen[ny * w + nx]: seen[ny * w + nx] = 1; dq.append((nx, ny))
                elif p[3]:
                    ring += 1
                    if p[0] + p[1] + p[2] < 240: dark += 1
        if ring and dark / ring > 0.6:
            for x, y in reg: px[x, y] = (0, 0, 0, 0)
# connected components of the opaque pixels (8-connected)
lab = [0] * (w * h)
pieces = []
for y0 in range(h):
    for x0 in range(w):
        i0 = y0 * w + x0
        if lab[i0] or px[x0, y0][3] == 0: continue
        n = len(pieces) + 1
        lab[i0] = n
        dq = deque([(x0, y0)])
        x1 = x2 = x0; y1 = y2 = y0; cnt = 0; rs = gs = bs = 0
        while dq:
            x, y = dq.popleft()
            cnt += 1
            r, g, b, _ = px[x, y]; rs += r; gs += g; bs += b
            x1 = min(x1, x); x2 = max(x2, x); y1 = min(y1, y); y2 = max(y2, y)
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if not lab[j] and px[nx, ny][3]:
                            lab[j] = n
                            dq.append((nx, ny))
        pieces.append((n, (x1, y1, x2 + 1, y2 + 1), cnt, (rs // cnt, gs // cnt, bs // cnt)))
pieces = [p for p in pieces if p[2] >= min_px]
pieces.sort(key=lambda p: (p[1][1] // (h // 6), p[1][0]))
os.makedirs(os.path.dirname(prefix) or '.', exist_ok=True)
for k, (n, box, cnt, col) in enumerate(pieces):
    crop = im.crop(box)
    cl = crop.load()
    # keep only this piece (blank any neighbour poking into the box)
    for yy in range(crop.size[1]):
        for xx in range(crop.size[0]):
            if lab[(box[1] + yy) * w + box[0] + xx] != n: cl[xx, yy] = (0, 0, 0, 0)
    if fit:
        k2 = size / max(crop.size) if size else 1  # size 0 = native pixels (keeps relative scale across pieces)
        crop.resize((round(crop.size[0] * k2), round(crop.size[1] * k2)), Image.LANCZOS).save(f'{prefix}-{k}.webp', 'WEBP', quality=90, method=6)
        print(k, box, cnt, '#%02x%02x%02x' % col)
        continue
    side = max(crop.size)
    pad = int(side * 0.06)
    canvas = Image.new('RGBA', (side + 2 * pad, side + 2 * pad), (0, 0, 0, 0))
    canvas.paste(crop, ((side - crop.size[0]) // 2 + pad, (side - crop.size[1]) // 2 + pad))
    canvas.resize((size, size), Image.LANCZOS).save(f'{prefix}-{k}.webp', 'WEBP', quality=88, method=6)
    print(k, box, cnt, '#%02x%02x%02x' % col)
