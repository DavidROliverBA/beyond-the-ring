"""A walking person: one continuous body with a skeleton, three animation clips, and a
wardrobe of optional parts so that no two people need look the same.

The body is grown from a stick figure with Blender's Skin modifier and smoothed, so knees,
elbows and hips bend instead of hinging between separate blocks. Bones follow the same
stick figure and the body is bound to them with automatic weights. The head is one sculpted
shape (no separate jaw), with stuck-on nose, ears, eyes, brows and lips; the hands have a
thumb and four fingers.

Parts and choices. Every material is named `part` or `part@tag`:
  part  which palette colour the game paints it with (skin, shirt, trousers, boots, hair,
        eyes, jacket, cap, stubble, lips);
  tag   an optional piece. The game keeps the untagged faces plus the tags it picks for each
        person, so everyone is still one mesh and one draw call.
Tags: crop, shaved, long, pony, bun, curls, beard (hair; pony and bun go on top of crop),
      cap, jacket, sleeve / bare (long sleeves, or bare forearms).

Builds. Two shape keys, `heavy` and `curvy`, exported as morph targets; the game sets them
per person (heavy can go negative for a slighter build).

Shading. Ambient occlusion is baked into vertex colours (creases, armpits, under the chin,
under hair and hems), each optional piece baked with only the body present.

Clips (all looping, in place; the game moves the person and sets the playback speed):
  idle  4 s   breathing, a slow weight shift, a glance about
  walk  1 s   one full cycle (two steps), Earth-normal gait; the game scales its speed
  lope  1 s   one full cycle, the long floaty Belter stride in low spin gravity
walk and lope are the same length so they can be blended by weight and stay in step.

Facing -Y, up +Z, 1.74 m tall, feet on z = 0. Exported as assets/models/person.glb.

Run:  blender -b -P tools/blender/person.py -- [--preview DIR] [--quick]
      (--quick renders only the close-ups and line-ups, not every gait frame)
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix, Euler
from mathutils.bvhtree import BVHTree

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREVIEW = argv[argv.index('--preview') + 1] if '--preview' in argv else None
QUICK = '--quick' in argv
FPS = 30

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS

# Palm: skin radii at the end of each arm (thin towards the leg, broad front to back).
PALM = (0.014, 0.034)

# ------------------------------------------------------------------ small helpers
def sm(t):
    """Smooth step from 0 to 1."""
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def hump(z, at, w):
    return math.exp(-((z - at) / w) ** 2)


# Preview colours and roughness for each palette part (the game uses its own palette).
LOOK = {
    'skin':     ((0.78, 0.56, 0.42), 0.45),
    'shirt':    ((0.30, 0.42, 0.52), 0.8),
    'trousers': ((0.20, 0.22, 0.26), 0.85),
    'boots':    ((0.08, 0.07, 0.07), 0.5),
    'hair':     ((0.06, 0.045, 0.035), 0.7),
    'eyes':     ((0.02, 0.02, 0.025), 0.2),
    'jacket':   ((0.16, 0.13, 0.10), 0.7),
    'cap':      ((0.35, 0.10, 0.08), 0.8),
    'stubble':  ((0.50, 0.36, 0.28), 0.6),
    'lips':     ((0.62, 0.36, 0.30), 0.4),
}


def mat(name):
    """The material called `part` or `part@tag`, made on first use."""
    m = bpy.data.materials.get(name)
    if not m:
        col, rough = LOOK[name.split('@')[0]]
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        b = m.node_tree.nodes['Principled BSDF']
        b.inputs['Base Color'].default_value = (*col, 1)
        b.inputs['Roughness'].default_value = rough
    return m


def new_obj(name, bm, material, group, fix_normals=False):
    """Turn a bmesh into a smooth-shaded object of one material, moved by one bone."""
    if fix_normals:      # only for closed shapes: on an open shell Blender may pick the inside
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    me.materials.append(mat(material))
    ob = bpy.data.objects.new(name, me)
    sc.collection.objects.link(ob)
    ob.vertex_groups.new(name=group).add(range(len(me.vertices)), 1.0, 'REPLACE')
    return ob


def blob(name, loc, scale, material, segs=(10, 6), rot=(0, 0, 0), group='head', shape=None):
    """A stretched ball: the stuck-on features (nose, ears, eyes, brows, lips, a hair bun)."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs[0], v_segments=segs[1], radius=1)
    for v in bm.verts:
        if shape:
            v.co = shape(v.co)
        v.co = Vector(loc) + Euler(rot).to_matrix() @ Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2]))
    return new_obj(name, bm, material, group)


