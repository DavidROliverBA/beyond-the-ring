"""The Ring: a 1,000 km armoured hoop (the alien gate structure), built for assets/models/ring.glb.

Built at a major radius of 1 (the game scales it to the gate's radius), lying in the XY plane with its face
towards +Z, the way src/main.ts builds a gate. The swirling film that fills the middle is drawn by the game,
not modelled here. Everything is made of plates, ribs and fittings so it reads from far away as a thin lit
hoop and, close in, as a worked structure:

  core      one dark, continuous section: the hull the plates are laid on (the dark gaps are the panel lines)
  plates    armour on the outer rim and both flanks, staggered so the seams never line up, each bevelled and
            standing a little proud, with weld seams across the joints
  channel   a recessed track on each flank, lit by a ring of lamp strips
  ribs      24 heavy frames round the rim at the segment joints, each a bolted flange, two struts, a cross-beam
            and a diagonal, plus 24 lighter hoops between; a thin girder ring links the tops
  inner     the band that frames the film: machinery pods with lit tips, vents and clamps, a lamp lip
  towers    eight big junction blocks (they notch the silhouette from far away)

Run:  blender -b -P tools/blender/ring.py [-- --preview DIR] [--noao] [--nopack]
"""
import bpy, bmesh, sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, kit
importlib.reload(kit)
from kit import Ship, reset, bake_ao, weather, export, preview
from mathutils import Matrix, Vector, Euler

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TAU = math.tau
N = 72                      # plate slices round the hoop
DA = TAU / N
RIBS = 24                   # heavy ribs, one at every third slice joint
GAP = 0.0030                # radians left between plates: the panel lines
# local (x, y, z) with the hoop in XY and the face towards +z  ->  the kit's Blender axes (export turns Z up into Y up)
MAP = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0))).to_4x4()


def L(r, a, z):
    return Vector((r * math.cos(a), -z, r * math.sin(a)))


class Ring(Ship):
    def __init__(self):
        super().__init__('ring', 31)
        self.uv_scale = 0.1
        self.age = 1.25
        self.rnd = random.Random(31)

    # ---- helpers
    def prism(self, prof, a0, a1, m, wear=1, caps=True):
        """Sweep a (radius, z) polygon between two angles. Bevel faces are marked as scuffable edges."""
        bm = self.bm
        A = [[bm.verts.new(L(r, a, z)) for r, z in prof] for a in (a0, a1)]
        n = len(prof)
        faces = []
        for i in range(n):
            j = (i + 1) % n
            f = bm.faces.new((A[0][i], A[0][j], A[1][j], A[1][i]))
            f[self.wear] = wear if i else 0
            faces.append(f)
        if caps:
            for ring, rev in ((A[0], True), (A[1], False)):
                f = bm.faces.new(list(reversed(ring)) if rev else ring)
                f[self.wear] = 3
                faces.append(f)
        verts = [v for r_ in A for v in r_]
        fs = self._take(verts, m, recalc=True)
        return fs

    def revolve(self, prof, m, steps=N):
        """A continuous section all the way round, with shared corners."""
        bm = self.bm
        rows = [[bm.verts.new(L(r, TAU * k / steps, z)) for r, z in prof] for k in range(steps)]
        n = len(prof)
        for k in range(steps):
            for i in range(n):
                j = (i + 1) % n
                bm.faces.new((rows[k][i], rows[k][j], rows[(k + 1) % steps][j], rows[(k + 1) % steps][i]))
        return self._take([v for r_ in rows for v in r_], m, recalc=True)

    def lbox(self, sr, st, sz, r, a, z, m, spin=0.0):
        """A block at (radius, angle, z): sr along the radius, st along the rim, sz across."""
        rot = (MAP @ Matrix.Rotation(a + spin, 4, 'Z')).to_euler()
        return self.box(sr, st, sz, L(r, a, z), m, rot=rot)

    def lstrut(self, p, q, rad, m, segs=5):
        self.strut(L(*p), L(*q), rad, m, segs)

    @staticmethod
    def bev(r0, r1, z0, z1, c, out):
        """A plate section (r, z): a trapezoid, its outer face narrower than the base (a bevelled edge all round).
        out: 'r' (r1 side is the face), 'z' (z1 side), '-z' (z0 side), '-r' (r0 side)."""
        c = min(c, (r1 - r0) / 2.2, abs(z1 - z0) / 2.2)
        if out == 'r':
            return [(r0, z0), (r1, z0 + c), (r1, z1 - c), (r0, z1)]
        if out == '-r':
            return [(r1, z0), (r1, z1), (r0, z1 - c), (r0, z0 + c)]
        if out == 'z':
            return [(r0, z0), (r1, z0), (r1 - c, z1), (r0 + c, z1)]
        return [(r0 + c, z0), (r1 - c, z0), (r1, z1), (r0, z1)]


