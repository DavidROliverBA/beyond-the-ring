"""Bigger pieces of ship hardware, built from the kit's primitives: radiator panels, lattice girders,
gun turrets, sensor blisters, launcher banks, hangar mouths, cargo containers, folded landing legs.
Every function takes the Ship first and places things in ship space (nose +Y, up +Z).
Kept to boxes and 4 to 12 sided cylinders so a ship stays light enough for a crowd of them."""
import math
from mathutils import Vector, Matrix


def _along(v):
    return Vector(v).normalized().to_track_quat('Z', 'Y').to_euler()


def bar(s, a, b, r=0.0014, m='dark'):
    """A thin square-ish bar from a to b: no end caps, so about eight triangles."""
    a, b = Vector(a), Vector(b)
    d = b - a
    if d.length < 1e-6:
        return
    s.cyl(r, r, d.length, (a + b) / 2, m, segs=4, caps=False, rot=_along(d))


def panel(s, c, normal, along, w, L, t=0.0016, m='dark', rim='steel', ribs=3, cells=0):
    """A flat panel (radiator, solar vane, louvre): a slab `w` across and `L` along, a bright frame and cross ribs.
    `cells` adds thin lengthwise coolant lines."""
    q, x, y, z = s._frame_of(normal, along)
    e, c = q.to_euler(), Vector(c)
    s.box(w, L, t, c, m, rot=e)
    for sx in (-1, 1):
        s.box(t * 1.8, L, t * 2.2, c + x * sx * w / 2, rim, rot=e)
    for i in range(ribs + 1):
        s.box(w, t * 1.8, t * 2.0, c + y * L * (i / max(1, ribs) - 0.5), rim, rot=e)
    for i in range(cells):
        s.box(t * 0.9, L * 0.96, t * 1.5, c + x * w * ((i + 1) / (cells + 1) - 0.5), 'hull2', rot=e)


def radiator(s, root, out, along, n=3, w=0.05, L=0.1, pitch=0.03, normal=(0, 0, 1), tip_lamp=None, m='dark', rim='steel'):
    """A bank of `n` radiator panels reaching out from `root` along `out`, stacked `pitch` apart along `normal`,
    held on a boom at the outer end with a cross-brace. `along` is the direction each panel's width runs."""
    root, out, nrm = Vector(root), Vector(out).normalized(), Vector(normal).normalized()
    span = (n - 1) * pitch
    for i in range(n):
        o = nrm * (i * pitch - span / 2)
        panel(s, root + o + out * L / 2, nrm, out, w, L, m=m, rim=rim, ribs=3, cells=3)
    tip = root + out * L
    bar(s, tip - nrm * (span / 2 + 0.006), tip + nrm * (span / 2 + 0.006), 0.0025, 'hull2')
    bar(s, root - nrm * (span / 2 + 0.006), root + nrm * (span / 2 + 0.006), 0.0025, 'hull2')
    for sg in (-1, 1):
        d = Vector(along).normalized() * sg * w * 0.45
        bar(s, root + d, tip + d, 0.0012, 'hull2')
    if tip_lamp:
        s.lamp(tip + nrm * (span / 2 + 0.008), tip_lamp, 0.0035)


def girder(s, a, b, w, n, r=0.0013, m='dark'):
    """Open lattice mast or boom between any two points: four chords, rings and diagonal bracing."""
    a, b = Vector(a), Vector(b)
    d = (b - a).normalized()
    u = d.cross(Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))).normalized()
    v = d.cross(u)
    cs = [u * w + v * w, u * w - v * w, -u * w - v * w, -u * w + v * w]
    for c in cs:
        bar(s, a + c, b + c, r, m)
    for i in range(n + 1):
        p = a.lerp(b, i / n)
        for k in range(4):
            bar(s, p + cs[k], p + cs[(k + 1) % 4], r * 0.8, m)
            if i < n:
                bar(s, p + cs[k], a.lerp(b, (i + 1) / n) + cs[(k + 1) % 4], r * 0.7, m)