def tube(name, path, radii, material, group, n=8, squash=(1, 1), ref=(1, 0, 0)):
    """A round-ended tube along a path: fingers, thumbs, a ponytail. `squash` flattens it
    (first number along `ref`, second across it)."""
    bm = bmesh.new()
    pts = [Vector(p) for p in path]
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        u = t.cross(Vector(ref)).normalized()
        w = u.cross(t)
        rings.append([bm.verts.new(p + (math.cos(a) * squash[0] * w + math.sin(a) * squash[1] * u) * radii[i])
                      for a in (2 * math.pi * k / n for k in range(n))])
    for a, b in zip(rings, rings[1:]):
        for k in range(n):
            bm.faces.new((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]))
    for ring, p, out, r in ((rings[0], pts[0], pts[0] - pts[1], radii[0]), (rings[-1], pts[-1], pts[-1] - pts[-2], radii[-1])):
        c = bm.verts.new(p + out.normalized() * r * 0.5)
        for k in range(n):
            bm.faces.new((ring[k], ring[(k + 1) % n], c))
    return new_obj(name, bm, material, group, fix_normals=True)


def cut(bm, planes, keep):
    """Slice along each plane (point, normal), then keep only the faces whose middle passes
    `keep`. Slicing first makes every kept edge a clean line rather than a staircase."""
    for co, no in planes:
        geo = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geo, plane_co=co, plane_no=no)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not keep(f.calc_center_median())], context='FACES')


# ------------------------------------------------------------------ stick figure
# name: (position, skin radius x, skin radius y, parent joint)
J = {
    'pelvis': ((0, 0, 0.95), 0.150, 0.105, None),
    'waist':  ((0, 0, 1.08), 0.130, 0.092, 'pelvis'),
    'chest':  ((0, 0, 1.28), 0.165, 0.105, 'waist'),
    'trap':   ((0, 0.012, 1.432), 0.118, 0.072, 'chest'),    # slope from neck to shoulder
    'neck':   ((0, 0.010, 1.48), 0.050, 0.050, 'trap'),
    'nape':   ((0, 0.000, 1.565), 0.044, 0.045, 'neck'),
}
for s, n in ((1, 'L'), (-1, 'R')):
    J.update({
        f'hip_{n}':      ((s * 0.090, 0.000, 0.92), 0.085, 0.085, 'pelvis'),
        f'thigh_{n}':    ((s * 0.093, -0.010, 0.72), 0.070, 0.074, f'hip_{n}'),
        f'knee_{n}':     ((s * 0.095, -0.012, 0.52), 0.054, 0.057, f'thigh_{n}'),
        f'calf_{n}':     ((s * 0.095, 0.004, 0.37), 0.051, 0.056, f'knee_{n}'),
        f'ankle_{n}':    ((s * 0.095, 0.020, 0.09), 0.040, 0.042, f'calf_{n}'),
        f'toe_{n}':      ((s * 0.098, -0.125, 0.035), 0.042, 0.030, f'ankle_{n}'),
        f'shoulder_{n}': ((s * 0.185, 0.005, 1.402), 0.052, 0.054, 'chest'),
        f'bicep_{n}':    ((s * 0.200, 0.014, 1.275), 0.047, 0.048, f'shoulder_{n}'),
        f'elbow_{n}':    ((s * 0.215, 0.020, 1.135), 0.039, 0.040, f'bicep_{n}'),
        f'forearm_{n}':  ((s * 0.223, 0.014, 1.035), 0.040, 0.038, f'elbow_{n}'),
        f'wrist_{n}':    ((s * 0.235, 0.000, 0.885), 0.027, 0.025, f'forearm_{n}'),
        f'hand_{n}':     ((s * 0.243, -0.008, 0.815), PALM[0], PALM[1], f'wrist_{n}'),
    })

names = list(J)
me = bpy.data.meshes.new('body')
me.from_pydata([J[k][0] for k in names], [(names.index(J[k][3]), i) for i, k in enumerate(names) if J[k][3]], [])
body = bpy.data.objects.new('Body', me)
sc.collection.objects.link(body)
bpy.context.view_layer.objects.active = body
body.select_set(True)
skin = body.modifiers.new('skin', 'SKIN')
skin.use_smooth_shade = True
for i, k in enumerate(names):
    v = me.skin_vertices[0].data[i]
    v.radius = (J[k][1], J[k][2])
    v.use_root = k == 'pelvis'
sub = body.modifiers.new('sub', 'SUBSURF')
sub.levels = sub.render_levels = 2
bpy.ops.object.modifier_apply(modifier='skin')
bpy.ops.object.modifier_apply(modifier='sub')
bpy.ops.object.shade_smooth()

# Cut the body along level lines where clothes start and stop (boot tops, cuffs, hem, short
# sleeve ends, neckline), so each edge is a straight seam instead of the ragged outline of faces.
BOOT, CUFF, HEM, SLEEVE, NECKLINE = 0.13, 0.905, 1.04, 1.20, 1.468
bm = bmesh.new()
bm.from_mesh(me)
for z in (BOOT, CUFF, HEM, SLEEVE, NECKLINE):
    geo = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geo, plane_co=(0, 0, z), plane_no=(0, 0, 1))
bm.to_mesh(me)
bm.free()


def is_arm(c):
    """Below the armpit, anything this far out to the side is arm or hand, not torso."""
    return c.z < 1.36 and abs(c.x) > (0.165 if c.z > 1.0 else 0.19)


