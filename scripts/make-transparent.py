#!/usr/bin/env python3
"""
Turn a paper sketch (dark ink on an off-white background) into a transparent
PNG by converting LUMINANCE TO ALPHA, so anti-aliased edges and soft pencil
shading survive and look right on any card colour (#fff, #f4f4f4, ...).

How it works
  1. L = luminance of every pixel (0 = black .. 255 = white).
  2. alpha = how dark the pixel is, remapped by a levels curve:
       L >= WHITE  -> alpha 0   (the near-white paper becomes fully clear)
       L <= BLACK  -> alpha 255 (the darkest ink is fully opaque)
       in between  -> linear, with a small toe so faint paper noise vanishes
  3. every pixel's colour is set to one dark INK colour; only alpha varies.
  Output is an 8-bit grey+alpha PNG ("LA"), at the original resolution, which
  is also smaller than RGBA.

Only use it for grayscale-ish sketches. Never run it on coloured artwork
(design previews, screenshots): it throws the colour away on purpose.

Usage
  python3 scripts/make-transparent.py                  # rebuild the images below
  python3 scripts/make-transparent.py SRC DEST [--white 245] [--black N] [--ink "#1c1c1c"]
  python3 scripts/make-transparent.py --preview DIR    # also write composites
                                                       # on #fff and #f4f4f4 for checking

Originals live in ./originals (outside src/, never shipped); results go to src/assets.
Requires Pillow (pip install pillow).
"""
import argparse
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGINALS = os.path.join(ROOT, "originals")
ASSETS = os.path.join(ROOT, "src", "assets")

# source (in originals/)  ->  destination (in src/assets/)  + per-image tuning
JOBS = [
    {"src": "9aee1.png", "dest": "about.png"},  # goldfish in a bag
    {"src": "917bf.png", "dest": "work.png"},  # row of small knights
    {"src": "4e5be.png", "dest": "4e5be.png"},  # arrows sketch ("In the age of AI.")
    {"src": "aa58f.png", "dest": "aa58f.png"},  # scribble ("Write it before you forget!")
]

DEFAULTS = {"white": 245, "black": None, "ink": "#1c1c1c", "toe": 0.04}


def hex_to_gray(hex_color: str) -> int:
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    r, g, b = (int(h[i : i + 2], 16) for i in (0, 2, 4))
    return round(0.299 * r + 0.587 * g + 0.114 * b)


def percentile_black(gray: Image.Image, pct: float = 0.002) -> int:
    """Darkest ink level: the value below which `pct` of the pixels fall."""
    hist = gray.histogram()
    total = sum(hist)
    acc = 0
    for v, n in enumerate(hist):
        acc += n
        if acc >= total * pct:
            return v
    return 0


def convert(src: str, dest: str, white=245, black=None, ink="#1c1c1c", toe=0.04):
    gray = Image.open(src).convert("L")
    if black is None:
        black = percentile_black(gray)
    black = min(black, white - 1)
    lut = []
    for v in range(256):
        t = (white - v) / (white - black)  # 0 at/above white, 1 at/below black
        t = max(0.0, min(1.0, t))
        t = max(0.0, (t - toe) / (1 - toe))  # drop faint paper noise
        lut.append(round(t * 255))
    alpha = gray.point(lut)
    out = Image.merge("LA", (Image.new("L", gray.size, hex_to_gray(ink)), alpha))
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    out.save(dest, "PNG", optimize=True)
    return black


def composite(png: str, bg: str) -> Image.Image:
    im = Image.open(png).convert("RGBA")
    base = Image.new("RGBA", im.size, bg)
    return Image.alpha_composite(base, im).convert("RGB")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src", nargs="?")
    ap.add_argument("dest", nargs="?")
    ap.add_argument("--white", type=int, default=DEFAULTS["white"], help="luminance at/above which pixels become fully transparent")
    ap.add_argument("--black", type=int, default=None, help="luminance at/below which pixels are fully opaque (default: auto)")
    ap.add_argument("--ink", default=DEFAULTS["ink"], help="ink colour of the result")
    ap.add_argument("--toe", type=float, default=DEFAULTS["toe"])
    ap.add_argument("--preview", metavar="DIR", help="also write composites on #fff and #f4f4f4")
    a = ap.parse_args()

    if a.src and a.dest:
        jobs = [{"src": a.src, "dest": a.dest}]
        resolve = lambda p: p
    elif a.src or a.dest:
        sys.exit("give both SRC and DEST, or neither")
    else:
        jobs = JOBS
        resolve = None

    for j in jobs:
        s = j["src"] if resolve else os.path.join(ORIGINALS, j["src"])
        d = j["dest"] if resolve else os.path.join(ASSETS, j["dest"])
        black = convert(s, d, white=j.get("white", a.white), black=j.get("black", a.black), ink=j.get("ink", a.ink), toe=a.toe)
        before, after = os.path.getsize(s) // 1024, os.path.getsize(d) // 1024
        print(f"{os.path.basename(s):12} -> {os.path.relpath(d, ROOT):22} {Image.open(d).size}  black={black:3}  {before} KB -> {after} KB")
        if a.preview:
            os.makedirs(a.preview, exist_ok=True)
            stem = os.path.splitext(os.path.basename(d))[0]
            for name, bg in (("white", "#ffffff"), ("gray", "#f4f4f4")):
                composite(d, bg).save(os.path.join(a.preview, f"{stem}-on-{name}.png"))


if __name__ == "__main__":
    main()