PLATE = ('hull2', 'hull2', 'hull2', 'gun', 'gun', 'dark', 'hull', 'belt2')
CORE_R0, CORE_R1, CORE_H = 0.93, 1.06, 0.05


def build():
    s = Ring()
    rnd = s.rnd

    # ---- core: dark hull with a recessed channel on each flank
    h, c = CORE_H, 0.016
    ch = 0.039  # the channel floor
    prof = [(CORE_R0, -h + c), (CORE_R0 + c, -h),
            (0.983, -h), (0.987, -ch), (1.003, -ch), (1.007, -h),
            (CORE_R1 - c, -h), (CORE_R1, -h + c),
            (CORE_R1, h - c), (CORE_R1 - c, h),
            (1.007, h), (1.003, ch), (0.987, ch), (0.983, h),
            (CORE_R0 + c, h), (CORE_R0, h - c)]
    s.revolve(prof, 'black')

    # ---- armour plates: rim (three z bands, the middle one staggered) and both flanks
    for k in range(N):
        a0 = k * DA
        for band, (z0, z1, off) in enumerate(((-0.036, -0.012, 0.0), (-0.012, 0.012, 0.5), (0.012, 0.036, 0.0))):
            a = a0 + off * DA
            d = rnd.choice((0.003, 0.004, 0.004, 0.0055))
            s.prism(Ring.bev(CORE_R1 - 0.0005, CORE_R1 + d, z0 + 0.0016, z1 - 0.0016, 0.0025, 'r'), a + GAP, a + DA - GAP, rnd.choice(PLATE))
        for side in (1, -1):
            zs = lambda lo, hi: (lo, hi) if side > 0 else (-hi, -lo)
            # inner flank annulus, one band; outer flank annulus, two bands (staggered)
            for (r0, r1, off) in ((0.9455, 0.9815, 0.0), (1.009, 1.0445, 0.5)):
                a = a0 + off * DA
                d = rnd.choice((0.002, 0.003, 0.004))
                z0, z1 = zs(h - 0.0005, h + d)
                s.prism(Ring.bev(r0 + 0.0016, r1 - 0.0016, z0, z1, 0.002, 'z' if side > 0 else '-z'), a + GAP, a + DA - GAP, rnd.choice(PLATE))
        # weld seams: slim bright-metal strips across the joints, on the rim
        if k % 3 == 0:
            s.prism(Ring.bev(CORE_R1 + 0.002, CORE_R1 + 0.0065, -0.036, 0.036, 0.001, 'r'), a0 - 0.0016, a0 + 0.0016, 'steel', wear=1)

    # ---- channel lamps: a dashed strip on the floor of each channel, and a glow slit at every rib joint
    for side in (1, -1):
        zf = ch if side > 0 else -ch
        for k in range(N):
            a = k * DA
            z0, z1 = (zf - 0.0005, zf + 0.0035) if side > 0 else (zf - 0.0035, zf + 0.0005)
            s.prism([(0.9895, z0), (1.0005, z0), (1.0005, z1), (0.9895, z1)], a + 0.012, a + DA - 0.012, 'glow', caps=False)
        # a light frame to each lamp strip
        for r in (0.9875, 1.0025):
            s.revolve([(r - 0.0013, zf - 0.001 * side), (r + 0.0013, zf - 0.001 * side), (r + 0.0013, zf + 0.0045 * side), (r - 0.0013, zf + 0.0045 * side)], 'steel', steps=N // 2)
    for k in range(RIBS):
        a = k * TAU / RIBS
        for side in (1, -1):
            z0, z1 = (h + 0.0045, h + 0.0062) if side > 0 else (-h - 0.0062, -h - 0.0045)
            s.prism([(1.009, z0), (1.0445, z0), (1.0445, z1), (1.009, z1)], a - 0.0011, a + 0.0011, 'glow', caps=False)

    # ---- heavy ribs and bolted flanges at every rib joint
    for k in range(RIBS):
        a = k * TAU / RIBS
        w = 0.0065
        # the flange: a collar round the whole section, proud of the plates
        s.prism(Ring.bev(CORE_R0 - 0.007, CORE_R1 + 0.021, -h - 0.011, h + 0.011, 0.006, 'r'), a - w, a + w, 'hull')
        # bolts in rows on both flanks and the rim
        for side in (1, -1):
            for r in (0.955, 1.04):
                for da in (-w * 0.55, w * 0.55):
                    p = L(r, a + da, side * (h + 0.0125))
                    s.strut(p, p + MAP.to_3x3() @ Vector((0, 0, side * 0.004)), 0.0034, 'steel', 4)
        # frame struts rising from the rim: two uprights, a cross-beam on top, a diagonal brace
        top = CORE_R1 + 0.082
        for zz in (-0.036, 0.036):
            s.prism(Ring.bev(CORE_R1 + 0.02, top, zz - 0.006, zz + 0.006, 0.002, 'r'), a - 0.0035, a + 0.0035, 'hull2')
        s.prism(Ring.bev(top - 0.007, top + 0.005, -0.043, 0.043, 0.002, 'r'), a - 0.0045, a + 0.0045, 'hull')
        s.lstrut((CORE_R1 + 0.022, a, -0.036), (top - 0.004, a, 0.036), 0.0042, 'dark')
        s.lstrut((CORE_R1 + 0.022, a, 0.036), (top - 0.004, a, -0.036), 0.0042, 'dark')
        s.lbox(0.014, 0.011, 0.03, top + 0.012, a, 0, 'hull2')       # a cap block: sensors, radiators
        s.lstrut((top + 0.017, a, -0.012), (top + 0.04, a, 0.0), 0.0022, 'steel', 4)
        s.lamp(L(top + 0.041, a, 0.0), 'glow', 0.0034)

    # lighter hoops between the heavy ribs
    for k in range(RIBS):
        a = (k + 0.5) * TAU / RIBS
        s.prism(Ring.bev(CORE_R1 + 0.004, CORE_R1 + 0.02, -0.046, 0.046, 0.003, 'r'), a - 0.0045, a + 0.0045, 'hull2')
        for zz in (-0.036, 0.0, 0.036):
            s.lstrut((CORE_R1 + 0.019, a, zz), (CORE_R1 + 0.032, a, zz), 0.0034, 'dark', 5)
        s.lamp(L(CORE_R1 + 0.034, a, 0.0), rnd.choice(('glow', 'glow', 'blue')), 0.0028)

    # a thin girder ring linking the tops of the heavy ribs, all the way round
    top = CORE_R1 + 0.082
    for k in range(N):
        a0 = k * DA
        s.prism([(top - 0.004, -0.0045), (top + 0.0015, -0.0045), (top + 0.0015, 0.0045), (top - 0.004, 0.0045)], a0, a0 + DA, 'dark', wear=3, caps=False)

    # ---- the eight towers: heavy junction blocks that notch the silhouette
    for k in range(8):
        a = (k + 0.25) * TAU / 8
        s.lbox(0.062, 0.05, 0.085, CORE_R1 + 0.045, a, 0, 'hull')
        s.lbox(0.04, 0.038, 0.095, CORE_R1 + 0.055, a, 0, 'gun')
        s.lbox(0.018, 0.058, 0.06, CORE_R1 + 0.092, a, 0, 'hull2')
        s.lbox(0.012, 0.01, 0.12, CORE_R1 + 0.103, a, 0, 'dark')
        for sg in (-1, 1):
            s.lamp(L(CORE_R1 + 0.108, a + sg * 0.012, 0.022), 'glow', 0.003)
            s.lbox(0.01, 0.016, 0.1, CORE_R1 + 0.03, a + sg * 0.025, 0, 'dark')
        for z in (-0.04, -0.02, 0.02, 0.04):
            s.lamp(L(CORE_R1 + 0.0765, a - 0.027, z), rnd.choice(('glow', 'blue')), 0.0022)
        s.vent(L(CORE_R1 + 0.077, a, 0), Vector((math.cos(a), 0, math.sin(a))) , 0.04, 0.05, n=5, m='hull2')

    # ---- the inner band: machinery round the opening, and the lamp lip the film sits against
    ri = CORE_R0
    s.revolve([(ri - 0.0075, -0.0042), (ri + 0.0005, -0.0042), (ri + 0.0005, 0.0042), (ri - 0.0075, 0.0042)], 'glow', steps=N)
    for k in range(N):
        a = k * DA
        for z0, z1 in ((-0.043, -0.007), (0.007, 0.043)):
            d = rnd.choice((0.003, 0.0045))
            s.prism(Ring.bev(ri - d, ri + 0.0008, z0 + 0.002, z1 - 0.002, 0.002, '-r'), a + GAP, a + DA - GAP, rnd.choice(PLATE))
    # emitter pods: a wedge of machinery every few degrees, its tip lit
    for k in range(36):
        a = (k + 0.5) * TAU / 36
        u = rnd.random()
        s.lbox(0.016, 0.026, 0.05, ri - 0.012, a, 0, rnd.choice(('gun', 'hull2', 'hull')))
        s.lbox(0.01, 0.016, 0.034, ri - 0.026, a, 0, 'dark')
        s.lbox(0.004, 0.012, 0.006, ri - 0.0325, a, 0, 'glow')
        if u < 0.35:
            s.vent(L(ri - 0.021, a, 0), Vector((-math.cos(a), 0, -math.sin(a))), 0.03, 0.04, n=4, m='hull2')
        elif u < 0.65:
            for sg in (-1, 1):
                s.lstrut((ri - 0.004, a + sg * 0.018, 0.032), (ri - 0.022, a + sg * 0.018, 0.032), 0.003, 'steel')
                s.lstrut((ri - 0.004, a + sg * 0.018, -0.032), (ri - 0.022, a + sg * 0.018, -0.032), 0.003, 'steel')
        for z in (-0.037, 0.037):
            s.lstrut((ri + 0.0008, a, z), (ri - 0.011, a, z), 0.003, 'dark')
    # service pipe runs circling the opening, with clamps
    for zp in (-0.027, 0.027):
        for k in range(N):
            if (k + (zp > 0)) % 6 == 0:
                continue
            s.prism([(ri - 0.0125, zp - 0.0028), (ri - 0.0075, zp - 0.0028), (ri - 0.0075, zp + 0.0028), (ri - 0.0125, zp + 0.0028)], k * DA + 0.003, (k + 1) * DA - 0.003, 'hull2', wear=2, caps=False)

    # a few big hatches and vents on the flanks, for scale
    for k in range(RIBS):
        a = (k + 0.5) * TAU / RIBS
        side = rnd.choice((1, -1))
        s.hatch(L(0.9635, a, side * (h + 0.0045)), Vector((0, 0, 0)) + MAP.to_3x3() @ Vector((0, 0, side)), 0.03, 0.02, m='hull2', along=MAP.to_3x3() @ Vector((-math.sin(a), math.cos(a), 0)))
    return s


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    reset()
    s = build()
    objs = s.finish()
    print('ring tris ~', sum(len(p.vertices) - 2 for o in objs for p in o.data.polygons))
    if '--noao' not in argv:
        w = bpy.data.worlds.new('ao')
        w.light_settings.distance = 0.09
        bpy.context.scene.world = w
        bake_ao(objs)
        weather(objs, s)
    path = os.path.join(ROOT, 'assets', 'models', 'ring.glb')
    export(path)
    if '--nopack' not in argv:
        import subprocess
        before = os.path.getsize(path)
        try:
            subprocess.run(['bunx', '@gltf-transform/cli@4.5.1', 'meshopt', path, path, '--level', 'high'], check=True, capture_output=True, timeout=300)
            print(f'packed ring.glb: {before // 1024} KB -> {os.path.getsize(path) // 1024} KB')
        except Exception as e:
            print('not packed:', e)
    if '--preview' in argv:
        out = argv[argv.index('--preview') + 1]
        os.makedirs(out, exist_ok=True)
        preview(os.path.join(out, 'ring'), views=((0.4, -4.2, 1.6), ((1.2, -1.0, 0.18), (1.0, 0.0, 0.0)), ((0.2, -0.9, 0.1), (0.0, -1.0, 0.0))), res=(1300, 760), samples=30)


main()