def region(c):
    if c.z < BOOT:
        return 'boots'
    if (is_arm(c) and c.z < CUFF) or c.z > NECKLINE:
        return 'skin'
    if c.z > HEM or is_arm(c):
        return 'shirt'
    return 'trousers'


for part in ('skin', 'shirt', 'trousers', 'boots'):
    me.materials.append(mat(part))
IDX = {m.name: i for i, m in enumerate(me.materials)}
for p in me.polygons:
    p.material_index = IDX[region(p.center)]

# ------------------------------------------------------------------ skeleton
arm_data = bpy.data.armatures.new('rig')
rig = bpy.data.objects.new('Rig', arm_data)
sc.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
P = lambda k: Vector((0, 0.01, 1.76)) if k == 'crown' else Vector(J[k][0])
BONES = [  # bone, head joint, tail joint, parent bone
    ('hips', 'pelvis', 'waist', None),
    ('spine', 'waist', 'chest', 'hips'),
    ('chest', 'chest', 'neck', 'spine'),
    ('neck', 'neck', 'nape', 'chest'),
    ('head', 'nape', 'crown', 'neck'),
]
for n in 'LR':
    BONES += [
        (f'thigh_{n}', f'hip_{n}', f'knee_{n}', 'hips'),
        (f'shin_{n}', f'knee_{n}', f'ankle_{n}', f'thigh_{n}'),
        (f'foot_{n}', f'ankle_{n}', f'toe_{n}', f'shin_{n}'),
        (f'upperarm_{n}', f'shoulder_{n}', f'elbow_{n}', 'chest'),
        (f'forearm_{n}', f'elbow_{n}', f'wrist_{n}', f'upperarm_{n}'),
        (f'hand_{n}', f'wrist_{n}', f'hand_{n}', f'forearm_{n}'),
    ]
for bn, h, t, par in BONES:
    eb = arm_data.edit_bones.new(bn)
    eb.head, eb.tail = P(h), P(t)
    # Same roll everywhere, so a positive turn about the bone's X axis means the same thing on
    # every limb: legs and arms swing forward, knees and elbows fold the natural way round.
    eb.align_roll(Vector((0, 0, 1)) if bn.startswith('foot') else Vector((0, -1, 0)))
    if par:
        eb.parent = arm_data.edit_bones[par]
        eb.use_connect = (eb.head - eb.parent.tail).length < 1e-4
bpy.ops.object.mode_set(mode='OBJECT')

bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')

# ------------------------------------------------------------------ jacket
# A copy of the torso and arms, pushed a little way out, longer than the shirt, open down the
# front with the opening widening to a collar. Being a copy it carries the same bone weights,
# so it moves exactly with the body underneath.
JACKET_HEM, COLLAR = 0.875, 1.482
jacket = body.copy()
jacket.data = body.data.copy()
jacket.name = 'jacket'
sc.collection.objects.link(jacket)
bm = bmesh.new()
bm.from_mesh(jacket.data)
open_half = lambda z: 0.022 + max(0.0, z - 1.22) * 0.18      # half-width of the front opening
cut(bm,
    [((0, 0, JACKET_HEM), (0, 0, 1)), ((0, 0, COLLAR), (0, 0, 1))]
    + [((s * 0.022, 0, 0), (1, 0, 0)) for s in (1, -1)]
    + [((s * 0.022, 0, 1.22), (s, 0, -0.18)) for s in (1, -1)],
    lambda c: JACKET_HEM < c.z < COLLAR and not (is_arm(c) and c.z < CUFF) and not (c.y < 0 and abs(c.x) < open_half(c.z)))
bm.normal_update()
for v in bm.verts:
    z = v.co.z
    arm = is_arm(v.co)
    out = 0.013 + (0 if arm else 0.014 * sm((1.02 - z) / 0.14))
    v.co += v.normal * out
