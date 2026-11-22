"""Paints the textures every ship shares, from nothing but arithmetic (no downloads):

  assets/pbr/hull_color.jpg   paint wear: panel tones, dirt in the seams, drips, chipped edges
  assets/pbr/hull_normal.jpg  relief: seams, access hatches, vents, fasteners, micrometeorite pits
  assets/pbr/hull_rough.jpg   sheen: scuffs, dull dirt, polished fasteners
  assets/pbr/windows.jpg      a sheet of 32 small lit rooms seen through a window

The hull set tiles in both directions. The models' own plates are a metre or two across;
this adds the smaller things between them. The window sheet's first cell is plain white,
for lamps and for windows too small to need a room behind them.

Run:  blender -b -P tools/blender/hulltex.py
"""
import bpy, os, random
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'assets', 'pbr')
N = 1024


def save(name, rgb, quality=86):
    """Write an array (rows from the bottom up, values 0 to 1, already in the file's own encoding) as a JPEG."""
    h, w = rgb.shape[:2]
    if rgb.ndim == 2:
        rgb = np.repeat(rgb[:, :, None], 3, axis=2)
    px = np.ones((h, w, 4), np.float32)
    px[:, :, :3] = np.clip(rgb, 0, 1)
    img = bpy.data.images.new(name, w, h, alpha=False)
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = os.path.join(OUT, name)
    img.file_format = 'JPEG'
    img.save(quality=quality)
    print('wrote', name, os.path.getsize(img.filepath_raw) // 1024, 'KB')


def blur(a, r):
    """Soften, wrapping round the edges so the tile still repeats. Three box passes are near enough a Gaussian."""
    for _ in range(3):
        for ax in (0, 1):
            acc = np.zeros_like(a)
            for k in range(-r, r + 1):
                acc += np.roll(a, k, ax)
            a = acc / (2 * r + 1)
    return a


def noise(rng, cells, n=N):
    """Smooth random field that repeats: a coarse grid of random values, stretched and softened."""
    cy, cx = (cells, cells) if isinstance(cells, int) else cells
    g = rng.random((cy, cx)).astype(np.float32)
    big = np.kron(g, np.ones((n // cy, n // cx), np.float32))
    return blur(big, max(1, min(n // cy, n // cx) // 3))


def srgb(lin):
    return np.clip(lin, 0, 1) ** (1 / 2.2)


def hull():
    rnd = random.Random(4)
    rng = np.random.default_rng(4)
    H = np.zeros((N, N), np.float32)      # height
    seam = np.zeros((N, N), np.float32)   # 1 in the gaps between panels
    dark = np.zeros((N, N), np.float32)   # openings: vent slots, ports
    shiny = np.zeros((N, N), np.float32)  # bare fasteners and handles
    tone = np.ones((N, N), np.float32)    # each panel's own shade of paint
    rgh = np.zeros((N, N), np.float32)    # each panel's own sheen

    # Cut the tile into panels: keep halving the largest pieces, off-centre, until they are small.
    panels = []

    def cut(x0, y0, x1, y1, depth):
        w, h = x1 - x0, y1 - y0
        small = max(w, h) <= 128 or (max(w, h) <= 256 and rnd.random() < 0.35)
        if small or depth > 6:
            panels.append((x0, y0, x1, y1))
            return
        if w > h * 1.2 or (w > h * 0.8 and rnd.random() < 0.5):
            m = x0 + round(w * rnd.choice((0.33, 0.5, 0.5, 0.67)) / 16) * 16
            cut(x0, y0, m, y1, depth + 1), cut(m, y0, x1, y1, depth + 1)
        else:
            m = y0 + round(h * rnd.choice((0.33, 0.5, 0.5, 0.67)) / 16) * 16
            cut(x0, y0, x1, m, depth + 1), cut(x0, m, x1, y1, depth + 1)

    cut(0, 0, N, N, 0)

    def rect(a, x0, y0, x1, y1, v):
        a[max(y0, 0):y1, max(x0, 0):x1] = v

    def frame(a, x0, y0, x1, y1, t, v):
        """The outline of a rectangle, `t` thick."""
        rect(a, x0, y0, x1, y0 + t, v), rect(a, x0, y1 - t, x1, y1, v)
        rect(a, x0, y0, x0 + t, y1, v), rect(a, x1 - t, y0, x1, y1, v)

    def dot(a, cx, cy, r, v):
        yy, xx = np.ogrid[-r:r + 1, -r:r + 1]
        m = xx * xx + yy * yy <= r * r
        ys = (np.arange(cy - r, cy + r + 1) % N)[:, None]
        xs = (np.arange(cx - r, cx + r + 1) % N)[None, :]
        a[ys, xs] = np.where(m, v, a[ys, xs])

    for (x0, y0, x1, y1) in panels:
        w, h = x1 - x0, y1 - y0
        lift = 0 if rnd.random() < 0.4 else rnd.choice((0.12, 0.2, -0.12, -0.2, 0.3))
        rect(H, x0, y0, x1, y1, lift)
        rect(tone, x0, y0, x1, y1, rnd.uniform(0.84, 1.0) if rnd.random() < 0.85 else rnd.uniform(0.7, 0.8))
        rect(rgh, x0, y0, x1, y1, rnd.uniform(-0.09, 0.09))
        frame(seam, x0, y0, x1, y1, 2, 1)
        u = rnd.random()
        if u < 0.14 and min(w, h) >= 64:
            # Vent: a row of slots.
            across = w >= h
            m = 14
            n = int(((w if across else h) - 2 * m) / 12)
            for i in range(n):
                p = m + i * 12
                if across:
                    rect(dark, x0 + p, y0 + m, x0 + p + 6, y1 - m, 1)
                else:
                    rect(dark, x0 + m, y0 + p, x1 - m, y0 + p + 6, 1)
            frame(H, x0 + 8, y0 + 8, x1 - 8, y1 - 8, 3, lift + 0.35)
        elif u < 0.28 and min(w, h) >= 64:
            # Access hatch: its own seam, a bolt at each corner, a grab handle.
            m = 12
            frame(seam, x0 + m, y0 + m, x1 - m, y1 - m, 2, 1)
            rect(H, x0 + m, y0 + m, x1 - m, y1 - m, lift + 0.18)
            for (bx, by) in ((x0 + m + 7, y0 + m + 7), (x1 - m - 8, y0 + m + 7), (x0 + m + 7, y1 - m - 8), (x1 - m - 8, y1 - m - 8)):
                dot(H, bx, by, 3, lift + 0.7), dot(shiny, bx, by, 3, 1)
            cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
            rect(H, cx - 12, cy - 3, cx + 12, cy + 3, lift + 0.8), rect(shiny, cx - 12, cy - 3, cx + 12, cy + 3, 1)
        elif u < 0.56:
            # Fasteners all the way round.
            step = 24
            for x in range(x0 + 10, x1 - 6, step):
                for y in (y0 + 9, y1 - 10):
                    dot(H, x, y, 2, lift + 0.55), dot(shiny, x, y, 2, 1)
            for y in range(y0 + 10, y1 - 6, step):
                for x in (x0 + 9, x1 - 10):
                    dot(H, x, y, 2, lift + 0.55), dot(shiny, x, y, 2, 1)
        elif u < 0.64 and min(w, h) >= 64:
            # A raised equipment pad with a round port in it.
            m = min(w, h) // 4
            rect(H, x0 + m, y0 + m, x1 - m, y1 - m, lift + 0.5)
            cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
            dot(seam, cx, cy, min(w, h) // 8 + 2, 1), dot(seam, cx, cy, min(w, h) // 8, 0), dot(dark, cx, cy, min(w, h) // 8 - 3, 1)
        elif u < 0.72:
            # Stiffening ribs.
            across = rnd.random() < 0.5
            for p in range(16, (h if across else w) - 12, 20):
                if across:
                    rect(H, x0 + 10, y0 + p, x1 - 10, y0 + p + 5, lift + 0.4)
                else:
                    rect(H, x0 + p, y0 + 10, x0 + p + 5, y1 - 10, lift + 0.4)

    # Micrometeorite pitting: a scatter of tiny craters, each a sunk bowl with a raised lip and a speck of
    # bare metal at the bottom. Its own random stream, so the panels above come out exactly as before.
    prng = np.random.default_rng(77)
    pitted = np.zeros((N, N), np.float32)
    for i in range(420):
        cx, cy = int(prng.integers(0, N)), int(prng.integers(0, N))
        r = int(prng.choice((2, 2, 3, 3, 4, 6)))
        dot(H, cx, cy, r + 2, 0.18), dot(H, cx, cy, r, -0.55)   # lip, then bowl
        dot(shiny, cx, cy, max(1, r - 1), 1)
        dot(pitted, cx, cy, r, 1)
    pitted = blur(pitted, 1)

    H = H - seam * 0.9 - dark * 1.2
    Hs = blur(H, 1)
    # Slight buckling of the plates, and a fine grain.
    Hs += (noise(rng, 8) - 0.5) * 0.5 + (rng.random((N, N)).astype(np.float32) - 0.5) * 0.035

    # Relief: lean each point's normal away from the uphill side.
    k = 2.6
    dx = (np.roll(Hs, -1, 1) - np.roll(Hs, 1, 1)) * k
    dy = (np.roll(Hs, -1, 0) - np.roll(Hs, 1, 0)) * k
    ln = np.sqrt(dx * dx + dy * dy + 1)
    save('hull_normal.jpg', np.stack([-dx / ln * 0.5 + 0.5, -dy / ln * 0.5 + 0.5, 1 / ln * 0.5 + 0.5], axis=2), quality=90)

    # Dirt gathers in the seams, spreads a little, and drips one way from them and from the vents.
    src = np.clip(seam + dark, 0, 1)
    near = np.clip(blur(src, 4) * 2.2, 0, 1)
    drip = np.zeros((N, N), np.float32)
    acc = src * (noise(rng, 64) > 0.52)
    for i in range(90):
        acc = np.roll(acc, -1, 0) * 0.972
        drip = np.maximum(drip, acc)
    drip = blur(drip, 1) * (0.4 + 0.6 * noise(rng, (4, 128)))
    stain = noise(rng, 4) * 0.6 + noise(rng, 16) * 0.4
    dirt = np.clip(near * 0.42 + drip * 0.5 + np.clip(stain - 0.5, 0, 1) * 0.7, 0, 1)

    # Scuffs: fine scratches all one way, and paint chipped off beside the seams down to bright metal.
    scratch = noise(rng, (256, 8)) - 0.5
    speck = rng.random((N, N)).astype(np.float32)
    edge = np.clip(blur(seam, 3) * 3, 0, 1) * (1 - np.clip(blur(seam, 1) * 3, 0, 1))
    chips = ((edge * (noise(rng, 128) * 0.6 + noise(rng, 32) * 0.4)) > 0.2) & (noise(rng, 8) > 0.45)
    chips = blur(chips.astype(np.float32), 1)

    paint = tone * (1 - dirt * 0.55) * (0.97 + speck * 0.06) * (1 + scratch * 0.08) * 0.84
    paint = paint * (1 - seam * 0.5) * (1 - dark * 0.75)
    paint = paint * (1 - chips) + chips * 1.0
    paint = paint * (1 - shiny * 0.25) + shiny * 0.25
    paint = paint * (1 - pitted * 0.18)  # the bowls are a little darker round the bright core
    warm = dirt * 0.5 + near * 0.2  # dirt is brown, not grey
    col = np.stack([paint, paint * (1 - warm * 0.07), paint * (1 - warm * 0.16)], axis=2)
    save('hull_color.jpg', srgb(col), quality=84)

    rough = 0.6 + rgh + dirt * 0.3 + seam * 0.2 + scratch * 0.14 - chips * 0.28 - shiny * 0.25 + (speck - 0.5) * 0.05
    rough -= np.clip(noise(rng, 8) - 0.55, 0, 1) * 0.5  # places rubbed smooth
    save('hull_rough.jpg', np.clip(rough, 0.18, 1), quality=84)


def windows():
    """Eight by four small rooms. Each is seen face on: a lit wall, a ceiling strip, a floor,
    then whatever stands in the room. Some have the lights low and a few are dark."""
    C, cols, rows = 64, 8, 4
    rnd = random.Random(8)
    img = np.zeros((rows * C, cols * C, 3), np.float32)
    yy, xx = np.mgrid[0:C, 0:C].astype(np.float32)
    for i in range(cols * rows):
        cell = np.zeros((C, C, 3), np.float32)
        if i == 0:
            cell[:] = 1
        else:
            u = rnd.random()
            level = rnd.uniform(0.03, 0.1) if u < 0.14 else rnd.uniform(0.3, 0.5) if u < 0.36 else rnd.uniform(0.75, 1.0)
            tint = np.array(rnd.choice(((1, 0.95, 0.86), (1, 1, 1), (0.84, 0.93, 1), (1, 0.9, 0.78))), np.float32)
            wall = 0.55 + 0.3 * (yy / C)  # brighter towards the ceiling
            wall = np.where(yy < 15, 0.2 + yy * 0.012, wall)  # floor
            wall = np.where((yy > 50) & (yy < 57) & (np.abs(xx - 32) < rnd.choice((14, 22, 30))), 1.25, wall)  # ceiling light
            cell[:] = (wall * level)[:, :, None] * tint
            # A far doorway or locker bank.
            if rnd.random() < 0.6:
                x0 = rnd.randrange(6, 40)
                w = rnd.randrange(10, 20)
                m = (xx > x0) & (xx < x0 + w) & (yy > 14) & (yy < 44)
                cell[m] *= rnd.choice((0.55, 0.7, 1.25))
            # Bulkhead frames close to the glass.
            for _ in range(rnd.choice((0, 1, 1, 2))):
                x0 = rnd.randrange(0, 58)
                cell[:, x0:x0 + rnd.randrange(3, 8)] *= 0.25
            # A console: a low dark block with a coloured screen.
            if rnd.random() < 0.55:
                x0 = rnd.randrange(4, 40)
                cell[10:26, x0:x0 + 20] *= 0.3
                glow = np.array(rnd.choice(((0.3, 1, 0.9), (1, 0.6, 0.2), (0.4, 0.7, 1), (1, 0.3, 0.25))), np.float32)
                cell[18:24, x0 + 3:x0 + 17] = glow * max(level, 0.35) * 1.1
            # Somebody standing there.
            if level > 0.3 and rnd.random() < 0.3:
                px = rnd.randrange(12, 52)
                body = ((np.abs(xx - px) < 5.5) & (yy < 34)) | ((xx - px) ** 2 + (yy - 39) ** 2 < 16)
                cell[body] *= 0.12
            # The window's own frame, and sometimes a bar down the middle.
            edge = (xx < 3) | (xx > C - 4) | (yy < 3) | (yy > C - 4)
            cell[edge] *= 0.15
            if rnd.random() < 0.3:
                cell[:, 30:34] *= 0.15
        r, c = divmod(i, cols)
        img[(rows - 1 - r) * C:(rows - r) * C, c * C:(c + 1) * C] = cell
    save('windows.jpg', srgb(img), quality=88)


hull()
windows()
