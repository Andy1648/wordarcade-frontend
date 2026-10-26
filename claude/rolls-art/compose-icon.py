# compose-icon.py — builds public/rolls/vessel-icon.webp (the KitIcon 'roll' icon) from the PAINTED epic parts,
# registered by public/rolls/vessel-epic.json exactly like VesselArt.jsx does. Run: python -I claude/rolls-art/compose-icon.py
import json, os
from PIL import Image
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'rolls')
off = json.load(open(os.path.join(R, 'vessel-epic.json')))
W = 512
out = Image.open(os.path.join(R, 'vessel-epic-base.webp')).convert('RGBA')
for k in ('badge', 'lid', 'cog'):
    im = Image.open(os.path.join(R, f'vessel-epic-{k}.webp')).convert('RGBA')
    w = round(off[k]['w'] / 100 * W); h = round(w * im.size[1] / im.size[0])
    out.alpha_composite(im.resize((w, h), Image.LANCZOS), (round(off[k]['x'] / 100 * W), round(off[k]['y'] / 100 * W)))
out = out.crop(out.getbbox())
s = max(out.size); sq = Image.new('RGBA', (s, s)); sq.alpha_composite(out, ((s - out.size[0]) // 2, (s - out.size[1]) // 2))
sq.resize((160, 160), Image.LANCZOS).save(os.path.join(R, 'vessel-icon.webp'), quality=90)