# Ease out any puckers the push left, without moving the cut edges.
bmesh.ops.smooth_vert(bm, verts=[v for v in bm.verts if not v.is_boundary], factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
bm.to_mesh(jacket.data)
bm.free()
jacket.data.materials.clear()
jacket.data.materials.append(mat('jacket@jacket'))
for p in jacket.data.polygons:
    p.material_index = 0

# ------------------------------------------------------------------ head
# One sculpted ball: wide at the temples, narrowing to the jaw and chin, tucked in at the back
# towards the neck, with hollows for the eyes and a brow ridge. Hair, caps and beards are made
# from the same shape a little larger, so they always fit.
HC, HR = Vector((0, 0.004, 1.640)), Vector((0.080, 0.099, 0.120))
E = HC.z      # eye level: features and hairlines are placed up or down from here


def head_point(d, grow=0.0, jaw=1.0, face=False):
    """Where the head's surface lies in direction d (a unit vector from the middle of the head).
    `grow` lifts the surface outwards (hair), `jaw` is how strongly it narrows below the eyes."""
    x, y, z = d.x * (HR.x + grow), d.y * (HR.y + grow), d.z * (HR.z + grow)
    t = min(1.0, max(0.0, (0.15 - d.z) / 1.15))          # 0 at eye level, 1 under the chin
    x *= 1 - 0.25 * jaw * t ** 1.8
    if d.y > 0:
        y *= 1 - 0.36 * jaw * t ** 1.3                   # the back curves in to meet the neck
    elif d.z < 0:
        y *= max(1 - d.z * d.z, 0.03) ** -0.30           # the face drops straighter than a ball
    if face and d.y < 0:
        for s in (1, -1):
            y += 0.007 * math.exp(-((x - s * 0.031) / 0.015) ** 2 - ((z - 0.004) / 0.011) ** 2)   # eye hollows
        y -= 0.004 * hump(z, 0.030, 0.010) * hump(x, 0, 0.05)                                    # brow ridge
        y -= 0.003 * hump(z, -0.070, 0.024) * hump(x, 0, 0.03)                                   # mouth and muzzle
    return Vector((x, y, z))


def shell(name, material, grow=0.0, jaw=1.0, face=False, segs=(24, 14), planes=(), keep=None, warp=None):
    """The head shape as a mesh, optionally larger, re-shaped by `warp`, and cut down by planes."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs[0], v_segments=segs[1], radius=1)
    for v in bm.verts:
        d = v.co.normalized()
        p = head_point(d, grow, jaw, face)
        v.co = HC + (warp(d, p) if warp else p)
    if keep:
        cut(bm, planes, keep)
    return new_obj(name, bm, material, 'head')


head = shell('head', 'skin', face=True, segs=(40, 24))
bvh = BVHTree.FromObject(head, bpy.context.evaluated_depsgraph_get())
front_y = lambda x, z: bvh.ray_cast(Vector((x, -1, z)), Vector((0, 1, 0)))[0].y    # the face at (x, z)
side_x = lambda y, z: bvh.ray_cast(Vector((1, y, z)), Vector((-1, 0, 0)))[0].x     # the left side at (y, z)

# Features, all moved by the head bone only.
nose_shape = lambda c: Vector((c.x * (0.62 + 0.38 * sm(0.5 - c.z * 0.6)), c.y, c.z))   # narrow bridge, wider tip
base = [
    head,
    blob('nose', (0, front_y(0, E - 0.034) - 0.001, E - 0.034), (0.0125, 0.015, 0.022), 'skin', rot=(0.35, 0, 0), shape=nose_shape),
    blob('lips', (0, front_y(0, E - 0.074) + 0.0035, E - 0.074), (0.021, 0.006, 0.0055), 'lips'),
]
for s in (1, -1):
    base += [
        blob('ear', (s * (side_x(0.014, E - 0.012) - 0.003), 0.014, E - 0.012), (0.007, 0.016, 0.028), 'skin', rot=(0, s * 0.12, s * 0.3)),
        blob('eye', (s * 0.031, front_y(s * 0.031, E + 0.004) + 0.002, E + 0.004), (0.0100, 0.005, 0.0074), 'eyes', segs=(10, 6)),
        blob('brow', (s * 0.032, front_y(s * 0.032, E + 0.031) + 0.002, E + 0.031), (0.018, 0.005, 0.0042), 'hair', segs=(8, 4), rot=(0, s * -0.06, s * -0.12)),
    ]

# Hands: the palm is the end of the arm; four fingers and a thumb are small tubes with a relaxed
# curl towards the leg, moved by the hand bone.
for s, n in ((1, 'L'), (-1, 'R')):
    hx, hy, hz = J[f'hand_{n}'][0]
    for i, (off, length, r) in enumerate(((-0.027, 0.066, 0.0092), (-0.009, 0.073, 0.0096), (0.009, 0.068, 0.0092), (0.026, 0.054, 0.0082))):
        y = hy + 0.004 + off
        base.append(tube(f'finger{i}', [(hx, y, hz + 0.012), (hx - s * 0.003, y - 0.002, hz - length * 0.5), (hx - s * 0.016, y - 0.005, hz - length)],
                         (r, r * 0.95, r * 0.8), 'skin', f'hand_{n}', n=6))
    base.append(tube('thumb', [(hx - s * 0.002, hy - 0.030, hz + 0.050), (hx - s * 0.007, hy - 0.050, hz + 0.018), (hx - s * 0.014, hy - 0.056, hz - 0.016)],
                     (0.0115, 0.0105, 0.0085), 'skin', f'hand_{n}', n=6))

# ------------------------------------------------------------------ hair, caps and a beard
rel = lambda c: c - HC
HAIRLINE = ((0, HC.y, E + 0.022), (0, 0.5, 1))                # high on the forehead, lower behind
above_hairline = lambda c: (c.z - E - 0.022) + 0.5 * rel(c).y > 0
BEHIND_EAR = ((0, HC.y + 0.022, 0), (0, 1, 0))
NAPE = ((0, 0, E - 0.058), (0, 0, 1))
crop_keep = lambda c: above_hairline(c) or (rel(c).y > 0.022 and c.z > E - 0.058)


def tuck(p, by):
    """In front of the ears the hair turns in to lie on the cheek, so its edge faces forward and
    frames the face from any angle (hair is only drawn from outside)."""
    return Vector((p.x * (1 - by * sm((-0.008 - p.y) / 0.04) * sm((0.035 - p.z) / 0.04)), p.y, p.z))


def hang(d, p):
    """Long hair: below eye level it falls nearly straight instead of following the jaw in."""
    if d.z < 0:
        k = max(math.sqrt(1 - d.z * d.z), 0.5) ** 0.8
        p = Vector((p.x / k, p.y / k, p.z * 1.5))
    return tuck(p, 0.24)


def curl(d, p):
    """A mop of curls: the surface swells in and out in rounded lumps."""
    a, b = math.atan2(d.y, d.x), math.acos(max(-1, min(1, d.z)))
    return tuck(p * (1 + 0.085 * math.sin(7 * a + 2.0 * math.sin(3 * b)) * math.sin(6 * b)), 0.22)


extras = [
    jacket,
    shell('crop', 'hair@crop', grow=0.006, planes=(HAIRLINE, BEHIND_EAR, NAPE), keep=crop_keep),
    shell('shaved', 'stubble@shaved', grow=0.0015, segs=(40, 24), planes=(HAIRLINE, BEHIND_EAR, NAPE), keep=crop_keep),
    shell('long', 'hair@long', grow=0.018, jaw=0.25, warp=hang, segs=(32, 18),
          planes=(HAIRLINE, ((0, HC.y - 0.048, 0), (0, 1, 0)), ((0, 0, 1.495), (0, 0, 1))),
          keep=lambda c: c.z > 1.495 and (above_hairline(c) or rel(c).y > -0.048)),
    shell('curls', 'hair@curls', grow=0.024, jaw=0.5, warp=curl, segs=(36, 22),
          planes=(((0, HC.y, E + 0.014), (0, 0.5, 1)), ((0, HC.y - 0.045, 0), (0, 1, 0)), ((0, 0, E - 0.060), (0, 0, 1))),
          keep=lambda c: (c.z - E - 0.014) + 0.5 * rel(c).y > 0 or (rel(c).y > -0.045 and c.z > E - 0.060)),
    # The beard's top edge runs from under the lip up towards the ear.
    shell('beard', 'hair@beard', grow=0.005,
          planes=(((0, HC.y - 0.09, E - 0.086), (0, -0.5, 1)), ((0, HC.y + 0.016, 0), (0, 1, 0))),
          keep=lambda c: c.z < E - 0.086 + 0.5 * (rel(c).y + 0.09) and rel(c).y < 0.016),
    blob('moustache', (0, front_y(0, E - 0.063) + 0.001, E - 0.063), (0.024, 0.006, 0.0055), 'hair@beard', segs=(10, 4)),
    # Ponytail and bun sit on top of the crop.
    tube('pony', [(0, 0.088, E + 0.070), (0, 0.130, E + 0.058), (0, 0.144, E - 0.010), (0, 0.130, E - 0.095), (0, 0.120, E - 0.140)],
         (0.020, 0.027, 0.027, 0.020, 0.010), 'hair@pony', 'head', n=8, squash=(1.15, 0.85)),
    blob('bun', (0, 0.080, E + 0.104), (0.040, 0.040, 0.036), 'hair@bun', segs=(12, 8), rot=(0.5, 0, 0)),
    # A peaked cap: a dome a little larger than the crop, and a brim.
    shell('cap', 'cap@cap', grow=0.013, planes=(((0, HC.y, E + 0.054), (0, 0.15, 1)),),
          keep=lambda c: (c.z - E - 0.054) + 0.15 * rel(c).y > 0),
    blob('brim', (0, HC.y - 0.120, E + 0.064), (0.066, 0.062, 0.0045), 'cap@cap', segs=(14, 4), rot=(-0.16, 0, 0)),
]

# ------------------------------------------------------------------ baked shading
# Ambient occlusion into a colour per vertex. The plain body is baked alone; each optional piece
# is baked with just the body present, so pieces never shade one another.
bpy.ops.object.select_all(action='DESELECT')
for ob in base:
    ob.select_set(True)
body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()

world = bpy.data.worlds.new('w')
world.light_settings.distance = 0.22       # only nearby surfaces shade: creases, not the room
sc.world = world
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = 48
for ob in [body] + extras:
    col = ob.data.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    ob.data.color_attributes.active_color = col
    ob.data.color_attributes.render_color_index = ob.data.color_attributes.find('Col')
for ob in [body] + extras:
    for other in extras:
        other.hide_render = other is not ob
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
for ob in extras:
    ob.hide_render = False
    if ob is not jacket:
        ob.select_set(True)
jacket.select_set(True)
body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
me = body.data

bm = bmesh.new()
bm.from_mesh(me)
# Soften the bake: each vertex takes some of its neighbours' shade, twice.
cl = bm.verts.layers.float_color['Col']
for _ in range(2):
    new = {}
    for v in bm.verts:
        near = [e.other_vert(v)[cl][0] for e in v.link_edges]
        new[v] = 0.5 * v[cl][0] + 0.5 * sum(near) / len(near) if near else v[cl][0]
    for v, a in new.items():
        a = min(1.0, a)
        v[cl] = (a, a, a, 1)
shade = sorted(v[cl][0] for v in bm.verts)
print('baked shade: darkest %.2f, tenth %.2f, middle %.2f' % (shade[0], shade[len(shade) // 10], shade[len(shade) // 2]))

# Sleeves: the forearms exist twice in the same place, once as long shirt sleeves and once as
# bare skin below a short sleeve. The game keeps one or the other.
IDX = {m.name: i for i, m in enumerate(me.materials)}
for name in ('shirt@sleeve', 'skin@bare'):
    me.materials.append(mat(name))
    IDX[name] = len(me.materials) - 1
fore = [f for f in bm.faces if f.material_index == IDX['shirt'] and is_arm(f.calc_center_median()) and f.calc_center_median().z < SLEEVE]
for f in fore:
    f.material_index = IDX['shirt@sleeve']
for f in bmesh.ops.duplicate(bm, geom=fore)['geom']:
    if isinstance(f, bmesh.types.BMFace):
        f.material_index = IDX['skin@bare']
bm.to_mesh(me)
bm.free()

# ------------------------------------------------------------------ builds
# Two shape keys. Each is a smooth push that depends only on where a point is, so the body, the
# jacket over it and the hands at the ends of the arms all move together.


def build_shift(co, kind):
    x, y, z = co
    fade = sm((1.47 - z) / 0.07)                # nothing above the collar
    if fade == 0:
        return Vector((0, 0, 0))
    s = 1 if x >= 0 else -1
    arm = sm((abs(x) - 0.15) / 0.03) * sm((1.40 - z) / 0.10)
    leg = sm((0.95 - z) / 0.12)
    torso = (1 - arm) * (1 - leg)
    rad = Vector((x, y, 0))
    rad = rad.normalized() if rad.length > 1e-5 else Vector((0, -1, 0))
    lrad = Vector((x - s * 0.093, y + 0.005, 0))
    lrad = lrad.normalized() if lrad.length > 1e-5 else Vector((s, 0, 0))
    out = Vector((0, 0, 0))
    if kind == 'heavy':
        belly = 0.046 * hump(z, 1.07, 0.17) * (1 + 0.5 * max(0.0, -rad.y)) + 0.012 * hump(z, 1.30, 0.12) + 0.016 * hump(z, 0.93, 0.10)
        out += torso * belly * rad
        out += leg * (1 - arm) * sm((z - 0.12) / 0.2) * ((0.015 * hump(z, 0.74, 0.22) + 0.005) * lrad + Vector((s * 0.008, 0, 0)))
        out += arm * Vector((s * (0.012 + 0.030 * sm((1.40 - z) / 0.3)), 0, 0))
    else:
        side = (-0.015 * hump(z, 1.12, 0.09) + 0.017 * hump(z, 0.94, 0.10) - 0.008 * hump(z, 1.40, 0.08)) * abs(rad.x)
        out += torso * Vector((s * side, 0, 0))
        if y < 0:
            out += torso * Vector((0, -0.026 * hump(z, 1.30, 0.062) * hump(abs(x), 0.072, 0.055), 0))
        else:
            out += torso * Vector((0, 0.012 * hump(z, 0.93, 0.08), 0))
        out += leg * (1 - arm) * sm((z - 0.12) / 0.2) * 0.009 * hump(z, 0.80, 0.15) * lrad
        out += arm * Vector((-s * 0.010 * sm((1.40 - z) / 0.2), 0, 0))
    return out * fade


body.shape_key_add(name='Basis')
for kind in ('heavy', 'curvy'):
    key = body.shape_key_add(name=kind)
    for i, v in enumerate(me.vertices):
        key.data[i].co = v.co + build_shift(v.co, kind)
    key.value = 0

# ------------------------------------------------------------------ clips
D = math.radians
pb = rig.pose.bones
for b in pb:
    b.rotation_mode = 'XYZ'


def bump(p, at, w):
    d = (p - at + 0.5) % 1.0 - 0.5
    return math.exp(-(d / w) ** 2)


def leg(p, k):
    """Hip, knee and ankle angles (degrees) at cycle phase p for one leg. k = 0 walk, 1 lope."""
    hip = (6 + 18.5 * math.cos(2 * math.pi * p)) * (1 + 0.55 * k)
    knee = 5 + (12 + 10 * k) * bump(p, 0.12, 0.08) + (55 + 25 * k) * bump(p, 0.70, 0.12 + 0.03 * k)
    ankle = -(15 + 12 * k) * bump(p, 0.58, 0.07) + 8 * bump(p, 0.82, 0.1)
    return hip, knee, ankle


def gait(p, k):
    """Pose for walk (k=0) or lope (k=1) at phase p in [0, 1)."""
    pose = {}
    for n, off in (('L', 0.0), ('R', 0.5)):
        h, kn, a = leg((p + off) % 1, k)
        pose[f'thigh_{n}'] = (D(h), 0, 0)
        pose[f'shin_{n}'] = (D(-kn), 0, 0)
        pose[f'foot_{n}'] = (D(a), 0, 0)
        swing = -math.cos(2 * math.pi * (p + off)) * (16 - 6 * k)
        pose[f'upperarm_{n}'] = (D(swing), 0, 0)
        pose[f'forearm_{n}'] = (D(14 + 6 * k + max(0, swing) * 0.5), 0, 0)
        pose[f'hand_{n}'] = (D(5), 0, 0)
    tw = 4 * math.cos(2 * math.pi * p)
    pose['hips'] = (D(-3 - 4 * k), D(-tw), 0)
    pose['spine'] = (D(1 + 2 * k), D(tw * 0.8), 0)
    pose['chest'] = (D(1), D(tw * 0.9), 0)
    pose['neck'] = (D(1), 0, 0)
    pose['head'] = (D(-1 + 3 * k), D(-tw * 0.4), 0)
    bob = (0.016 + 0.035 * k) * -math.cos(4 * math.pi * p) - 0.012 * (1 + k)
    sway = 0.012 * math.sin(2 * math.pi * p)
    return pose, (sway, bob, 0)


def idle(p):
    """Standing: four breaths in four seconds, one slow weight shift, a glance about."""
    br = math.sin(2 * math.pi * p * 4)
    ws = math.sin(2 * math.pi * p)
    look = math.sin(2 * math.pi * p * 2 + 0.7)
    pose = {
        'hips': (0, 0, D(1.2 * ws)),
        'spine': (D(0.6 * br), 0, D(-0.8 * ws)),
        'chest': (D(0.8 * br), D(1.5 * look), 0),
        'neck': (0, 0, 0),
        'head': (D(-2 + 1.5 * math.sin(2 * math.pi * p * 3)), D(9 * look), 0),
    }
    for n, s in (('L', 1), ('R', -1)):
        pose[f'thigh_{n}'] = (D(1), 0, 0)
        pose[f'shin_{n}'] = (D(-2 - 3 * max(0, -s * ws)), 0, 0)
        pose[f'foot_{n}'] = (D(1), 0, 0)
        pose[f'upperarm_{n}'] = (D(2 + 1.5 * br), 0, 0)
        pose[f'forearm_{n}'] = (D(10 + 2 * br), 0, 0)
        pose[f'hand_{n}'] = (D(4), 0, 0)
    return pose, (0.018 * ws, -0.004 + 0.002 * br, 0)


def key_clip(name, frames, fn):
    rig.animation_data_create()
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    rig.animation_data.action = act
    for f in range(frames + 1):
        pose, (sx, bob, _) = fn((f % frames) / frames)
        for b in pb:
            b.rotation_euler = pose.get(b.name, (0, 0, 0))
            b.keyframe_insert('rotation_euler', frame=f)
        # Hips bone: X along the body's left, Y up, Z forward.
        pb['hips'].location = (sx, bob, 0)
        pb['hips'].keyframe_insert('location', frame=f)
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 0, act)
    rig.animation_data.action = None
    return act


key_clip('idle', 4 * FPS, idle)
key_clip('walk', FPS, lambda p: gait(p, 0))
key_clip('lope', FPS, lambda p: gait(p, 1))
for b in pb:
    b.rotation_euler = (0, 0, 0)
    b.location = (0, 0, 0)

# ------------------------------------------------------------------ export
out = os.path.join(ROOT, 'assets', 'models', 'person.glb')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True, export_animations=True,
                          export_animation_mode='NLA_TRACKS', export_skins=True, export_normals=True,
                          export_texcoords=False, export_materials='EXPORT',
                          export_vertex_color='ACTIVE', export_all_vertex_colors=False,
                          export_morph=True, export_morph_normal=False)
print('wrote', out, os.path.getsize(out) // 1024, 'KB;', len(me.vertices), 'vertices,', sum(len(p.vertices) - 2 for p in me.polygons), 'triangles in all')

# ------------------------------------------------------------------ preview stills
if PREVIEW:
    os.makedirs(PREVIEW, exist_ok=True)
    sc.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'CYCLES'
    sc.render.resolution_x, sc.render.resolution_y = 1400, 700
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.5, 0.55, 0.6, 1)
    # Show the baked shade: every material's colour is multiplied by the vertex colour.
    for m in bpy.data.materials:
        m.use_backface_culling = True      # as the game draws it: outsides only
        nt = m.node_tree
        b = nt.nodes['Principled BSDF']
        rgb = nt.nodes.new('ShaderNodeRGB')
        rgb.outputs[0].default_value = b.inputs['Base Color'].default_value
        ao = nt.nodes.new('ShaderNodeVertexColor')
        ao.layer_name = 'Col'
        mul = nt.nodes.new('ShaderNodeVectorMath')
        mul.operation = 'MULTIPLY'
        nt.links.new(rgb.outputs[0], mul.inputs[0])
        nt.links.new(ao.outputs[0], mul.inputs[1])
        nt.links.new(mul.outputs[0], b.inputs['Base Color'])
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3
    sun.rotation_euler = (0.8, 0.2, -0.5)
    sc.collection.objects.link(sun)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = 'ORTHO'
    body.hide_render = True
    shown = []

    def show(tags, dx=0.0, heavy=0.0, curvy=0.0):
        """A copy of the person wearing only the chosen optional pieces, as the game would draw it."""
        ob = body.copy()
        ob.data = body.data.copy()
        sc.collection.objects.link(ob)
        ob.hide_render = False
        vb = bmesh.new()
        vb.from_mesh(ob.data)
        names = [m.name for m in ob.data.materials]
        drop = [f for f in vb.faces if '@' in names[f.material_index] and names[f.material_index].split('@')[1] not in tags]
        bmesh.ops.delete(vb, geom=drop, context='FACES')
        vb.to_mesh(ob.data)
        vb.free()
        ob.data.shape_keys.key_blocks['heavy'].value = heavy
        ob.data.shape_keys.key_blocks['heavy'].slider_min = -1
        ob.data.shape_keys.key_blocks['curvy'].value = curvy
        # Each copy gets its own skeleton standing where the copy stands, so the bones turn about
        # the right places.
        r = rig.copy()
        sc.collection.objects.link(r)
        r.location.x = dx
        ob.parent = r
        ob.modifiers[0].object = r
        shown.extend((ob, r))
        return ob

    def clear():
        for ob in shown:
            bpy.data.objects.remove(ob)
        shown.clear()

    def shot(name, aim, loc, scale, clip='idle', frame=0):
        for r in [rig] + [o for o in shown if o.type == 'ARMATURE']:
            for t in r.animation_data.nla_tracks:
                t.mute = t.name != clip
        sc.frame_set(frame)
        cam.data.ortho_scale = scale
        cam.location = Vector(loc)
        cam.rotation_euler = (Vector(aim) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(PREVIEW, name + '.png')
        bpy.ops.render.render(write_still=True)

    # One plain person: gait frames, then close-ups of the face, seams, a hand and the joints.
    show({'crop', 'sleeve'})
    if not QUICK:
        for view, loc in (('side', (6.0, 0, 0.9)), ('front', (2.4, -5.4, 1.2))):
            for clip in ('idle', 'walk', 'lope'):
                for i, f in enumerate((0, 8, 15, 23) if clip != 'idle' else (0, 60)):
                    shot(f'{view}_{clip}_{i}', (0, 0, 0.9), loc, 3.4, clip, f)
    shot('close_face', (0, 0, 1.62), (0.9, -2.6, 1.75), 0.55)
    shot('close_profile', (0, 0, 1.62), (-3, -0.3, 1.66), 0.55)
    shot('close_seams', (0, 0, 1.0), (1.4, -4.0, 1.2), 1.7)
    shot('close_hand', (0.24, 0, 0.84), (2.2, -2.4, 1.1), 0.42)
    shot('close_knees', (0, 0, 0.5), (4.0, -1.2, 0.7), 1.3, 'lope', 23)
    shot('close_shoulders', (0, 0, 1.25), (1.6, -4.0, 1.5), 1.2, 'walk', 8)
    shot('close_back', (0, 0, 1.25), (-1.6, 4.0, 1.6), 1.2, 'walk', 8)
    clear()

    # The wardrobe: one person per combination, side by side, front and back, and their heads.
    LINE = [
        ({'crop', 'sleeve'}, 0, 0), ({'shaved', 'bare'}, -0.4, 0), ({'long', 'sleeve', 'jacket'}, 0, 0.9),
        ({'crop', 'pony', 'bare'}, -0.2, 0.7), ({'crop', 'bun', 'sleeve', 'jacket'}, 0.5, 0.4), ({'curls', 'bare'}, 0.9, 0),
        ({'crop', 'beard', 'cap', 'sleeve', 'jacket'}, 0.3, 0), ({'beard', 'sleeve'}, 1.0, 0), ({'shaved', 'cap', 'bare'}, 0, 1.0),
    ]
    for i, (tags, heavy, curvy) in enumerate(LINE):
        show(tags, (i - (len(LINE) - 1) / 2) * 0.62, heavy, curvy)
    shot('lineup_front', (0, 0, 0.9), (1.5, -6, 1.3), 5.6)
    shot('lineup_back', (0, 0, 0.9), (-1.5, 6, 1.3), 5.6)
    shot('lineup_walk', (0, 0, 0.9), (2.5, -6, 1.3), 5.6, 'walk', 8)
    shot('close_jacket', (-1.24, 0, 1.2), (-0.3, -4, 1.5), 1.0)
    shot('close_jacket_back', (-1.24, 0, 1.2), (-2.1, 4, 1.5), 1.0)
    for i in range(len(LINE)):
        mid = (i - (len(LINE) - 1) / 2) * 0.62
        shot(f'head_{i}_front', (mid, 0, 1.60), (mid + 1.2, -3, 1.72), 0.62)
        shot(f'head_{i}_back', (mid, 0, 1.60), (mid + 2.4, 2.2, 1.75), 0.62)
    clear()