def turret(s, loc, up, fwd, r=0.012, L=0.03, barrels=2, m='gun'):
    """A gun turret: a ring on the hull, an angular housing, a mantlet and barrels with muzzle brakes."""
    q, x, y, z = s._frame_of(up, fwd)
    e, c = q.to_euler(), Vector(loc)
    s.cyl(r * 1.35, r * 1.2, r * 0.3, c + z * r * 0.15, 'hull2', segs=10, rot=e)
    s.box(r * 1.7, r * 1.6, r * 0.7, c + z * r * 0.62, m, rot=e)
    s.box(r * 1.1, r * 0.7, r * 0.45, c + z * r * 0.62 + y * r * 1.0, 'dark', rot=e)
    s.box(r * 0.5, r * 0.5, r * 0.18, c + z * r * 1.05 - y * r * 0.2, 'hull2', rot=e)
    ye = _along(y)
    for k in range(barrels):
        dx = (k - (barrels - 1) / 2) * r * 0.62
        o = c + z * r * 0.62 + x * dx
        s.cyl(r * 0.16, r * 0.16, L, o + y * (r * 1.2 + L / 2), 'dark', segs=6, rot=ye)
        s.cyl(r * 0.24, r * 0.24, r * 0.4, o + y * (r * 1.2 + L), 'hull2', segs=6, rot=ye)


def blister(s, loc, normal, r=0.01, m='dark', ring='hull2'):
    """A sensor dome: a flattened half-sphere on a collar."""
    n = Vector(normal).normalized()
    e = _along(n)
    c = Vector(loc)
    s.cyl(r * 1.25, r * 1.25, r * 0.22, c + n * r * 0.1, ring, segs=10, rot=e)
    s.ico(r, c + n * r * 0.2, m, sub=1, scale=(1, 1, 0.55), rot=e)


def launchers(s, loc, normal, along, cols, rows, pitch=0.012, size=0.008, m='dark', rim='hull2'):
    """A bank of square launcher hatches in a frame."""
    q, x, y, z = s._frame_of(normal, along)
    e, c = q.to_euler(), Vector(loc)
    s.box(cols * pitch + 0.004, rows * pitch + 0.004, size * 0.25, c + z * size * 0.1, rim, rot=e)
    for i in range(cols):
        for j in range(rows):
            p = c + x * (i - (cols - 1) / 2) * pitch + y * (j - (rows - 1) / 2) * pitch
            s.box(size, size, size * 0.3, p + z * size * 0.2, m, rot=e)
            s.box(size * 0.5, size * 0.5, size * 0.2, p + z * size * 0.32, rim, rot=e)


def hangar(s, loc, normal, along, w, h, depth=0.003, lit='blue'):
    """An open bay mouth: a dark frame, a lit pane inside it, a row of marker lights over it."""
    q, x, y, z = s._frame_of(normal, along)
    e, c = q.to_euler(), Vector(loc)
    s.box(w * 1.12, h * 1.25, depth, c + z * depth * 0.4, 'hull2', rot=e)
    s.box(w, h, depth, c + z * depth * 0.8, 'dark', rot=e)
    s.pane(c + z * depth * 1.4, z, w * 0.86, h * 0.7, m=lit, along=x, frame=None)
    s.windows(c + y * h * 0.8 - x * w * 0.4 + z * depth * 0.8, c + y * h * 0.8 + x * w * 0.4 + z * depth * 0.8, 5, z, s=0.0018, m=lit, skip=0)


def collar(s, y, R, segs=6, r=0.003, m='hull2', lamp=None, axis_sign=1):
    """A docking collar round the axis: a ring, clamps and, if asked, marker lights."""
    s.hoop(R, r * 1.2, r * 1.6, y, m, segs=24)
    for k in range(segs):
        a = k / segs * math.tau + 0.2
        s.box(r * 1.4, r * 4.2, r * 1.6, (math.cos(a) * (R + r * 1.3), y, math.sin(a) * (R + r * 1.3)), 'dark', rot=(0, -a, 0))
        if lamp and k % 2 == 0:
            s.lamp((math.cos(a) * (R + r * 2.4), y + r * 2.6 * axis_sign, math.sin(a) * (R + r * 2.4)), lamp, r * 0.5)


