"""Hard-surface modelling kit for the ship models. Everything is built into one
bmesh per ship, nose towards +Y and up +Z, about one unit long, then baked
(ambient occlusion into vertex colours) and exported as GLB.

Run:  blender -b -P tools/blender/build.py -- <ship|all> [--preview DIR]
"""
import bpy, bmesh, math, os, random
import numpy as np
from mathutils import Matrix, Vector, Euler

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# name: (base colour, metallic, roughness, emission strength)
MATS = {
    'hull':    ((0.33, 0.35, 0.33), 0.5, 0.55, 0),
    'hull2':   ((0.24, 0.26, 0.25), 0.5, 0.6, 0),
    'trim':    ((0.62, 0.20, 0.10), 0.3, 0.6, 0),
    'dark':    ((0.06, 0.065, 0.07), 0.6, 0.5, 0),
    'pale':    ((0.72, 0.74, 0.76), 0.3, 0.55, 0),
    'yellow':  ((0.70, 0.52, 0.12), 0.3, 0.65, 0),
    'rust':    ((0.36, 0.22, 0.15), 0.3, 0.8, 0),
    'ice':     ((0.78, 0.88, 0.94), 0.0, 0.3, 0),
    'navy':    ((0.40, 0.46, 0.54), 0.5, 0.55, 0),
    'navy2':   ((0.24, 0.29, 0.36), 0.5, 0.6, 0),
    'belt':    ((0.48, 0.45, 0.40), 0.4, 0.7, 0),
    'belt2':   ((0.26, 0.24, 0.22), 0.4, 0.75, 0),
    'teal':    ((0.18, 0.34, 0.38), 0.3, 0.7, 0),
    'black':   ((0.022, 0.024, 0.028), 0.3, 0.35, 0),
    'gold':    ((0.62, 0.50, 0.26), 0.6, 0.5, 0),
    'rce':     ((0.10, 0.27, 0.52), 0.3, 0.55, 0),
    'steel':   ((0.50, 0.55, 0.60), 0.5, 0.45, 0),
    'orange':  ((0.72, 0.30, 0.09), 0.3, 0.55, 0),
    'window':  ((1.0, 0.86, 0.6), 0, 0.5, 4),
    'glow':    ((0.55, 0.82, 1.0), 0, 0.5, 6),
    'red':     ((1.0, 0.2, 0.15), 0, 0.5, 5),
    'green':   ((0.2, 1.0, 0.4), 0, 0.5, 5),
    'blue':    ((0.35, 0.6, 1.0), 0, 0.5, 5),
    'gun':     ((0.11, 0.12, 0.135), 0.55, 0.55, 0),
    'mred':    ((0.50, 0.06, 0.05), 0.3, 0.6, 0),
    'lgrey':   ((0.48, 0.50, 0.52), 0.4, 0.6, 0),
}
NAMES = list(MATS)
# Materials that glow. In the game they ignore light, and 'window' and 'blue' show the sheet of lit rooms.
LAMPS = ('window', 'glow', 'red', 'green', 'blue')
# The window sheet (assets/pbr/windows.jpg, made by hulltex.py): 8 by 4 rooms, the first one plain white.
ROOM_COLS, ROOM_ROWS = 8, 4
# Vertex colours carry weathering as a multiplier on the paint. Clean paint is stored at this level,
# which leaves room above it for scuffed edges to come out brighter than the paint (src/ships.ts scales it back).
CLEAN = 0.72


def catmull(p0, p1, p2, p3, t):
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)


def section_at(S, y, smooth=True):
    """The cross-section of a loft at `y`: (y, w, h, ct, cb, z). Sections run from nose (high y) to tail."""
    S = [tuple(s) + (0,) * (6 - len(s)) for s in S]
    k = 0
    while k < len(S) - 2 and y < S[k + 1][0]:
        k += 1
    p0, p1, p2, p3 = S[max(k - 1, 0)], S[k], S[k + 1], S[min(k + 2, len(S) - 1)]
    t = min(1, max(0, (p1[0] - y) / (p1[0] - p2[0])))
    if smooth:
        q = [catmull(p0[i], p1[i], p2[i], p3[i], t) for i in range(6)]
        q[1], q[2] = max(q[1], 1e-4), max(q[2], 1e-4)
        q[3], q[4] = max(q[3], 0), max(q[4], 0)
    else:
        q = [p1[i] + (p2[i] - p1[i]) * t for i in range(6)]
    q[0] = y
    return q


