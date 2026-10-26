"""clean_alpha.py — edge cleanup for painted, background-removed webp parts (wheel + gear canister).

  python -I scripts/art/clean_alpha.py public/wheel/rim.webp ...   (in place; prints what it changed)
  python -I scripts/art/clean_alpha.py --dry ...                    (report only)

Per asset:
  1. SPECKS  — alpha below 28 is background-removal noise → 0; then every disconnected island smaller than
               max(24 px, 0.25% of the biggest island), or hair-thin (≤4 px across), is dropped (stray streaks / dust under the art).
  2. DEFRINGE — a semi-transparent edge pixel takes the colour of its nearest OPAQUE neighbour when it is lighter
               than it (the white/grey halo a remove-bg pass leaves around a dark ink outline).
  3. EDGE    — alpha eroded 1 px where it is semi (the halo ring), then re-feathered with a 0.6 px blur clamped to the
               original alpha — a clean anti-aliased edge, never a fatter one.
Soft art (the glow fans) is skipped by the caller: its alpha IS the feather.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage


def clean(path, dry=False):
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3]
    before = al.copy()

    # 1. specks
    al[al < 28] = 0
    lab, n = ndimage.label(al > 0, structure=np.ones((3, 3)))
    dropped = 0
    if n > 1:
        sizes = ndimage.sum(np.ones_like(al), lab, index=np.arange(1, n + 1))
        floor = max(24, sizes.max() * 0.0025)
        thick = ndimage.maximum(ndimage.distance_transform_edt(al > 0), lab, index=np.arange(1, n + 1))
        for i, s in enumerate(sizes, start=1):
            # too small, or a hair-thin streak (never more than ~4 px across) that isn't the art itself
            if s < floor or (thick[i - 1] < 2.6 and s < sizes.max() * 0.05):
                al[lab == i] = 0
                dropped += 1

    # 2. defringe: nearest fully-opaque pixel's colour for lighter semi pixels
    opaque = al >= 250
    semi = (al > 0) & ~opaque
    if opaque.any():
        _, (iy, ix) = ndimage.distance_transform_edt(~opaque, return_indices=True)
        near = rgb[iy, ix]
        lum = lambda c: c[..., 0] * 0.299 + c[..., 1] * 0.587 + c[..., 2] * 0.114
        fix = semi & (lum(rgb) > lum(near) + 12)
        rgb[fix] = near[fix]
    else:
        fix = np.zeros_like(semi)

    # 3. edge: erode the semi ring 1px, re-feather (clamped to the original so the silhouette never grows)
    er = ndimage.grey_erosion(al, size=(3, 3))
    al2 = np.where(semi, er, al)
    soft = np.asarray(Image.fromarray(al2.astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))).astype(np.float32)
    al3 = np.where(opaque, al, np.minimum(al, soft))

    out = np.dstack([rgb, al3]).clip(0, 255).astype(np.uint8)
    changed = int((np.abs(out[..., 3].astype(int) - before.astype(int)) > 8).sum())
    print(f'{path}: islands dropped={dropped} defringed={int(fix.sum())} alpha px changed={changed}')
    if not dry:
        Image.fromarray(out, 'RGBA').save(path, 'WEBP', quality=92, method=6, alpha_quality=100)


if __name__ == '__main__':
    args = [x for x in sys.argv[1:] if x != '--dry']
    for p in args:
        clean(p, dry='--dry' in sys.argv)