def container(s, c, size, m, out=(1, 1), ribs=5, door=0):
    """A shipping container: a corrugated box. `out` is which way is outward, so the
    ribs go on the faces that show (none touch the box corners: the baked shading is per corner). `door` is 1 or -1 for a door end."""
    sx, sy, sz = size
    cx, cy, cz = c
    s.box(sx, sy, sz, c, m)
    ox, oz = out
    for i in range(ribs):
        yy = cy + (i / (ribs - 1) - 0.5) * sy * 0.8
        s.box(0.0016, 0.0035, sz * 0.86, (cx + ox * (sx / 2 + 0.0006), yy, cz), 'belt2')
        s.box(sx * 0.86, 0.0035, 0.0016, (cx, yy, cz + oz * (sz / 2 + 0.0006)), 'belt2')
    if door:
        yy = cy + door * (sy / 2 + 0.0005)
        s.box(sx * 0.9, 0.0012, sz * 0.9, (cx, yy, cz), 'belt2')
        s.box(0.003, 0.002, sz * 0.8, (cx - sx * 0.12, yy + door * 0.001, cz), 'steel')
        s.box(0.003, 0.002, sz * 0.8, (cx + sx * 0.12, yy + door * 0.001, cz), 'steel')


def leg(s, hip, fold=(0, -1, 0), normal=(0, 0, -1), L=0.1, r=0.0045, pad=0.03, m='hull2'):
    """A landing leg folded flat against the hull: a bay, the hip joint, the upper leg and its piston
    lying along `fold` (away from the hip), and the lower leg turned back with its foot pad snug on the hull."""
    h = Vector(hip)
    q, x, y, z = s._frame_of(normal, fold)
    e = q.to_euler()
    s.box(pad * 1.9, L * 1.12, 0.0035, h + y * L * 0.52 + z * 0.0008, 'dark', rot=e)
    s.box(pad * 2.0, 0.006, 0.006, h - y * 0.004 + z * 0.002, m, rot=e)
    s.cyl(r * 1.7, r * 1.7, pad * 1.2, h + z * r * 1.3, m, segs=8, rot=_along(x))
    k = h + y * L * 0.9 + z * r * 1.6 + x * pad * 0.15
    bar(s, h + z * r * 1.6, k, r, 'steel')
    s.cyl(r * 1.4, r * 1.4, pad * 0.9, k, m, segs=8, rot=_along(x))
    bar(s, h + z * r * 1.6 - x * pad * 0.55, k - x * pad * 0.5 + z * 0.001, r * 0.55, 'steel')
    foot = h + y * L * 0.18 + z * r * 0.7 + x * pad * 0.15
    bar(s, k + z * r * 0.4, foot + z * r * 0.4, r * 0.8, m)
    s.box(pad, pad * 1.2, r * 0.9, foot + y * pad * 0.1 - z * r * 0.1, 'hull2', rot=e)
    s.box(pad * 0.7, pad * 0.8, r * 0.5, foot + y * pad * 0.1 + z * r * 0.5, 'yellow', rot=e)


def seam(s, a, b, normal, w=0.0012, m='dark', t=0.0006):
    """A thin dark panel line laid on a surface from a to b."""
    a, b = Vector(a), Vector(b)
    q, x, y, z = s._frame_of(normal, b - a)
    s.box(w, (b - a).length, t, (a + b) / 2 + z * t * 0.4, m, rot=q.to_euler())


def thrusters(s, loc, normal, size=0.006, n=2, along=(0, 1, 0)):
    """A cluster of manoeuvring thruster quads side by side."""
    q, x, y, z = s._frame_of(normal, along)
    for i in range(n):
        s.rcs(Vector(loc) + x * (i - (n - 1) / 2) * size * 2.6, normal, s=size)
