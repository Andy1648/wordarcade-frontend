# claude/xpbar-gif.py — THROWAWAY encoder for claude/xpbar-gif.mjs: frames + timestamps → a real-time GIF (PIL).
import sys, json, glob, os
from PIL import Image
src, out, crop = sys.argv[1], sys.argv[2], tuple(int(v) for v in sys.argv[3].split(','))
times = json.load(open(os.path.join(src, 'times.json')))
files = sorted(glob.glob(os.path.join(src, '*.jpg')))
imgs, durs = [], []
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB')
    # screencast frames can come scaled; map the CSS-pixel crop onto the frame
    sx = im.width / 1366
    im = im.crop(tuple(round(c * sx) for c in crop))
    imgs.append(im.convert('P', palette=Image.ADAPTIVE, colors=128))
    nxt = times[i + 1] if i + 1 < len(times) else times[i] + 0.5
    durs.append(max(20, round((nxt - times[i]) * 1000)))
imgs[0].save(out, save_all=True, append_images=imgs[1:], duration=durs, loop=0, optimize=True)
print(out, len(imgs), 'frames', sum(durs), 'ms')
