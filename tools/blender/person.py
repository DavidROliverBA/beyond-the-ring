"""A walking person: one continuous body with a skeleton, and three animation clips.

The body is grown from a stick figure with Blender's Skin modifier and smoothed, so knees,
elbows and hips bend instead of hinging between separate blocks. Bones follow the same
stick figure and the body is bound to them with automatic weights.

Clips (all looping, in place; the game moves the person and sets the playback speed):
  idle  4 s   breathing, a slow weight shift, a glance about
  walk  1 s   one full cycle (two steps), Earth-normal gait; the game scales its speed
  lope  1 s   one full cycle, the long floaty Belter stride in low spin gravity
walk and lope are the same length so they can be blended by weight and stay in step.

Facing -Y, up +Z, 1.74 m tall, feet on z = 0. Exported as assets/models/person.glb.
Materials are named skin, shirt, trousers, boots and hair so the game can recolour them.

Run:  blender -b -P tools/blender/person.py -- [--preview DIR]
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREVIEW = argv[argv.index('--preview') + 1] if '--preview' in argv else None
FPS = 30

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS

# ------------------------------------------------------------------ stick figure
# name: (position, skin radius x, skin radius y, parent joint)
J = {
    'pelvis': ((0, 0, 0.95), 0.150, 0.105, None),
    'waist':  ((0, 0, 1.08), 0.135, 0.095, 'pelvis'),
    'chest':  ((0, 0, 1.28), 0.165, 0.105, 'waist'),
    'neck':   ((0, 0.005, 1.47), 0.052, 0.052, 'chest'),
    'jaw':    ((0, -0.010, 1.56), 0.068, 0.080, 'neck'),
    'skull':  ((0, 0.000, 1.645), 0.088, 0.100, 'jaw'),
    'crown':  ((0, 0.010, 1.735), 0.040, 0.040, 'skull'),
}
for s, n in ((1, 'L'), (-1, 'R')):
    J.update({
        f'hip_{n}':      ((s * 0.090, 0.000, 0.92), 0.085, 0.085, 'pelvis'),
        f'knee_{n}':     ((s * 0.095, -0.012, 0.52), 0.055, 0.058, f'hip_{n}'),
        f'ankle_{n}':    ((s * 0.095, 0.020, 0.09), 0.040, 0.042, f'knee_{n}'),
        f'toe_{n}':      ((s * 0.098, -0.125, 0.035), 0.042, 0.030, f'ankle_{n}'),
        f'shoulder_{n}': ((s * 0.185, 0.005, 1.415), 0.056, 0.056, 'chest'),
        f'elbow_{n}':    ((s * 0.215, 0.020, 1.135), 0.042, 0.042, f'shoulder_{n}'),
        f'wrist_{n}':    ((s * 0.235, 0.000, 0.885), 0.032, 0.030, f'elbow_{n}'),
        f'hand_{n}':     ((s * 0.245, -0.010, 0.795), 0.036, 0.020, f'wrist_{n}'),
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

# ------------------------------------------------------------------ materials by region
MATS = {
    'skin':     ((0.78, 0.56, 0.42), 0.45),
    'shirt':    ((0.30, 0.42, 0.52), 0.8),
    'trousers': ((0.20, 0.22, 0.26), 0.85),
    'boots':    ((0.08, 0.07, 0.07), 0.5),
    'hair':     ((0.06, 0.045, 0.035), 0.7),
}
for name, (col, rough) in MATS.items():
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Roughness'].default_value = rough
    me.materials.append(m)
IDX = {n: i for i, n in enumerate(MATS)}


def region(c):
    x, y, z = c
    if z < 0.13:
        return 'boots'
    if abs(x) > 0.19 and z < 0.93:
        return 'skin'  # hands
    if z > 1.665 or (z > 1.56 and y > 0.035) or (z > 1.6 and abs(x) > 0.075 and y > -0.02):
        return 'hair'
    if z > 1.455:
        return 'skin'
    if z > 1.04 or abs(x) > 0.19:
        return 'shirt'
    return 'trousers'


for p in me.polygons:
    p.material_index = IDX[region(p.center)]

# ------------------------------------------------------------------ skeleton
arm_data = bpy.data.armatures.new('rig')
rig = bpy.data.objects.new('Rig', arm_data)
sc.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
P = lambda k: Vector(J[k][0])
BONES = [  # bone, head joint, tail joint, parent bone
    ('hips', 'pelvis', 'waist', None),
    ('spine', 'waist', 'chest', 'hips'),
    ('chest', 'chest', 'neck', 'spine'),
    ('neck', 'neck', 'jaw', 'chest'),
    ('head', 'jaw', 'crown', 'neck'),
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
                          export_texcoords=False, export_materials='EXPORT')
print('wrote', out)

# ------------------------------------------------------------------ preview stills
if PREVIEW:
    os.makedirs(PREVIEW, exist_ok=True)
    sc.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'CYCLES'
    sc.render.resolution_x, sc.render.resolution_y = 1400, 700
    world = bpy.data.worlds.new('w')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.5, 0.55, 0.6, 1)
    sc.world = world
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3
    sun.rotation_euler = (0.8, 0.2, -0.5)
    sc.collection.objects.link(sun)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 4.2
    for view, loc in (('side', (6.0, 0, 0.9)), ('front', (2.4, -5.4, 1.2))):
        cam.location = Vector(loc)
        cam.rotation_euler = (Vector((0, 0, 0.9)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        for clip in ('idle', 'walk', 'lope'):
            for t in rig.animation_data.nla_tracks:
                t.mute = t.name != clip
            for i, f in enumerate((0, 8, 15, 23) if clip != 'idle' else (0, 60)):
                sc.frame_set(f)
                sc.render.filepath = os.path.join(PREVIEW, f'{view}_{clip}_{i}.png')
                bpy.ops.render.render(write_still=True)
