# cutout-art.py — cut the baked white / checker background out of a ChatGPT gear image (flood fill from the edges,
# stopped by the ink outline), crop, square, 256px RGBA webp. Usage: python3 -I scripts/cutout-art.py in.png public/gear/name.webp [size]
# (size: the square's px — 256 default for gears; 128 icons, 512 big bursts, 64 hearts)
import sys
from collections import deque
from PIL import Image, ImageFilter
src, out = sys.argv[1], sys.argv[2]
size = int(sys.argv[3]) if len(sys.argv) > 3 else 256
im = Image.open(src).convert('RGBA')
w, h = im.size
px = im.load()
def bg(p):
    r, g, b, a = p
    return min(r, g, b) > 185 and max(r, g, b) - min(r, g, b) < 30
seen = bytearray(w * h)
q = deque()
for x in range(w):
    for y in (0, h - 1):
        q.append((x, y))
for y in range(h):
    for x in (0, w - 1):
        q.append((x, y))
while q:
    x, y = q.popleft()
    i = y * w + x
    if seen[i]: continue
    if not bg(px[x, y]): continue
    seen[i] = 1
    px[x, y] = (0, 0, 0, 0)
    if x > 0: q.append((x - 1, y))
    if x < w - 1: q.append((x + 1, y))
    if y > 0: q.append((x, y - 1))
    if y < h - 1: q.append((x, y + 1))
# soften the cut edge: alpha erode 1px of leftover light fringe touching transparency
a = im.split()[3]
bbox = a.getbbox()
im = im.crop(bbox)
side = max(im.size)
pad = int(side * 0.04)
canvas = Image.new('RGBA', (side + 2 * pad, side + 2 * pad), (0, 0, 0, 0))
canvas.paste(im, ((side - im.size[0]) // 2 + pad, (side - im.size[1]) // 2 + pad))
canvas = canvas.resize((size, size), Image.LANCZOS)
canvas.save(out, 'WEBP', quality=88, method=6)
print('bbox', bbox, 'removed', sum(seen), 'of', w * h)
