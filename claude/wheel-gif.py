# popkit-gif.py ID [ID ...] — screencast frames (claude/shots/popkit/gif/<id>/) → claude/shots/popkit/<id>.gif at 20 fps,
# cropped to the menu's middle (bar + pop area), 0.6x. Frames are resampled on their own timestamps (real-time playback).
import sys, json, os
from PIL import Image
FPS = 20
CROP = (423, 10, 943, 760)
for id in sys.argv[1:]:
    d = f'claude/shots-wheel/gif/{id}'
    st = json.load(open(f'{d}/stamps.json'))
    t0, t1 = st[0][1], st[-1][1]
    out, j, t = [], 0, t0
    while t <= t1:
        while j + 1 < len(st) and st[j + 1][1] <= t: j += 1
        im = Image.open(f'{d}/{st[j][0]}.jpg').convert('RGB')
        sx = im.width / 1366
        im = im.crop(tuple(round(v * sx) for v in CROP))
        im = im.resize((round(im.width * 0.7 / sx), round(im.height * 0.7 / sx)), Image.LANCZOS)
        out.append(im.quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
        t += 1 / FPS
    out[0].save(f'claude/shots-wheel/{id}.gif', save_all=True, append_images=out[1:], duration=1000 // FPS, loop=0, optimize=True)
    print(id, len(out), os.path.getsize(f'claude/shots-wheel/{id}.gif') // 1024, 'KB')