class Ship:
    def __init__(self, name, seed=1):
        self.name = name
        self.bm = bmesh.new()
        self.rng = random.Random(seed)
        self.empties = []  # (name, location, scale)
        self.node = self.bm.faces.layers.int.new('node')  # which moving part a face belongs to
        self.tmp = self.bm.faces.layers.int.new('tmp')  # made up front: adding a layer later invalidates face handles
        self.wear = self.bm.faces.layers.int.new('wear')  # 1: a raised plate's edge (scuffed), 2: a sunk plate's edge (dirty), 3: a seam
        self.room = self.bm.faces.layers.int.new('room')  # a window pane: which lit room shows through it (0: none)
        self.scorches = []  # (location, radius, strength): soot around drives and thrusters
        self.cur = 0
        self.nodes = ['body']
        self.uv_scale = 0.07  # how much hull one repeat of the shared hull texture covers
        self.age = 1.0  # how hard a life the paint has had (see weather)

    # ---- bookkeeping
    def part(self, name):
        """Faces made from now on belong to a separately animated node."""
        if name not in self.nodes:
            self.nodes.append(name)
        self.cur = self.nodes.index(name)

    def _take(self, verts, m, recalc=False):
        faces = list({f for v in verts for f in v.link_faces})
        mi = NAMES.index(m)
        for f in faces:
            f.material_index = mi
            f[self.node] = self.cur
            f.smooth = False
        if recalc:
            bmesh.ops.recalc_face_normals(self.bm, faces=faces)
        return faces

    def paint(self, faces, m):
        mi = NAMES.index(m)
        for f in faces:
            f.material_index = mi

    def empty(self, name, loc, scale=1.0):
        self.empties.append((name, Vector(loc), scale))
        if name.startswith('drive'):
            # A drive that burns leaves soot on whatever is near its mouth.
            self.scorches.append((Vector(loc) + Vector((0, scale * 0.6, 0)), scale * 3.4, 0.9))

    # ---- primitives
    def box(self, sx, sy, sz, loc, m='hull', rot=(0, 0, 0)):
        mat = Matrix.LocRotScale(Vector(loc), Euler(rot), Vector((sx, sy, sz)))
        r = bmesh.ops.create_cube(self.bm, size=1.0, matrix=mat)
        return self._take(r['verts'], m)

    def cyl(self, r_aft, r_fore, length, loc, m='hull', axis='Y', segs=16, caps=True, rot=None):
        e = rot if rot is not None else {'Y': (-math.pi / 2, 0, 0), 'X': (0, math.pi / 2, 0), 'Z': (0, 0, 0)}[axis]
        mat = Matrix.LocRotScale(Vector(loc), Euler(e), Vector((1, 1, 1)))
        r = bmesh.ops.create_cone(self.bm, cap_ends=caps, cap_tris=False, segments=segs, radius1=max(r_aft, 1e-5), radius2=max(r_fore, 1e-5), depth=length, matrix=mat)
        return self._take(r['verts'], m)

    def ball(self, r, loc, m='hull', scale=(1, 1, 1), u=12, v=8):
        mat = Matrix.LocRotScale(Vector(loc), Euler((0, 0, 0)), Vector(scale))
        res = bmesh.ops.create_uvsphere(self.bm, u_segments=u, v_segments=v, radius=r, matrix=mat)
        return self._take(res['verts'], m)

    def ico(self, r, loc, m='hull', sub=2, scale=(1, 1, 1), rot=(0, 0, 0)):
        mat = Matrix.LocRotScale(Vector(loc), Euler(rot), Vector(scale))
        res = bmesh.ops.create_icosphere(self.bm, subdivisions=sub, radius=r, matrix=mat)
        return self._take(res['verts'], m)

    def lathe(self, profile, loc, m='dark', segs=20, axis='Y'):
        """Solid of revolution. `profile` is a closed list of (radius, along)."""
        bm = self.bm
        rings = []
        for (r, a) in profile:
            ring = []
            for i in range(segs):
                t = i / segs * math.tau
                p = Vector((math.cos(t) * r, a, math.sin(t) * r)) if axis == 'Y' else Vector((math.cos(t) * r, math.sin(t) * r, a))
                ring.append(bm.verts.new(p + Vector(loc)))
            rings.append(ring)
        verts = [v for ring in rings for v in ring]
        n = len(rings)
        for k in range(n):
            a, b = rings[k], rings[(k + 1) % n]
            for i in range(segs):
                j = (i + 1) % segs
                try:
                    bm.faces.new((a[i], a[j], b[j], b[i]))
                except ValueError:
                    pass
        return self._take(verts, m, recalc=True)

    def loft(self, sections, m='hull', cell=0.03, smooth=True, matrix=None):
        """Skin a row of chamfered-rectangle cross-sections placed along Y.
        Each section: (y, half_width, half_height, chamfer_top, chamfer_bottom, z_offset).
        Returns (side_faces, cap_faces). Faces come out as a grid about `cell` across."""
        bm = self.bm
        S = [tuple(s) + (0,) * (6 - len(s)) for s in sections]

        def outline(w, h, ct, cb):
            ct = min(ct, w * 0.98, h * 0.98)
            cb = min(cb, w * 0.98, h * 0.98)
            return [(w - ct, h), (w, h - ct), (w, -(h - cb)), (w - cb, -h), (-(w - cb), -h), (-w, -(h - cb)), (-w, h - ct), (-(w - ct), h)]

        # how finely to cut each of the eight sides: from the longest it gets
        cuts = [0] * 8
        for s in S:
            o = outline(*s[1:5])
            for i in range(8):
                a, b = o[i], o[(i + 1) % 8]
                L = math.hypot(a[0] - b[0], a[1] - b[1])
                cuts[i] = max(cuts[i], 0 if L < 1e-5 else max(1, round(L / cell)))

        def ring_at(y, w, h, ct, cb, z):
            o = outline(w, h, ct, cb)
            pts = []
            for i in range(8):
                a, b = o[i], o[(i + 1) % 8]
                for k in range(cuts[i]):
                    t = k / cuts[i]
                    pts.append(Vector((a[0] + (b[0] - a[0]) * t, y, a[1] + (b[1] - a[1]) * t + z)))
            return pts

        rows = []
        for k in range(len(S) - 1):
            p1, p2 = S[k], S[k + 1]
            steps = max(1, round(abs(p2[0] - p1[0]) / cell))
            for j in range(steps):
                rows.append(section_at(S, p1[0] + (p2[0] - p1[0]) * j / steps, smooth))
        rows.append(list(S[-1]))
        M = matrix or Matrix.Identity(4)
        rings = [[bm.verts.new(M @ p) for p in ring_at(*q)] for q in rows]
        n = len(rings[0])
        side_verts = [v for r in rings for v in r]
        for a, b in zip(rings, rings[1:]):
            for i in range(n):
                j = (i + 1) % n
                bm.faces.new((a[i], a[j], b[j], b[i]))
        caps = [bm.faces.new(rings[0]), bm.faces.new(list(reversed(rings[-1])))]
        faces = self._take(side_verts, m, recalc=True)
        sides = [f for f in faces if f not in caps]
        return sides, caps

    # ---- surface detail
    def plate(self, faces, inset=0.003, depth=0.0016, merge=0.4, accents=None, flat=0.4):
        """Turn a grid of faces into hull plating: neighbours merge into larger plates,
        each plate gets a bevelled edge and sits a little proud of, or below, the hull."""
        bm, rng = self.bm, self.rng
        bm.normal_update()
        fs = set(faces)
        edges = [e for e in {e for f in fs for e in f.edges} if len(e.link_faces) == 2 and all(l in fs for l in e.link_faces)]
        edges.sort(key=lambda e: e.index)
        rng.shuffle(edges)
        used, todo = set(), []
        for e in edges:
            a, b = e.link_faces
            if a in used or b in used or a.material_index != b.material_index:
                continue
            if a.normal.dot(b.normal) > 0.9995 and rng.random() < merge:
                used.update((a, b))
                todo.append(e)
        tag = self.tmp
        for f in bm.faces:
            f[tag] = 1 if f in fs else 0
        if todo:
            bmesh.ops.dissolve_edges(bm, edges=todo, use_verts=False)
        plates = [f for f in bm.faces if f[tag] == 1]
        bmesh.ops.inset_individual(bm, faces=plates, thickness=inset, depth=0.0, use_even_offset=True)
        bm.normal_update()
        for f in plates:
            if not f.is_valid:
                continue
            u = rng.random()
            d = 0 if u < flat else depth * rng.choice((1, 1, -1, 1.8, -0.6))
            if d:
                n = f.normal.copy()
                for v in f.verts:
                    v.co += n * d
            # Remember the bevel round each plate: weather() scuffs or dirties it.
            for e in f.edges:
                for rim in e.link_faces:
                    if rim is not f:
                        rim[self.wear] = 1 if d > 0 else 2 if d < 0 else 3
            if accents:
                for name, p in accents:
                    if rng.random() < p:
                        f.material_index = NAMES.index(name)
                        break
        return plates

    # ---- ship furniture
    def pdc(self, loc, up=1, s=0.012):
        """Point-defence cannon: plinth, drum and twin barrels."""
        x, y, z = loc
        self.cyl(s * 1.25, s * 1.25, s * 0.5, (x, y, z + up * s * 0.25), 'hull2', axis='Z', segs=12)
        self.ball(s * 0.95, (x, y, z + up * s * 0.7), 'dark', scale=(1, 1, 0.8), u=12, v=6)
        for dx in (-0.3, 0.3):
            self.cyl(s * 0.13, s * 0.13, s * 2.2, (x + dx * s, y + s * 1.3, z + up * s * 0.9), 'dark', segs=6)
        self.box(s * 0.9, s * 0.5, s * 0.35, (x, y + s * 0.5, z + up * s * 0.9), 'dark')

    def rcs(self, loc, normal, s=0.008):
        """Manoeuvring thruster quad on a hull face with the given outward normal."""
        n = Vector(normal).normalized()
        q = n.to_track_quat('Z', 'Y').to_euler()
        c = Vector(loc)
        self.box(s * 2.2, s * 2.2, s, c + n * s * 0.4, 'hull2', rot=q)
        self.scorches.append((c, s * 4.5, 0.55))
        for a in range(4):
            d = Vector((math.cos(a * math.pi / 2), math.sin(a * math.pi / 2), 0.25)) * s * 1.1
            d.rotate(q)
            self.cyl(s * 0.28, s * 0.5, s * 0.9, c + n * s * 0.9 + d, 'dark', segs=8, rot=d.normalized().to_track_quat('Z', 'Y').to_euler())

    def bell(self, r, loc, glow='glow', name=None, m='dark', length=None, axis='Y'):
        """Drive bell opening aft (towards −Y, or −Z for a station), with a lit throat."""
        L = length or r * 1.25
        x, y, z = loc
        prof = [(r * 0.42, 0), (r * 0.62, -L * 0.3), (r * 0.86, -L * 0.65), (r, -L), (r * 0.93, -L), (r * 0.8, -L * 0.65), (r * 0.56, -L * 0.3), (r * 0.36, -L * 0.04)]
        self.lathe(prof, loc, m, segs=24, axis=axis)
        if axis == 'Y':
            for k in range(8):  # stiffening ribs
                a = k / 8 * math.tau
                self.box(r * 0.05, L * 0.8, r * 0.1, (x + math.cos(a) * r * 0.72, y - L * 0.45, z + math.sin(a) * r * 0.72), 'hull2', rot=(0.33, -a + math.pi / 2, 0))
            self.cyl(r * 0.5, r * 0.5, 0.0005, (x, y - L * 0.25, z), glow, segs=20)
            self.empty(name or f'drive{len(self.empties)}', (x, y - L, z), r)
        else:
            self.cyl(r * 0.5, r * 0.5, 0.0005, (x, y, z - L * 0.25), glow, segs=20, axis='Z')
            self.scorches.append((Vector((x, y, z - L * 0.5)), r * 3.2, 0.9))

    def jitter(self, faces, amount):
        """Knock the corners about, for ice and rock."""
        for v in {v for f in faces for v in f.verts}:
            v.co += Vector((self.rng.uniform(-1, 1), self.rng.uniform(-1, 1), self.rng.uniform(-1, 1))) * amount

    def hoop(self, R, half_r, half_a, at, m='hull2', segs=48, axis='Y'):
        """A ring of rectangular section around the axis, centred at `at` along it."""
        prof = [(R - half_r, at - half_a), (R + half_r, at - half_a), (R + half_r, at + half_a), (R - half_r, at + half_a)]
        return self.lathe(prof, (0, 0, 0), m, segs=segs, axis=axis)

    def pane(self, loc, normal, w, h, m='window', room=None, frame='dark', along=None):
        """One window: a dark frame standing a little proud of the hull, and inside it a pane
        showing one of the lit rooms on the window sheet. `along` is the direction the pane's width runs."""
        nv = Vector(normal).normalized()
        q = nv.to_track_quat('Z', 'Y')
        if along is not None:
            # Turn about the normal until local X lies along the asked direction.
            x = q @ Vector((1, 0, 0))
            t = Vector(along) - nv * Vector(along).dot(nv)
            if t.length > 1e-6:
                t.normalize()
                q = Matrix.Rotation(math.atan2(x.cross(t).dot(nv), x.dot(t)), 4, nv).to_quaternion() @ q
        # Keep the room the right way up: its top towards the ship's top, or towards the nose on a roof.
        up = q @ Vector((0, 1, 0))
        if (up.z if abs(up.z) > 0.3 else up.y) < 0:
            q = Matrix.Rotation(math.pi, 4, nv).to_quaternion() @ q
        c = Vector(loc)
        d = min(w, h) * 0.3
        M = Matrix.LocRotScale(c, q, Vector((1, 1, 1)))
        if frame:
            self.box(w * 1.22, h * 1.3, d, c, frame, rot=q.to_euler())
        vs = [self.bm.verts.new(M @ Vector((sx * w / 2, sy * h / 2, d * 0.62))) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        f = self.bm.faces.new(vs)
        f.material_index = NAMES.index(m)
        f[self.node] = self.cur
        f[self.room] = room if room is not None else self.rng.randrange(1, ROOM_COLS * ROOM_ROWS)
        return f

    def windows(self, a, b, n, normal, s=0.0035, m='window', skip=0.25, tall=1.0):
        """A row of windows from a to b. A quarter are left out; of the rest, some rooms are dim or dark."""
        a, b = Vector(a), Vector(b)
        run = (b - a) if (b - a).length > 1e-6 else None
        for i in range(n):
            if self.rng.random() < skip:
                continue
            self.pane(a.lerp(b, i / max(1, n - 1)), normal, s * 1.6, s * tall, m, along=run)

    # ---- small hardware, for the places people get close to
    def _frame_of(self, normal, along=None):
        """Axes for something lying on a surface: x across, y along, z out."""
        z = Vector(normal).normalized()
        y = Vector(along) if along is not None else Vector((0, 1, 0))
        y = y - z * y.dot(z)
        if y.length < 1e-5:
            y = Vector((1, 0, 0)) - z * z.x
        y.normalize()
        x = y.cross(z)
        return Matrix((x, y, z)).transposed().to_quaternion(), x, y, z

    def hatch(self, loc, normal, w, h, m='hull2', along=None, lit=False):
        """An airlock or access door: a raised coaming, the door set into it, a grab bar, and a small window if `lit`."""
        q, x, y, z = self._frame_of(normal, along)
        c, e = Vector(loc), q.to_euler()
        t = min(w, h) * 0.12
        self.box(w, h, t, c + z * t * 0.3, m, rot=e)
        self.box(w * 0.8, h * 0.84, t, c + z * t * 0.55, 'dark', rot=e)
        self.box(w * 0.72, h * 0.76, t, c + z * t * 0.75, m, rot=e)
        self.box(w * 0.07, h * 0.4, t * 0.5, c + z * t * 1.5 + x * w * 0.24, 'steel', rot=e)
        if lit:
            self.pane(c + z * t * 1.2 - x * w * 0.08 + y * h * 0.14, z, w * 0.24, h * 0.2, along=x, frame=None)

    def vent(self, loc, normal, w, h, n=5, m='hull2', along=None):
        """A louvred grille."""
        q, x, y, z = self._frame_of(normal, along)
        c, e = Vector(loc), q.to_euler()
        t = min(w, h) * 0.1
        self.box(w, h, t, c + z * t * 0.3, m, rot=e)
        self.box(w * 0.86, h * 0.86, t, c + z * t * 0.45, 'black', rot=e)
        slat = Matrix.Rotation(0.5, 4, x).to_quaternion() @ q
        for i in range(n):
            self.box(w * 0.84, h * 0.8 / n * 0.7, t * 0.35, c + z * t * 0.95 + y * h * 0.8 * ((i + 0.5) / n - 0.5), m, rot=slat.to_euler())

    def pipe(self, pts, r=0.0018, m='hull2', clamps=True):
        """A run of pipe through the given points, with a collar at each bend."""
        pts = [Vector(p) for p in pts]
        for a, b in zip(pts, pts[1:]):
            self.strut(a, b, r, m, segs=6)
        if clamps:
            for p in pts:
                self.ico(r * 1.5, p, 'dark', sub=1)

    def rungs(self, a, b, normal, n=5, w=0.006, r=0.0006, m='steel'):
        """A ladder of grab rungs from a to b on a surface."""
        a, b, z = Vector(a), Vector(b), Vector(normal).normalized()
        x = (b - a).normalized().cross(z)
        for i in range(n):
            p = a.lerp(b, i / max(1, n - 1)) + z * r * 3
            self.strut(p - x * w / 2, p + x * w / 2, r, m, segs=4)
            for sx in (-1, 1):
                self.strut(p + x * sx * w / 2, p + x * sx * w / 2 - z * r * 3, r, m, segs=4)

    def greeble(self, plates, p=0.12, m=('hull2', 'dark'), size=1.0, keep=lambda c, n: True):
        """Scatter small fittings over hull plates: equipment boxes, grilles, hatches, tanks and pipe stubs.
        Each sits on its plate's centre, facing out, and is sized to the plate."""
        bm, rng = self.bm, self.rng
        bm.normal_update()
        for f in [f for f in plates if f.is_valid]:
            if rng.random() >= p:
                continue
            c, n = f.calc_center_median(), f.normal.copy()
            if not keep(c, n):
                continue
            # The plate's own rectangle: along its longest edge, and across.
            e = max(f.edges, key=lambda e: e.calc_length())
            da = (e.verts[1].co - e.verts[0].co).normalized()
            q, x, y, z = self._frame_of(n, da)
            us, vs = [v.co.dot(x) for v in f.verts], [v.co.dot(y) for v in f.verts]
            lb, la = max(us) - min(us), max(vs) - min(vs)
            if min(la, lb) < 0.008 * size:
                continue
            c = c + x * ((max(us) + min(us)) / 2 - c.dot(x)) + y * ((max(vs) + min(vs)) / 2 - c.dot(y))
            w, h = lb * 0.66, la * 0.66
            u, mat = rng.random(), rng.choice(m)
            q, x, y, z = self._frame_of(n, da)
            if u < 0.3:
                # Equipment boxes, one or two, different heights.
                t = min(w, h) * rng.uniform(0.2, 0.5)
                self.box(w * rng.uniform(0.5, 1), h * rng.uniform(0.5, 1), t, c + n * t * 0.45, mat, rot=q.to_euler())
                if rng.random() < 0.5:
                    self.box(w * 0.3, h * 0.3, t * 1.6, c + n * t * 0.8 + x * w * rng.uniform(-0.2, 0.2), 'dark', rot=q.to_euler())
            elif u < 0.5:
                self.vent(c, n, w, h, n=rng.choice((3, 4, 5)), m=mat, along=da)
            elif u < 0.68:
                self.hatch(c, n, w * 0.9, h * 0.9, m=mat, along=da)
            elif u < 0.84:
                # A tank lying along the plate, strapped down.
                r = min(w, h) * 0.22
                self.cyl(r, r, max(w, h) * 0.8, c + n * r * 0.7, 'pale' if rng.random() < 0.4 else mat, segs=8, rot=(da if la >= lb else x).to_track_quat('Z', 'Y').to_euler())
            else:
                # Pipes crossing the plate.
                for k in (-0.25, 0.0, 0.25)[:rng.choice((1, 2, 3))]:
                    o = c + x * w * k + n * min(w, h) * 0.06
                    self.strut(o - y * h * 0.75, o + y * h * 0.75, min(w, h) * 0.05, mat, segs=5)

    def lamp(self, loc, m='red', s=0.004):
        self.ico(s, loc, m, sub=1)

    def mast(self, loc, length, r=0.0015, axis=(0, 0, 1), m='dark'):
        d = Vector(axis).normalized()
        self.cyl(r, r * 0.6, length, Vector(loc) + d * length / 2, m, segs=6, rot=d.to_track_quat('Z', 'Y').to_euler())

    def dish(self, loc, r, aim=(0, 0, 1), m='pale'):
        d = Vector(aim).normalized()
        q = d.to_track_quat('Y', 'Z').to_euler()
        M = Matrix.LocRotScale(Vector(loc), q, Vector((1, 1, 1)))
        prof = [(0.02 * r, 0), (r * 0.5, r * 0.1), (r * 0.85, r * 0.26), (r, r * 0.4), (r * 0.98, r * 0.42), (r * 0.82, r * 0.3), (r * 0.48, r * 0.14), (0.02 * r, r * 0.05)]
        before = set(self.bm.verts)
        self.lathe(prof, (0, 0, 0), m, segs=18)
        new = [v for v in self.bm.verts if v not in before]
        bmesh.ops.transform(self.bm, matrix=M, verts=new)
        self.mast(Vector(loc) - d * r * 0.3, r * 0.3, r=r * 0.06, axis=d)
        self.mast(Vector(loc), r * 0.5, r=r * 0.03, axis=d)

    def truss(self, a, b, w, n, r=0.0018, m='dark'):
        """Open lattice girder from a to b (both on the Y axis line), square section of half-width w."""
        a, b = Vector(a), Vector(b)
        corners = [Vector((sx * w, 0, sz * w)) for sx, sz in ((1, 1), (1, -1), (-1, -1), (-1, 1))]
        L = (b - a).length
        for c in corners:
            self.cyl(r, r, L, (a + b) / 2 + c, m, segs=5)
        for i in range(n + 1):
            y = a.lerp(b, i / n)
            for k in range(4):
                p, q = corners[k], corners[(k + 1) % 4]
                self.strut(y + p, y + q, r * 0.8, m)
                if i < n:
                    self.strut(y + p, a.lerp(b, (i + 1) / n) + q, r * 0.7, m)

    def strut(self, a, b, r=0.0015, m='dark', segs=5):
        a, b = Vector(a), Vector(b)
        d = b - a
        if d.length < 1e-6:
            return
        self.cyl(r, r, d.length, (a + b) / 2, m, segs=segs, rot=d.normalized().to_track_quat('Z', 'Y').to_euler())

    # ---- output
    def finish(self):
        uv_scale = self.uv_scale
        bm = self.bm
        bm.normal_update()
        uv = bm.loops.layers.uv.new('UVMap')
        lamps = {NAMES.index(n) for n in LAMPS}
        for f in bm.faces:
            if f[self.room]:
                # A window pane: its four corners take one room of the window sheet.
                col, row = f[self.room] % ROOM_COLS, f[self.room] // ROOM_COLS
                for l, (cu, cv) in zip(f.loops, ((0.04, 0.04), (0.96, 0.04), (0.96, 0.96), (0.04, 0.96))):
                    l[uv].uv = ((col + cu) / ROOM_COLS, 1 - (row + 1 - cv) / ROOM_ROWS)
                continue
            if f.material_index in lamps:
                # Any other light is plain: the middle of the sheet's white first cell.
                for l in f.loops:
                    l[uv].uv = (0.5 / ROOM_COLS, 1 - 0.5 / ROOM_ROWS)
                continue
            n = f.normal
            ax = max(range(3), key=lambda i: abs(n[i]))
            i, j = [(1, 2), (0, 2), (0, 1)][ax]
            for l in f.loops:
                l[uv].uv = (l.vert.co[i] / uv_scale, l.vert.co[j] / uv_scale)
        objs = []
        for ni, nname in enumerate(self.nodes):
            part = bm.copy()
            lay = part.faces.layers.int.get('node')
            bmesh.ops.delete(part, geom=[f for f in part.faces if f[lay] != ni], context='FACES')
            if not part.faces:
                part.free()
                continue
            me = bpy.data.meshes.new(f'{self.name}_{nname}')
            part.to_mesh(me)
            part.free()
            for name in NAMES:
                me.materials.append(material(name))
            ob = bpy.data.objects.new(nname, me)
            bpy.context.scene.collection.objects.link(ob)
            objs.append(ob)
        for name, loc, scale in self.empties:
            e = bpy.data.objects.new(name, None)
            e.location = loc
            e.scale = (scale, scale, scale)
            bpy.context.scene.collection.objects.link(e)
        bm.free()
        return objs


_mat_cache = {}


def material(name):
    if name in _mat_cache:
        return _mat_cache[name]
    col, metal, rough, emit = MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = (*col, 1)
        b.inputs['Emission Strength'].default_value = emit
    _mat_cache[name] = m
    return m


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mat_cache.clear()


def bake_ao(objs, samples=24):
    """Ambient occlusion into per-corner vertex colours: grime in the grooves for free."""
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    for ob in objs:
        me = ob.data
        attr = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
        me.color_attributes.active_color = attr
        me.color_attributes.render_color_index = me.color_attributes.find('Col')
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objs:
        ob.select_set(True)
    for ob in objs:
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.select_all(action='DESELECT')
        ob.select_set(True)
        bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')


def _noise(p, freq, seed=0):
    """A smooth random value, 0 to 1, for each point in `p`: random numbers on a grid, blended between."""
    q = p * np.asarray(freq, np.float64) + 1000.0
    i = np.floor(q).astype(np.int64)
    f = q - i
    f = f * f * (3 - 2 * f)

    def h(dx, dy, dz):
        n = ((i[:, 0] + dx) * 374761393 + (i[:, 1] + dy) * 668265263 + (i[:, 2] + dz) * 1440662683 + seed * 974711) & 0xffffffff
        n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
        return ((n ^ (n >> 16)) & 0xffff) / 65535.0

    def mix(a, b, t):
        return a + (b - a) * t

    x0 = mix(mix(h(0, 0, 0), h(1, 0, 0), f[:, 0]), mix(h(0, 1, 0), h(1, 1, 0), f[:, 0]), f[:, 1])
    x1 = mix(mix(h(0, 0, 1), h(1, 0, 1), f[:, 0]), mix(h(0, 1, 1), h(1, 1, 1), f[:, 0]), f[:, 1])
    return mix(x0, x1, f[:, 2])


def weather(objs, ship):
    """Age the paint. bake_ao() has left plain shadow in the vertex colours; this turns it into wear:
    every plate its own shade, stains and streaks, brown dirt where the shadow is deep, bright scuffed
    metal on the edges of raised plates, dirt round sunk ones, and soot round drives and thrusters."""
    plain = [NAMES.index(n) for n in LAMPS + ('ice',)]
    amount = ship.age
    for ob in objs:
        me = ob.data
        nl, npoly = len(me.loops), len(me.polygons)
        attr = me.color_attributes['Col']
        col = np.zeros(nl * 4, np.float32)
        attr.data.foreach_get('color', col)
        ao = np.clip(col.reshape(nl, 4)[:, 0], 0, 1)
        vi = np.zeros(nl, np.int32)
        me.loops.foreach_get('vertex_index', vi)
        co = np.zeros(len(me.vertices) * 3, np.float32)
        me.vertices.foreach_get('co', co)
        p = co.reshape(-1, 3)[vi].astype(np.float64)
        total = np.zeros(npoly, np.int32)
        me.polygons.foreach_get('loop_total', total)
        poly = np.repeat(np.arange(npoly), total)
        mat = np.zeros(npoly, np.int32)
        me.polygons.foreach_get('material_index', mat)
        wear = np.zeros(npoly, np.int32)
        me.attributes['wear'].data.foreach_get('value', wear)
        mat, wear = mat[poly], wear[poly]

        shade = CLEAN * (1 + (np.random.default_rng(3).random(npoly)[poly] - 0.5) * 0.2 * amount)
        stain = _noise(p, 7, 1) * 0.6 + _noise(p, 23, 2) * 0.4
        shade *= 1 - 0.3 * amount * np.clip((stain - 0.45) * 2.5, 0, 1)
        streak = _noise(p, (38, 3, 38), 3)  # long marks running fore and aft
        shade *= 1 - 0.2 * amount * np.clip((streak - 0.55) * 4, 0, 1)
        dirt = np.clip((1 - ao) * 1.8, 0, 1)[:, None] * amount
        rgb = (shade * ao ** 1.4)[:, None] * (1 + (np.array([0.80, 0.71, 0.60]) - 1) * dirt)

        chipped = (wear == 1) & (_noise(p, 150, 4) > 0.42) & (stain > 0.3)
        rgb[chipped] = np.maximum(rgb[chipped], (0.97 * ao[chipped] ** 0.7)[:, None])
        rgb[wear == 2] *= 0.55
        rgb[wear == 3] *= 0.8

        soot = np.zeros(nl)
        for loc, r, k in ship.scorches:
            d = np.linalg.norm(p - np.array(loc), axis=1)
            soot = np.maximum(soot, k * np.clip((r - d) / (r * 0.75), 0, 1) ** 1.5)
        soot = (soot * (0.55 + 0.45 * _noise(p, 55, 5)) * amount)[:, None]
        heat = np.clip(1 - np.abs(soot - 0.3) / 0.25, 0, 1)  # a bronze ring where the metal got hot but not sooty
        rgb *= 1 + (np.array([1.0, 0.8, 0.58]) - 1) * heat
        rgb = rgb * (1 - soot) + soot * np.array([0.085, 0.072, 0.064]) * ao[:, None]

        keep = np.isin(mat, plain)
        rgb[keep] = (ao[keep] * CLEAN)[:, None]
        out = np.ones((nl, 4), np.float32)
        out[:, :3] = np.clip(rgb, 0, 1)
        attr.data.foreach_set('color', out.ravel())
        me.update()


def dress():
    """For the preview stills only (after export): wire the weathering and the shared hull and window
    textures into the materials, the way src/ships.ts does in the game."""
    def image(name, data):
        img = bpy.data.images.load(os.path.join(ROOT, 'assets', 'pbr', name), check_existing=True)
        if data:
            img.colorspace_settings.name = 'Non-Color'
        return img

    for name, m in _mat_cache.items():
        nt = m.node_tree
        b = nt.nodes.get('Principled BSDF')

        def tex(file, data=False):
            t = nt.nodes.new('ShaderNodeTexImage')
            t.image = image(file, data)
            return t

        def times(a, b_):
            mx = nt.nodes.new('ShaderNodeMix')
            mx.data_type, mx.blend_type = 'RGBA', 'MULTIPLY'
            mx.inputs[0].default_value = 1
            for sock, v in ((mx.inputs[6], a), (mx.inputs[7], b_)):
                if isinstance(v, tuple):
                    sock.default_value = v
                else:
                    nt.links.new(v, sock)
            return mx.outputs[2]

        col = MATS[name][0]
        if name in LAMPS:
            if name in ('window', 'blue'):
                nt.links.new(times(tex('windows.jpg').outputs[0], (*col, 1)), b.inputs['Emission Color'])
            continue
        vc = nt.nodes.new('ShaderNodeVertexColor')
        vc.layer_name = 'Col'
        worn = times(vc.outputs[0], tuple(c / CLEAN for c in col) + (1,))
        if name == 'ice':
            nt.links.new(worn, b.inputs['Base Color'])
            continue
        nt.links.new(times(worn, tex('hull_color.jpg').outputs[0]), b.inputs['Base Color'])
        nt.links.new(tex('hull_rough.jpg', True).outputs[0], b.inputs['Roughness'])
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nm.inputs['Strength'].default_value = 0.8
        nt.links.new(tex('hull_normal.jpg', True).outputs[0], nm.inputs['Color'])
        nt.links.new(nm.outputs[0], b.inputs['Normal'])


def export(path):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_yup=True, export_apply=True,
                              export_vertex_color='ACTIVE', export_all_vertex_colors=False, export_normals=True, export_texcoords=True)


def preview(path, views=((1.25, -1.15, 0.7), (-1.1, 1.3, -0.45)), res=(1300, 760), samples=40):
    """Cycles stills. A view is where the camera stands (it looks at the middle of the ship),
    or a pair: where it stands and what it looks at, for close-ups."""
    dress()
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.render.resolution_x, sc.render.resolution_y = res
    world = bpy.data.worlds.new('w')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.05, 0.06, 0.08, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 1.0
    sc.world = world
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 4
    sun.rotation_euler = (0.9, 0.2, 0.6)
    sc.collection.objects.link(sun)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.lens = 60
    cam.data.clip_start = 0.01
    sc.collection.objects.link(cam)
    sc.camera = cam
    for i, v in enumerate(views):
        at, to = (v if isinstance(v[0], (tuple, list)) else (v, (0, 0, 0)))
        cam.location = Vector(at)
        cam.rotation_euler = (Vector(to) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = f'{path}_{i}.png'
        bpy.ops.render.render(write_still=True)
