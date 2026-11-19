import bpy, sys, os, math, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, kit
importlib.reload(kit)
import bmesh
from kit import Ship, reset, bake_ao, weather, export, preview, section_at
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
T = Matrix.Translation


def band(faces, m, y0, y1, pred=lambda c: True):
    """Paint a stripe: every face whose centre lies between y0 and y1."""
    mi = kit.NAMES.index(m)
    for f in faces:
        c = f.calc_center_median()
        if y0 <= c.y <= y1 and pred(c):
            f.material_index = mi


def corvette():
    """Martian Corvette-class frigate (the Rocinante): a flat chisel prow over a spiked railgun frame,
    a raised armoured crew block, a boxy striped engineering section and one big ribbed drum drive."""
    s = Ship('corvette', 7)
    flat = lambda *a: s.loft(list(a), 'gun', cell=0.03, smooth=False)

    # Main hull: dark gunmetal, flat-topped, a low wedge prow forward.
    hull = [
        (0.52, 0.060, 0.010, 0.008, 0.006, -0.040),
        (0.46, 0.090, 0.028, 0.018, 0.010, -0.028),
        (0.30, 0.125, 0.050, 0.030, 0.020, -0.010),
        (0.10, 0.145, 0.068, 0.040, 0.030, 0.000),
        (-0.15, 0.150, 0.078, 0.044, 0.034, 0.000),
        (-0.40, 0.140, 0.084, 0.050, 0.040, 0.000),
    ]
    sides, caps = flat(*hull)
    top = [f for f in sides if f.calc_center_median().z > 0.045 and abs(f.normal.x) < 0.5]
    s.paint(top, 'lgrey')
    for f in top:  # the red panel on the prow roof
        c = f.calc_center_median()
        if c.y > 0.33 and abs(c.x) < 0.045:
            f.material_index = kit.NAMES.index('mred')
    band(sides, 'trim', -0.18, -0.15, lambda c: c.z > 0.0)
    hp = s.plate(sides, accents=[('hull2', 0.18)], merge=0.55)
    s.paint(caps, 'dark')

    # Raised crew block: angled front with the cockpit glazing, light panelled roof, red edge stripes.
    cb, cbc = s.loft([(0.17, 0.05, 0.006, 0.004, 0.004, 0.078), (0.12, 0.09, 0.040, 0.025, 0.012, 0.100),
                      (-0.06, 0.098, 0.044, 0.028, 0.012, 0.104), (-0.12, 0.09, 0.038, 0.022, 0.012, 0.100)], 'hull', cell=0.026, smooth=False)
    s.paint([f for f in cb if f.calc_center_median().z > 0.12], 'lgrey')
    for f in cb:
        c = f.calc_center_median()
        if c.z > 0.12 and 0.07 < abs(c.x) < 0.085:
            f.material_index = kit.NAMES.index('mred')
    s.plate(cb, inset=0.002, depth=0.001, merge=0.4)
    s.paint(cbc, 'dark')
    # Flight deck glazing across the sloped front, a row of cabin ports down each side.
    slope = Vector((0, 0.746, 0.666))
    for i in range(5):
        s.pane(Vector(((i - 2) * 0.019, 0.148, 0.1086)) + slope * 0.0012, slope, 0.015, 0.011, along=(1, 0, 0))
    for sx in (1, -1):
        s.windows((sx * 0.0912, 0.105, 0.1), (sx * 0.0983, -0.055, 0.1), 8, (sx, 0, 0), s=0.0032)

    # Engineering section: boxy, pale with red and white stripes, wider than the hull behind the crew block.
    en, enc = s.loft([(-0.14, 0.13, 0.070, 0.040, 0.035, 0.012), (-0.18, 0.152, 0.092, 0.050, 0.045, 0.006),
                      (-0.38, 0.152, 0.092, 0.050, 0.045, 0.006), (-0.40, 0.14, 0.084, 0.048, 0.040, 0.004)], 'lgrey', cell=0.028, smooth=False)
    for f in en:
        c = f.calc_center_median()
        if (0.025 < abs(c.x) < 0.04 or 0.075 < abs(c.x) < 0.09) and c.z > 0.07:
            f.material_index = kit.NAMES.index('mred')
        elif abs(c.x) > 0.14 and c.z > -0.02 and -0.35 < c.y < -0.2:
            f.material_index = kit.NAMES.index('hull2')
    ep = s.plate(en, inset=0.002, depth=0.0012, merge=0.4)
    s.paint(enc, 'dark')
    # Machinery door on each flank, coolant lines above and below it, a grille forward of it.
    for sx in (1, -1):
        s.box(0.004, 0.09, 0.05, (sx * 0.1535, -0.27, 0.0), 'dark')
        s.box(0.005, 0.06, 0.03, (sx * 0.1535, -0.27, 0.0), 'trim')
        s.pipe([(sx * 0.1542, -0.19, -0.03), (sx * 0.1542, -0.225, -0.03), (sx * 0.1542, -0.235, -0.037), (sx * 0.1542, -0.37, -0.037)], r=0.0018)
        s.pipe([(sx * 0.1542, -0.195, 0.038), (sx * 0.1542, -0.365, 0.038)], r=0.0024, m='steel')
        s.vent((sx * 0.1525, -0.2, 0.004), (sx, 0, 0), 0.04, 0.02, n=4, m='hull2')

    # Dorsal gun tower behind the crew block.
    t, tc = s.loft([(-0.13, 0.04, 0.020, 0.010, 0.006, 0.108), (-0.15, 0.052, 0.034, 0.014, 0.006, 0.118), (-0.23, 0.052, 0.034, 0.014, 0.006, 0.118), (-0.25, 0.04, 0.020, 0.010, 0.006, 0.108)], 'hull', cell=0.03, smooth=False)
    s.plate(t, inset=0.002, depth=0.0012, merge=0.4)
    s.paint(tc, 'dark')
    s.pdc((0, -0.19, 0.152), 1, s=0.015)

    # Railgun along the roof of the prow, and the spiked torpedo/rail frame beneath it.
    s.cyl(0.011, 0.011, 0.30, (0, 0.30, 0.060), 'steel', segs=12)
    s.cyl(0.015, 0.015, 0.03, (0, 0.46, 0.060), 'dark', segs=12)
    s.box(0.16, 0.30, 0.008, (0, 0.40, -0.052), 'hull2', rot=(-0.05, 0, 0))
    for x in (-0.055, 0, 0.055):
        s.cyl(0.0045, 0.0035, 0.20, (x, 0.58, -0.050), 'dark', segs=6)
        s.cyl(0.007, 0.007, 0.03, (x, 0.50, -0.050), 'hull2', segs=8)

    # Shoulder sponsons forward, carrying the PDC stalks.
    for sx in (1, -1):
        sp = s.box(0.05, 0.18, 0.07, (sx * 0.14, 0.20, -0.012), 'gun')
        s.plate(sp, inset=0.002, depth=0.001, merge=0.0)
        # Six PDCs: two high at the shoulders, two low on the flanks, plus the tower and one under the tail.
        s.strut((sx * 0.13, 0.26, 0.04), (sx * 0.17, 0.26, 0.085), r=0.005)
        s.pdc((sx * 0.17, 0.26, 0.085), 1, s=0.013)
        s.strut((sx * 0.14, -0.08, -0.06), (sx * 0.175, -0.08, -0.11), r=0.005)
        s.pdc((sx * 0.175, -0.08, -0.11), -1, s=0.013)
        s.rcs((sx * 0.172, 0.32, 0.0), (sx, 0, 0), s=0.007)
        s.rcs((sx * 0.153, -0.34, 0.0), (sx, 0, 0), s=0.007)
        s.lamp((sx * 0.172, 0.06, 0.0), 'green' if sx > 0 else 'red', 0.004)
    s.strut((0, -0.20, -0.07), (0, -0.20, -0.125), r=0.005)
    s.pdc((0, -0.20, -0.125), -1, s=0.013)
    s.mast((0.02, 0.12, 0.125), 0.06, axis=(0.1, 0.3, 1))
    s.dish((-0.04, -0.06, 0.148), 0.016, aim=(-0.3, 0.2, 1))

    # Drum drive: a wide ribbed barrel, hollow at the back, on a short collar.
    s.cyl(0.108, 0.108, 0.02, (0, -0.41, 0), 'dark', segs=8)
    drum = [(0.0, -0.42), (0.104, -0.42), (0.112, -0.43), (0.112, -0.545), (0.100, -0.555), (0.088, -0.555), (0.084, -0.50), (0.05, -0.47), (0.0, -0.47)]
    s.lathe(drum, (0, 0, 0), 'navy2', segs=24)
    for y in (-0.445, -0.475, -0.505, -0.535):
        s.hoop(0.112, 0.003, 0.004, y, m='navy', segs=24)
    for k in range(8):
        a = k / 8 * math.tau + 0.2
        s.box(0.018, 0.012, 0.03, (math.cos(a) * 0.118, -0.55, math.sin(a) * 0.118), 'hull2', rot=(0, -a, 0))
    s.cyl(0.05, 0.05, 0.0005, (0, -0.485, 0), 'glow', segs=20)
    # Inside the drum: the injector on its six struts.
    s.cyl(0.02, 0.009, 0.03, (0, -0.5, 0), 'dark', segs=12)
    for k in range(6):
        a = k / 6 * math.tau
        s.strut((math.cos(a) * 0.016, -0.5, math.sin(a) * 0.016), (math.cos(a) * 0.085, -0.52, math.sin(a) * 0.085), 0.003, 'hull2')
    s.empty('drive_main', (0, -0.555, 0), 0.09)

    # The things a crew uses: an airlock on each flank with its hazard border and a ladder of rungs,
    # cabin ports low on the hull, a cargo door in the belly.
    for sx in (1, -1):
        s.box(0.002, 0.04, 0.046, (sx * 0.1474, -0.02, -0.004), 'yellow')
        s.hatch((sx * 0.1482, -0.02, -0.004), (sx, 0, 0), 0.036, 0.03, m='lgrey', lit=True)
        s.rungs((sx * 0.1488, -0.052, -0.03), (sx * 0.1488, -0.052, 0.022), (sx, 0, 0), n=6, w=0.008)
        s.windows((sx * 0.1456, 0.09, 0.008), (sx * 0.147, 0.02, 0.008), 4, (sx, 0, 0), s=0.003, skip=0)
    s.hatch((0, -0.02, -0.0735), (0, 0, -1), 0.08, 0.07, m='hull2')
    s.lamp((0, -0.39, 0.1), 'window', 0.003)
    s.scorches.append((Vector((0, 0.46, 0.06)), 0.07, 0.6))  # the railgun's muzzle
    # Lockers, grilles, tanks and pipework scattered over the plating, kept clear of the doors and ports.
    clear = lambda c, n: not (abs(n.x) > 0.7 and -0.07 < c.y < 0.11 and c.z > -0.035)
    s.greeble(hp, 0.16, keep=lambda c, n: n.z < 0.5 and c.y < 0.44 and clear(c, n))
    s.greeble(ep, 0.16, m=('hull2', 'lgrey', 'dark'), keep=lambda c, n: n.z < 0.5 and not (abs(n.x) > 0.7 and abs(c.z) < 0.045))
    return s


def battleship():
    """Martian Donnager-class: a long armoured blade, decks stacked on top, hangars below, a bank of drives."""
    s = Ship('battleship', 11)
    hull = [
        (0.500, 0.016, 0.036, 0.007, 0.007),
        (0.450, 0.032, 0.052, 0.013, 0.013),
        (0.260, 0.064, 0.074, 0.022, 0.022),
        (0.000, 0.094, 0.088, 0.030, 0.030),
        (-0.250, 0.114, 0.095, 0.034, 0.034),
        (-0.400, 0.120, 0.098, 0.034, 0.034),
        (-0.445, 0.104, 0.088, 0.030, 0.030),
    ]
    at = lambda y: section_at(hull, y)
    sides, caps = s.loft(hull, 'hull', cell=0.02)
    band(sides, 'trim', 0.30, 0.33)
    band(sides, 'trim', -0.06, -0.035, lambda c: abs(c.z) < 0.05)
    band(sides, 'trim', -0.37, -0.35)
    band(sides, 'hull2', 0.45, 0.5)
    s.paint(caps, 'dark')
    hp = s.plate(sides, accents=[('hull2', 0.22)])
    s.uv_scale = 0.04
    tops = []

    # Decks stacked on the back, ending in the bridge.
    for (y0, y1, w, h, z, m) in [(0.10, -0.34, 0.062, 0.016, 0.100, 'hull'), (-0.02, -0.30, 0.044, 0.012, 0.127, 'hull2'), (-0.10, -0.24, 0.026, 0.012, 0.150, 'hull')]:
        L = y0 - y1
        tier, _ = s.loft([(y0, w * 0.6, h * 0.4, h * 0.3, 0, z - h * 0.6), (y0 - L * 0.12, w, h, h * 0.5, 0, z), (y1 + L * 0.1, w, h, h * 0.5, 0, z), (y1, w * 0.7, h * 0.5, h * 0.3, 0, z - h * 0.5)], m, cell=0.018)
        tops += s.plate(tier, merge=0.5, inset=0.0022, depth=0.001)
        for sx in (1, -1):
            s.windows((sx * (w + 0.0005), y0 - L * 0.16, z + h * 0.2), (sx * (w + 0.0005), y1 + L * 0.14, z + h * 0.2), int(L / 0.011), (sx, 0, 0), s=0.0026)
    s.windows((-0.016, -0.1, 0.155), (0.016, -0.1, 0.155), 6, (0, 1, 0.2), s=0.0026, skip=0)
    s.mast((0, -0.2, 0.16), 0.06)
    s.mast((0.012, -0.22, 0.16), 0.035)
    s.dish((-0.02, -0.26, 0.142), 0.014, aim=(-0.3, -0.2, 1))
    s.dish((0.03, 0.02, 0.118), 0.011, aim=(0.4, 0.4, 1))

    # Hangar deck below: the corvettes ride here.
    hg, _ = s.loft([(0.12, 0.04, 0.008, 0.005, 0.005, -0.092), (0.06, 0.066, 0.02, 0.006, 0.01, -0.104), (-0.30, 0.074, 0.022, 0.006, 0.01, -0.112), (-0.36, 0.05, 0.01, 0.005, 0.005, -0.1)], 'hull2', cell=0.02)
    gp = s.plate(hg, merge=0.5)
    for sx in (1, -1):
        for i in range(4):
            # Each bay mouth stands open, lit blue inside, with a row of marker lights over it.
            y = 0.0 - i * 0.085
            s.box(0.003, 0.05, 0.022, (sx * 0.0745, y, -0.11), 'dark')
            s.pane((sx * 0.0763, y, -0.112), (sx, 0, 0), 0.04, 0.013, m='blue', along=(0, 1, 0), frame=None)
            s.windows((sx * 0.0762, y + 0.02, -0.0975), (sx * 0.0762, y - 0.02, -0.0975), 5, (sx, 0, 0), s=0.0018, m='blue', skip=0)

    for sx in (1, -1):
        # Armour skirts along the flanks.
        sk, _ = s.loft([(0.02, 0.006, 0.03, 0.003, 0.003), (-0.08, 0.012, 0.058, 0.006, 0.006), (-0.40, 0.014, 0.064, 0.006, 0.006), (-0.44, 0.008, 0.04, 0.004, 0.004)], 'hull', cell=0.02, matrix=T((sx * 0.122, 0, 0)))
        band(sk, 'trim', -0.2, -0.18)
        s.greeble(s.plate(sk, merge=0.5, accents=[('hull2', 0.3)]), 0.1, keep=lambda c, n: abs(n.x) > 0.5)
        # Rows of point defence, top and bottom, and windows along the waist.
        for i in range(8):
            y = 0.36 - i * 0.1
            q = at(y)
            x = sx * (q[1] - q[3] * 0.55)
            s.pdc((x, y, q[2] - q[3] * 0.45), 1, s=0.008)
            s.pdc((x, y, -(q[2] - q[4] * 0.45)), -1, s=0.008)
        for z in (0.018, -0.012):
            for (y0, y1) in ((0.2, -0.02), (-0.08, -0.3)):
                a, b = at(y0), at(y1)
                s.windows((sx * (a[1] + 0.001), y0, z), (sx * (b[1] + 0.001), y1, z), 22, (sx, 0, 0), s=0.0024)
        # Torpedo launchers forward.
        for i in range(5):
            y = 0.4 - i * 0.022
            q = at(y)
            s.box(0.004, 0.012, 0.012, (sx * q[1], y, 0.0), 'dark')
        s.rcs((sx * at(0.38)[1], 0.38, 0.028), (sx, 0, 0), s=0.006)
        s.rcs((sx * 0.137, -0.38, 0), (sx, 0, 0), s=0.007)
        s.lamp((sx * 0.138, -0.1, 0), 'green' if sx > 0 else 'red', 0.0035)

    # Main batteries: twin-rail turrets above and below.
    for up in (1, -1):
        for y in (0.2, 0.05) if up > 0 else (0.22,):
            q = at(y)
            z = up * q[2]
            s.cyl(0.026, 0.022, 0.012, (0, y, z + up * 0.006), 'hull2', axis='Z', segs=16)
            s.box(0.03, 0.05, 0.014, (0, y + 0.006, z + up * 0.018), 'dark')
            for dx in (-0.008, 0.008):
                s.cyl(0.0032, 0.0032, 0.13, (dx, y + 0.09, z + up * 0.019), 'dark', segs=8)
                s.cyl(0.0045, 0.0045, 0.012, (dx, y + 0.15, z + up * 0.019), 'hull2', segs=8)

    # Engineering and five drives.
    en, _ = s.loft([(-0.44, 0.102, 0.086, 0.03, 0.03), (-0.462, 0.108, 0.09, 0.03, 0.03), (-0.478, 0.09, 0.076, 0.026, 0.026)], 'hull2', cell=0.02)
    s.greeble(s.plate(en, merge=0.3), 0.25)
    s.bell(0.036, (0, -0.476, 0), name='drive_0', length=0.042)
    for sx in (1, -1):
        for sz in (1, -1):
            s.bell(0.03, (sx * 0.062, -0.476, sz * 0.046), name=f'drive_{sx}_{sz}', length=0.036)
    s.mast((0, 0.5, 0), 0.05, axis=(0, 1, 0))

    # A warship this size is a town: fittings all over the hull (clear of the window rows and the gun
    # turrets), plant on the deck roofs, a radiator bank and sensor towers aft of the bridge.
    s.greeble(hp, 0.12, keep=lambda c, n: not (abs(n.x) > 0.7 and abs(c.z) < 0.03) and not (abs(n.z) > 0.7 and abs(c.x) < 0.035 and c.y > 0.0))
    s.greeble(tops, 0.2, keep=lambda c, n: n.z > 0.7)
    s.greeble(gp, 0.12, keep=lambda c, n: n.z < -0.5)
    for k in range(7):
        s.box(0.0014, 0.06, 0.018, ((k - 3) * 0.011, -0.395, 0.106), 'dark')
    s.box(0.08, 0.004, 0.004, (0, -0.395, 0.1), 'hull2')
    for (x, y, h) in ((0.018, -0.16, 0.03), (-0.016, -0.215, 0.022)):
        s.box(0.008, 0.012, h, (x, y, 0.162 + h / 2), 'hull2')
        s.box(0.014, 0.005, 0.006, (x, y, 0.162 + h), 'dark')
        s.lamp((x, y, 0.166 + h), 'red', 0.0022)
    return s


def hauler():
    """The Canterbury: a retired colony ship hauling ice. Command module, a long spine of cargo cradles, one huge old drive."""
    s = Ship('hauler', 31)
    r = s.rng
    bow, caps = s.loft([(0.500, 0.026, 0.026, 0.01, 0.01), (0.470, 0.05, 0.044, 0.016, 0.016), (0.405, 0.06, 0.05, 0.018, 0.018), (0.372, 0.044, 0.038, 0.014, 0.014)], 'hull', cell=0.018)
    band(bow, 'yellow', 0.43, 0.445)
    s.paint(caps, 'dark')
    s.uv_scale, s.age = 0.04, 1.3
    s.greeble(s.plate(bow, accents=[('rust', 0.12), ('hull2', 0.2)]), 0.12, m=('hull2', 'rust', 'dark'), keep=lambda c, n: abs(n.x) < 0.7 or abs(c.z - 0.012) > 0.012)
    for sx in (1, -1):
        s.windows((sx * 0.0605, 0.46, 0.012), (sx * 0.0605, 0.4, 0.012), 9, (sx, 0, 0), s=0.003)
        s.lamp((sx * 0.062, 0.42, -0.02), 'green' if sx > 0 else 'red', 0.004)
    s.windows((-0.02, 0.492, 0.012), (0.02, 0.492, 0.012), 5, (0, 1, 0.3), s=0.003, skip=0)
    s.dish((0, 0.43, 0.066), 0.022, aim=(0, 0.5, 1))
    s.mast((0.02, 0.4, 0.05), 0.07)
    s.mast((-0.025, 0.41, 0.05), 0.04)

    # Spine.
    s.truss((0, 0.375, 0), (0, -0.30, 0), 0.02, 18)
    s.cyl(0.009, 0.009, 0.68, (0, 0.04, 0), 'hull2', segs=8)
    # Cargo: ice cut from the rings of Saturn, with tanks and old containers mixed in.
    for i in range(7):
        y = 0.325 - i * 0.092
        s.hoop(0.115, 0.004, 0.004, y - 0.046, 'hull2', segs=36)
        for a in range(6):
            ang = a / 6 * math.tau + 0.52
            cx, cz = math.cos(ang) * 0.072, math.sin(ang) * 0.072
            s.strut((cx * 0.3, y, cz * 0.3), (cx * 1.55, y, cz * 1.55), 0.0022, 'dark')
            u = r.random()
            if u < 0.68:
                f = s.ico(0.034, (cx, y, cz), 'ice', sub=2, scale=(0.95 + r.random() * 0.2, 1.15, 0.9 + r.random() * 0.2), rot=(r.random() * 6, r.random() * 6, r.random() * 6))
                s.jitter(f, 0.0045)
            elif u < 0.84:
                s.cyl(0.027, 0.027, 0.07, (cx, y, cz), r.choice(('pale', 'yellow', 'rust')), segs=14)
                s.hoop(0.028, 0.0015, 0.003, y + 0.02, 'dark', segs=14)  # (decorative band at the axis; hidden inside the spine)
            elif u < 0.95:
                s.box(0.05, 0.078, 0.05, (cx, y, cz), r.choice(('rust', 'hull2', 'yellow')), rot=(0, -ang, 0))
    s.hoop(0.115, 0.004, 0.004, 0.371, 'hull2', segs=36)
    for a in range(6):
        ang = a / 6 * math.tau
        s.strut((math.cos(ang) * 0.115, 0.371, math.sin(ang) * 0.115), (math.cos(ang) * 0.115, -0.273, math.sin(ang) * 0.115), 0.002, 'dark')

    # Engineering: reactor housing, tanks, radiators.
    en, _ = s.loft([(-0.285, 0.05, 0.05, 0.02, 0.02), (-0.31, 0.078, 0.078, 0.028, 0.028), (-0.40, 0.084, 0.084, 0.03, 0.03), (-0.435, 0.06, 0.06, 0.022, 0.022)], 'hull', cell=0.02)
    band(en, 'yellow', -0.345, -0.332)
    s.greeble(s.plate(en, accents=[('rust', 0.15), ('hull2', 0.25)]), 0.16, m=('hull2', 'rust', 'dark'), keep=lambda c, n: abs(n.x) < 0.7 or abs(c.z - 0.01) > 0.012)
    for sx in (1, -1):
        s.box(0.19, 0.1, 0.003, (sx * 0.18, -0.36, 0), 'dark')
        for k in range(6):
            s.box(0.19, 0.002, 0.006, (sx * 0.18, -0.315 - k * 0.018, 0), 'hull2')
        s.strut((sx * 0.08, -0.36, 0), (sx * 0.275, -0.36, 0), 0.003, 'hull2')
        s.lamp((sx * 0.276, -0.36, 0), 'window', 0.004)
        for sz in (1, -1):
            s.ball(0.03, (sx * 0.058, -0.37, sz * 0.085), 'pale', u=14, v=8)
            s.bell(0.02, (sx * 0.05, -0.43, sz * 0.05), glow='window', name=f'drive_small_{sx}_{sz}')
        s.windows((sx * 0.0845, -0.33, 0.01), (sx * 0.0845, -0.39, 0.01), 8, (sx, 0, 0), s=0.003)
    s.cyl(0.06, 0.05, 0.03, (0, -0.44, 0), 'dark', segs=20)
    s.bell(0.085, (0, -0.445, 0), glow='window', name='drive_main', length=0.085)
    return s


def tycho():
    """Tycho Station, axis along Z: a sphere, two counter-rotating habitat rings, drives below and the yard on top."""
    s = Ship('tycho', 5)
    r = s.rng
    R = 0.36
    prof = [(max(0.004, R * math.cos(a)), R * math.sin(a)) for a in [(-0.5 + i / 22) * math.pi for i in range(23)]]
    sph = s.lathe(prof, (0, 0, 0), 'pale', segs=56, axis='Z')
    for f in sph:
        c = f.calc_center_median()
        if abs(c.z) < 0.02 or 0.2 < c.z < 0.215 or -0.215 < c.z < -0.2:
            f.material_index = kit.NAMES.index('hull2')
    s.uv_scale = 0.035
    sp = s.plate(sph, merge=0.5, inset=0.0026, depth=0.002, accents=[('hull', 0.22), ('hull2', 0.06)])
    # Plant on the skin: tanks, grilles and housings, thinning out towards the poles.
    s.greeble(sp, 0.09, m=('hull2', 'hull', 'dark'), keep=lambda c, n: 0.03 < abs(c.z) < 0.3 and abs(abs(c.z) - 0.07) > 0.02)
    s.hoop(R + 0.004, 0.008, 0.02, 0, 'hull2', segs=56, axis='Z')
    # Docking bays let into the equator, each mouth lit from inside, and the lights of a working station.
    for i in range(10):
        a = i / 10 * math.tau
        out = Vector((math.cos(a), math.sin(a), 0))
        s.box(0.012, 0.05, 0.022, out * (R + 0.009), 'dark', rot=(0, 0, a))
        s.pane(out * (R + 0.0152), out, 0.04, 0.014, along=(-out.y, out.x, 0), frame=None)
        s.box(0.004, 0.04, 0.003, out * (R + 0.014) + Vector((0, 0, 0.014)), 'window', rot=(0, 0, a))
    for i in range(150):
        lat, lon = math.asin(r.uniform(-0.93, 0.93)), r.random() * math.tau
        n = Vector((math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat)))
        s.windows(n * (R + 0.0022), n * (R + 0.0022), 1, n, s=0.003 + r.random() * 0.002, skip=0)
    s.dish((0.2, 0.12, 0.3), 0.04, aim=(0.5, 0.3, 1))
    for (x, y) in ((-0.15, 0.2), (-0.22, -0.08), (0.1, -0.24)):
        z = math.sqrt(R * R - x * x - y * y)
        s.mast((x, y, z), 0.09 + r.random() * 0.06, r=0.003)

    # Habitat rings.
    for name, z, rad, spin in (('ring_a', 0.07, 0.62, 0), ('ring_b', -0.07, 0.56, 0.26)):
        s.part(name)
        ring = s.hoop(rad, 0.034, 0.026, z, 'pale', segs=84, axis='Z')
        for f in ring:
            c = f.calc_center_median()
            if abs(c.z - z) < 0.001 and c.xy.length > rad:
                f.material_index = kit.NAMES.index('hull2')
        rp = s.plate(ring, merge=0.45, inset=0.003, depth=0.0018, accents=[('hull', 0.2)])
        s.greeble(rp, 0.07, m=('hull2', 'hull'), keep=lambda c, n: abs(n.z) > 0.7 or c.xy.length < rad)
        for i in range(84):
            a = (i + 0.5) / 84 * math.tau
            c, sn = math.cos(a), math.sin(a)
            if r.random() < 0.7:
                s.box(0.003, 0.012, 0.004, (c * (rad + 0.035), sn * (rad + 0.035), z + r.choice((-0.012, 0.0, 0.012))), 'window', rot=(0, 0, a))
            if r.random() < 0.45:
                s.box(0.012, 0.005, 0.003, (c * (rad + r.uniform(-0.02, 0.02)), sn * (rad + r.uniform(-0.02, 0.02)), z + (0.027 if z > 0 else -0.027)), 'window', rot=(0, 0, a))
        for i in range(6):
            a = i / 6 * math.tau + spin
            c, sn = math.cos(a), math.sin(a)
            s.strut((c * R * 0.96, sn * R * 0.96, z), (c * (rad - 0.03), sn * (rad - 0.03), z), 0.011, 'hull2', segs=8)
            s.box(0.05, 0.03, 0.03, (c * (rad - 0.045), sn * (rad - 0.045), z), 'hull', rot=(0, 0, a))
    s.part('body')
    for z in (0.07, -0.07):
        s.hoop(math.sqrt(R * R - z * z) + 0.006, 0.008, 0.012, z, 'dark', segs=56, axis='Z')

    # Drives: Tycho can move itself.
    sk = s.lathe([(0.2, -0.3), (0.27, -0.33), (0.26, -0.44), (0.2, -0.46), (0.1, -0.46), (0.1, -0.3)], (0, 0, 0), 'hull2', segs=40, axis='Z')
    s.greeble(s.plate(sk, merge=0.4), 0.2)
    s.scorches.clear()  # (the bells below are cold: Tycho has not moved in years)
    s.bell(0.07, (0, 0, -0.455), glow='dark', length=0.1, axis='Z')
    for i in range(6):
        a = i / 6 * math.tau
        s.bell(0.045, (math.cos(a) * 0.17, math.sin(a) * 0.17, -0.455), glow='dark', length=0.07, axis='Z')

    # The yard: a gantry cage on the north pole with a hull half built inside it.
    g = 0.13
    for sx in (1, -1):
        for sy in (1, -1):
            s.box(0.012, 0.012, 0.56, (sx * g, sy * g, 0.6), 'trim')
            s.lamp((sx * g, sy * g, 0.89), 'window', 0.01)
    for z in (0.42, 0.57, 0.72, 0.87):
        for sgn in (1, -1):
            s.box(2 * g, 0.008, 0.008, (0, sgn * g, z), 'trim')
            s.box(0.008, 2 * g, 0.008, (sgn * g, 0, z), 'trim')
            if z < 0.8:
                s.strut((-g, sgn * g, z), (g, sgn * g, z + 0.15), 0.003, 'trim')
                s.strut((sgn * g, -g, z + 0.15), (sgn * g, g, z), 0.003, 'trim')
    up = T((0, 0, 0.62)) @ Matrix.Rotation(math.pi / 2, 4, 'X')
    keel = [(0.24, 0.02, 0.02, 0.008, 0.008), (0.18, 0.05, 0.045, 0.018, 0.018), (0.0, 0.075, 0.065, 0.024, 0.024), (-0.18, 0.08, 0.07, 0.024, 0.024), (-0.24, 0.06, 0.05, 0.02, 0.02)]
    hf, hc = s.loft(keel, 'hull', cell=0.022, matrix=up)
    plates = s.plate(hf + hc, merge=0.3, flat=1.0)
    gone = [f for f in plates if f.is_valid and (f.calc_center_median().z > 0.66 and r.random() < 0.75 or r.random() < 0.2)]
    bmesh.ops.delete(s.bm, geom=gone, context='FACES')
    inner, ic = s.loft([(y, w * 0.9, h * 0.9, a * 0.9, b * 0.9) for (y, w, h, a, b) in keel], 'rust', cell=0.03, matrix=up)
    s.plate(inner, merge=0.0, inset=0.006, flat=1.0)
    bmesh.ops.delete(s.bm, geom=[f for f in s.bm.faces if f[s.tmp] == 1 and f.is_valid], context='FACES')
    for sgn in (1, -1):
        s.strut((sgn * g, 0, 0.57), (sgn * 0.07, 0, 0.6), 0.004, 'trim')
        s.strut((0, sgn * g, 0.72), (0, sgn * 0.06, 0.7), 0.004, 'trim')
    s.scorches.clear()
    return s


def tube_sections(pts, k=0.4, squash=1.0):
    """Round-ish sections for lofting: (y, radius) pairs become chamfered squares."""
    return [(y, r, r * squash, r * k, r * k) for (y, r) in pts]


def dreadnought():
    """UN Navy battleship: slab-sided and blocky. Earth builds for armour, not grace."""
    s = Ship('dreadnought', 21)
    s.uv_scale = 0.04
    hull = [(0.500, 0.046, 0.036, 0.008, 0.008), (0.440, 0.066, 0.05, 0.01, 0.01), (0.350, 0.08, 0.06, 0.011, 0.011), (-0.380, 0.086, 0.063, 0.011, 0.011), (-0.435, 0.074, 0.054, 0.01, 0.01)]
    at = lambda y: section_at(hull, y)
    sides, caps = s.loft(hull, 'navy', cell=0.021)
    band(sides, 'pale', 0.27, 0.3)
    band(sides, 'pale', -0.02, 0.0, lambda c: c.z > 0)
    band(sides, 'navy2', 0.44, 0.5)
    s.paint(caps, 'dark')
    s.plate(sides, accents=[('navy2', 0.25)])
    # Citadel: armoured decks amidships with the flag bridge on top.
    for (y0, y1, w, h, z, m) in [(0.22, -0.30, 0.058, 0.014, 0.076, 'navy'), (0.10, -0.24, 0.04, 0.014, 0.103, 'navy2'), (0.0, -0.14, 0.024, 0.012, 0.128, 'navy'), (-0.04, -0.09, 0.012, 0.012, 0.15, 'navy2')]:
        tier, _ = s.loft([(y0, w, h, 0.004, 0, z), (y1, w, h, 0.004, 0, z)], m, cell=0.019)
        s.plate(tier, merge=0.5, inset=0.0022, depth=0.001)
        for sx in (1, -1):
            s.windows((sx * (w + 0.0005), y0 - 0.02, z + 0.003), (sx * (w + 0.0005), y1 + 0.02, z + 0.003), int((y0 - y1) / 0.012), (sx, 0, 0), s=0.0026, m='blue')
    s.mast((0, -0.07, 0.16), 0.07)
    s.dish((0.02, -0.2, 0.118), 0.016, aim=(0.3, -0.3, 1))
    kl, _ = s.loft([(0.3, 0.04, 0.012, 0.004, 0.008, -0.07), (-0.34, 0.05, 0.018, 0.004, 0.01, -0.078)], 'navy2', cell=0.021)
    s.plate(kl, merge=0.5)
    for sx in (1, -1):
        blk, _ = s.loft([(0.16, 0.018, 0.03, 0.006, 0.006), (0.1, 0.03, 0.046, 0.007, 0.007), (-0.36, 0.032, 0.05, 0.007, 0.007), (-0.41, 0.022, 0.036, 0.006, 0.006)], 'navy', cell=0.021, matrix=T((sx * 0.106, 0, -0.006)))
        band(blk, 'pale', -0.1, -0.08)
        s.plate(blk, merge=0.5, accents=[('navy2', 0.3)])
        for i in range(6):
            s.pdc((sx * 0.106, 0.08 - i * 0.085, 0.044), 1, s=0.009)
            s.pdc((sx * 0.106, 0.08 - i * 0.085, -0.056), -1, s=0.009)
        for i in range(4):
            s.pdc((sx * 0.05, 0.44 - i * 0.06, at(0.44 - i * 0.06)[2]), 1, s=0.008)
        s.windows((sx * 0.1385, 0.08, 0.0), (sx * 0.1385, -0.34, 0.0), 34, (sx, 0, 0), s=0.0026, m='blue')
        s.windows((sx * 0.1385, 0.08, -0.02), (sx * 0.1385, -0.34, -0.02), 34, (sx, 0, 0), s=0.0026, m='blue', skip=0.5)
        s.rcs((sx * at(0.4)[1], 0.4, 0), (sx, 0, 0), s=0.007)
        s.rcs((sx * 0.139, -0.38, 0.02), (sx, 0, 0), s=0.007)
        s.lamp((sx * 0.14, -0.05, 0.03), 'green' if sx > 0 else 'red', 0.0035)
        for i in range(4):
            s.box(0.004, 0.014, 0.014, (sx * at(0.4 - i * 0.03)[1], 0.4 - i * 0.03, 0.02), 'dark')
    for y in (0.36, 0.28):
        z = at(y)[2]
        s.cyl(0.03, 0.026, 0.012, (0, y, z + 0.006), 'navy2', axis='Z', segs=16)
        s.box(0.036, 0.05, 0.016, (0, y + 0.004, z + 0.02), 'dark')
        s.cyl(0.005, 0.005, 0.12, (0, y + 0.085, z + 0.021), 'dark', segs=8)
        s.cyl(0.007, 0.007, 0.014, (0, y + 0.14, z + 0.021), 'navy2', segs=8)
    en, _ = s.loft([(-0.43, 0.115, 0.06, 0.012, 0.012), (-0.455, 0.12, 0.064, 0.012, 0.012), (-0.47, 0.1, 0.052, 0.01, 0.01)], 'navy2', cell=0.021)
    s.plate(en, merge=0.3)
    for x in (-0.078, 0, 0.078):
        s.bell(0.04, (x, -0.468, 0), name=f'drive_{x}', length=0.046)
    return s


def racer():
    """The Razorback: a racing pinnace, almost nothing but a drive and a seat."""
    s = Ship('racer', 3)
    s.uv_scale, s.age = 0.12, 0.6
    body = [(0.5, 0.004, 0.004, 0.0015, 0.0015), (0.34, 0.018, 0.016, 0.007, 0.006), (0.1, 0.038, 0.032, 0.015, 0.013), (-0.12, 0.052, 0.043, 0.02, 0.017), (-0.28, 0.062, 0.05, 0.024, 0.02), (-0.345, 0.054, 0.046, 0.022, 0.019)]
    sides, caps = s.loft(body, 'pale', cell=0.02)
    band(sides, 'orange', 0.0, 0.03)
    band(sides, 'orange', -0.3, -0.27)
    s.paint(caps, 'dark')
    s.plate(sides, merge=0.6, inset=0.002, depth=0.0006)
    cp, _ = s.loft([(0.2, 0.008, 0.003, 0.002, 0, 0.026), (0.14, 0.016, 0.009, 0.006, 0, 0.034), (0.06, 0.017, 0.009, 0.006, 0, 0.04), (0.0, 0.01, 0.004, 0.002, 0, 0.04)], 'dark', cell=0.02)
    s.windows((0, 0.19, 0.031), (0, 0.19, 0.031), 1, (0, 0.5, 1), s=0.003, m='glow', skip=0)
    for i in range(3):
        a = i / 3 * math.tau + math.pi / 2
        s.box(0.004, 0.2, 0.12, (math.cos(a) * 0.1, -0.24, math.sin(a) * 0.1), 'orange', rot=(0, -a + math.pi / 2, 0))
        s.box(0.006, 0.05, 0.03, (math.cos(a) * 0.16, -0.31, math.sin(a) * 0.16), 'dark', rot=(0, -a + math.pi / 2, 0))
    for sx in (1, -1):
        s.rcs((sx * 0.03, 0.2, 0), (sx, 0, 0), s=0.004)
        s.lamp((sx * 0.063, -0.25, 0), 'green' if sx > 0 else 'red', 0.003)
    s.cyl(0.05, 0.045, 0.03, (0, -0.35, 0), 'dark', segs=20)
    s.bell(0.092, (0, -0.36, 0), name='drive_main', length=0.11)
    s.mast((0, 0.5, 0), 0.04, r=0.001, axis=(0, 1, 0))
    return s


def freighter():
    """A Belter cargo hauler: bridge block forward, a cage of mismatched containers, drives aft."""
    s = Ship('freighter', 77)
    s.age = 1.3
    r = s.rng
    br, caps = s.loft([(0.5, 0.05, 0.036, 0.012, 0.012), (0.47, 0.07, 0.05, 0.014, 0.014), (0.38, 0.072, 0.052, 0.014, 0.014), (0.355, 0.05, 0.036, 0.012, 0.012)], 'belt', cell=0.018)
    band(br, 'yellow', 0.4, 0.41)
    s.paint(caps, 'dark')
    s.plate(br, accents=[('rust', 0.15), ('belt2', 0.25)])
    s.box(0.09, 0.05, 0.02, (0, 0.44, 0.058), 'belt2')
    s.windows((-0.035, 0.466, 0.06), (0.035, 0.466, 0.06), 7, (0, 1, 0.2), s=0.004, m='blue', skip=0)
    s.dish((0.03, 0.4, 0.062), 0.016, aim=(0.3, 0.3, 1))
    s.mast((-0.03, 0.41, 0.06), 0.06)
    s.truss((0, 0.36, 0), (0, -0.28, 0), 0.016, 16)
    for i in range(6):
        y = 0.3 - i * 0.097
        for (qx, qz) in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
            if r.random() < 0.1:
                continue
            m = r.choice(('rust', 'teal', 'belt', 'yellow', 'belt2', 'pale'))
            cx, cz = qx * 0.05, qz * 0.05
            s.box(0.076, 0.086, 0.076, (cx, y, cz), m)
            for k in (-0.03, 0, 0.03):
                s.box(0.08, 0.004, 0.08, (cx, y + k, cz), 'belt2')
            s.box(0.03, 0.002, 0.04, (cx + qx * 0.0385, y, cz), 'belt2', rot=(0, 0, math.pi / 2))
    for y in (0.345, -0.27):
        s.box(0.22, 0.012, 0.012, (0, y, 0), 'yellow')
        s.box(0.012, 0.012, 0.22, (0, y, 0), 'yellow')
    en, _ = s.loft([(-0.28, 0.06, 0.05, 0.014, 0.014), (-0.3, 0.082, 0.07, 0.016, 0.016), (-0.38, 0.084, 0.072, 0.016, 0.016), (-0.405, 0.066, 0.056, 0.014, 0.014)], 'belt', cell=0.019)
    s.plate(en, accents=[('rust', 0.2), ('belt2', 0.25)])
    for sx in (1, -1):
        s.box(0.14, 0.09, 0.003, (sx * 0.155, -0.34, 0), 'dark')
        for k in range(5):
            s.box(0.14, 0.002, 0.006, (sx * 0.155, -0.305 - k * 0.018, 0), 'belt2')
        s.bell(0.046, (sx * 0.044, -0.405, 0), glow='window', name=f'drive_{sx}', length=0.055)
        s.lamp((sx * 0.074, 0.47, 0.03), 'window', 0.004)
        s.lamp((sx * 0.226, -0.34, 0), 'green' if sx > 0 else 'red', 0.004)
        s.windows((sx * 0.0845, -0.31, 0.02), (sx * 0.0845, -0.37, 0.02), 6, (sx, 0, 0), s=0.003)
    return s


def stealth():
    """Amun-Ra-class stealth frigate: faceted, black, nothing proud of the hull, no lights."""
    s = Ship('stealth', 13)
    s.age = 0.4
    body = [(0.5, 0.005, 0.004, 0.003, 0.003), (0.18, 0.09, 0.034, 0.03, 0.03), (-0.18, 0.168, 0.046, 0.04, 0.04), (-0.38, 0.132, 0.04, 0.034, 0.034), (-0.46, 0.06, 0.024, 0.02, 0.02)]
    sides, caps = s.loft(body, 'black', cell=0.06, smooth=False)
    s.plate(sides + caps, merge=0.0, inset=0.0018, depth=0.0, flat=1.0)
    up, _ = s.loft([(0.1, 0.02, 0.004, 0.003, 0, 0.034), (-0.1, 0.05, 0.016, 0.014, 0, 0.05), (-0.3, 0.04, 0.012, 0.01, 0, 0.046), (-0.38, 0.015, 0.004, 0.003, 0, 0.038)], 'black', cell=0.07, smooth=False)
    for sx in (1, -1):
        s.box(0.1, 0.16, 0.005, (sx * 0.17, -0.3, 0), 'black', rot=(0, 0, sx * -0.5))
    s.cyl(0.03, 0.026, 0.02, (0, -0.462, 0), 'black', segs=6)
    s.empty('drive_main', (0, -0.472, 0), 0.04)
    return s


def survey():
    """A corporate survey and colony ship: long white hull, spin section, dishes, shuttle bay."""
    s = Ship('survey', 41)
    s.uv_scale, s.age = 0.05, 0.7
    body = tube_sections([(0.5, 0.018), (0.44, 0.04), (0.3, 0.05), (-0.1, 0.064), (-0.34, 0.068), (-0.37, 0.05)])
    sides, caps = s.loft(body, 'pale', cell=0.019)
    band(sides, 'rce', 0.2, 0.245)
    band(sides, 'rce', -0.3, -0.285)
    s.paint(caps, 'dark')
    s.plate(sides, merge=0.5, inset=0.0024, depth=0.001, accents=[('hull', 0.08)])
    # Spin section.
    ring = s.hoop(0.16, 0.02, 0.018, 0.02, 'pale', segs=48)
    s.plate(ring, merge=0.4, inset=0.0024, depth=0.001)
    for i in range(48):
        a = (i + 0.5) / 48 * math.tau
        if s.rng.random() < 0.6:
            s.box(0.003, 0.012, 0.004, (math.cos(a) * 0.1808, 0.02, math.sin(a) * 0.1808), 'window', rot=(0, -a, 0))
    for i in range(4):
        a = i / 4 * math.tau + 0.4
        s.strut((math.cos(a) * 0.05, 0.02, math.sin(a) * 0.05), (math.cos(a) * 0.142, 0.02, math.sin(a) * 0.142), 0.006, 'hull2', segs=8)
    s.dish((0, 0.3, 0.07), 0.05, aim=(0, 0.4, 1))
    s.dish((0.02, -0.2, -0.085), 0.024, aim=(0.3, 0.2, -1))
    s.mast((0, 0.5, 0), 0.16, r=0.002, axis=(0, 1, 0))
    bay, _ = s.loft([(-0.06, 0.03, 0.01, 0.004, 0.006, -0.062), (-0.1, 0.05, 0.026, 0.006, 0.012, -0.076), (-0.24, 0.05, 0.026, 0.006, 0.012, -0.08), (-0.28, 0.03, 0.012, 0.004, 0.006, -0.068)], 'hull', cell=0.019)
    s.plate(bay, merge=0.5)
    s.box(0.06, 0.05, 0.003, (0, -0.17, -0.106), 'dark')
    en, _ = s.loft([(-0.36, 0.06, 0.05, 0.016, 0.016), (-0.38, 0.09, 0.07, 0.02, 0.02), (-0.44, 0.092, 0.072, 0.02, 0.02), (-0.46, 0.07, 0.056, 0.016, 0.016)], 'pale', cell=0.019)
    band(en, 'rce', -0.415, -0.4)
    s.plate(en, merge=0.4, accents=[('hull', 0.2)])
    for sx in (1, -1):
        s.box(0.2, 0.12, 0.003, (sx * 0.19, -0.41, 0), 'dark')
        for k in range(7):
            s.box(0.2, 0.002, 0.006, (sx * 0.19, -0.36 - k * 0.017, 0), 'hull2')
        s.lamp((sx * 0.291, -0.41, 0), 'green' if sx > 0 else 'red', 0.004)
        s.windows((sx * 0.0565, 0.16, 0.012), (sx * 0.064, -0.08, 0.012), 16, (sx, 0, 0), s=0.003)
        s.bell(0.04, (sx * 0.046, -0.46, 0), name=f'drive_{sx}', length=0.05)
        s.rcs((sx * 0.047, 0.4, 0), (sx, 0, 0), s=0.006)
    return s


def medina():
    """Medina Station, once the Nauvoo: a spinning drum between a command bow and the drive."""
    s = Ship('medina', 9)
    s.uv_scale = 0.035
    r = s.rng
    R = 0.125
    s.part('drum')
    ys = [0.28 - i * 0.028 for i in range(21)]
    prof = [(R, y) for y in ys] + [(R - 0.012, ys[-1]), (R - 0.012, ys[0])]
    drum = s.lathe(prof, (0, 0, 0), 'pale', segs=40)
    outer = [f for f in drum if Vector((f.calc_center_median().x, 0, f.calc_center_median().z)).length > R * 0.985]
    for f in outer:
        if round((f.calc_center_median().y + 0.28) / 0.028) % 5 == 0:
            f.material_index = kit.NAMES.index('hull2')
    s.plate(outer, merge=0.5, inset=0.0024, depth=0.0014, accents=[('hull', 0.2)])
    for i in range(9):
        s.hoop(R + 0.003, 0.003, 0.004, -0.262 + i * 0.0655, 'hull2', segs=40)
    for i in range(110):
        a, y = r.random() * math.tau, r.uniform(-0.26, 0.26)
        n = Vector((math.cos(a), 0, math.sin(a)))
        s.windows(n * (R + 0.0022) + Vector((0, y, 0)), n * (R + 0.0022) + Vector((0, y, 0)), 1, n, s=0.003, skip=0)
    s.part('body')
    # Command bow.
    bow = s.lathe([(0.112, 0.282), (0.112, 0.3), (0.06, 0.38), (0.052, 0.4), (0.045, 0.425), (0.028, 0.445), (0.004, 0.452), (0.004, 0.282)], (0, 0, 0), 'pale', segs=32)
    s.plate([f for f in bow if 0.3 < f.calc_center_median().y < 0.38], merge=0.3, inset=0.0024, depth=0.0012, accents=[('hull', 0.25)])
    s.hoop(0.058, 0.005, 0.012, 0.39, 'gold', segs=32)
    s.mast((0, 0.45, 0), 0.12, r=0.002, axis=(0, 1, 0))
    for i in range(24):
        a = i / 24 * math.tau
        s.box(0.003, 0.006, 0.003, (math.cos(a) * 0.0535, 0.412, math.sin(a) * 0.0535), 'window', rot=(0, -a, 0))
    for sx in (1, -1):
        s.box(0.02, 0.07, 0.02, (sx * 0.07, 0.42, 0), 'hull')
        s.dish((sx * 0.07, 0.46, 0), 0.016, aim=(sx * 0.3, 1, 0.2))
        s.lamp((sx * 0.155, -0.33, 0), 'green' if sx > 0 else 'red', 0.005)
    # Engineering and the drive.
    aft = s.lathe([(0.112, -0.282), (0.112, -0.3), (0.092, -0.36), (0.07, -0.375), (0.004, -0.375), (0.004, -0.282)], (0, 0, 0), 'hull2', segs=32)
    s.plate([f for f in aft if -0.36 < f.calc_center_median().y < -0.3], merge=0.3)
    s.box(0.3, 0.05, 0.016, (0, -0.33, 0), 'dark')
    s.box(0.016, 0.05, 0.3, (0, -0.33, 0), 'dark')
    s.hoop(0.114, 0.004, 0.008, -0.292, 'gold', segs=32)
    s.bell(0.03, (0, -0.375, 0), glow='dark', name='idle_0')
    for sx in (1, -1):
        for sz in (1, -1):
            s.bell(0.028, (sx * 0.05, -0.375, sz * 0.05), glow='dark', name=f'idle_{sx}_{sz}')
    return s


def player():
    """Your own ship: an original design, a fast courier with swept wings and one big drive."""
    s = Ship('player', 2)
    body = [(0.79, 0.014, 0.012, 0.006, 0.005), (0.62, 0.058, 0.048, 0.024, 0.02), (0.45, 0.098, 0.083, 0.04, 0.034), (0.0, 0.13, 0.11, 0.052, 0.042), (-0.44, 0.158, 0.134, 0.06, 0.05), (-0.5, 0.136, 0.116, 0.052, 0.044)]
    at = lambda y: section_at(body, y)
    sides, caps = s.loft(body, 'steel', cell=0.036)
    band(sides, 'orange', 0.19, 0.25)
    band(sides, 'hull2', -0.08, -0.03)
    band(sides, 'orange', -0.44, -0.4, lambda c: c.z > 0)
    s.paint(caps, 'dark')
    s.uv_scale = 0.14
    hp = s.plate(sides, inset=0.004, depth=0.0024, accents=[('hull2', 0.18)])
    # Cockpit.
    cp, _ = s.loft([(0.58, 0.02, 0.006, 0.004, 0, 0.05), (0.5, 0.044, 0.022, 0.014, 0, 0.076), (0.36, 0.05, 0.024, 0.014, 0, 0.094), (0.3, 0.03, 0.008, 0.004, 0, 0.096)], 'dark', cell=0.03)
    s.box(0.07, 0.11, 0.004, (0, 0.445, 0.102), 'glow', rot=(-0.16, 0, 0))
    # Dorsal spine and tail fin.
    sp, _ = s.loft([(0.05, 0.03, 0.01, 0.006, 0, 0.115), (-0.05, 0.05, 0.03, 0.014, 0, 0.135), (-0.3, 0.05, 0.03, 0.014, 0, 0.155), (-0.36, 0.03, 0.012, 0.006, 0, 0.15)], 'steel', cell=0.036)
    s.plate(sp, merge=0.5, inset=0.004, depth=0.002)
    fin, _ = s.loft([(-0.16, 0.005, 0.02, 0.002, 0.002, 0.19), (-0.26, 0.007, 0.1, 0.003, 0.003, 0.27), (-0.42, 0.007, 0.1, 0.003, 0.003, 0.28), (-0.44, 0.005, 0.07, 0.002, 0.002, 0.3)], 'hull2', cell=0.04)
    s.box(0.016, 0.2, 0.036, (0, -0.33, 0.37), 'orange')
    s.lamp((0, -0.42, 0.392), 'window', 0.008)
    s.dish((0, 0.05, 0.19), 0.06, aim=(0, 0.3, 1), m='steel')
    for sx in (1, -1):
        # Engine nacelles and swept wings.
        nc, _ = s.loft([(0.2, 0.012, 0.012, 0.005, 0.005), (0.1, 0.04, 0.04, 0.016, 0.016), (-0.44, 0.046, 0.046, 0.018, 0.018), (-0.47, 0.036, 0.036, 0.014, 0.014)], 'steel', cell=0.036, matrix=T((sx * 0.23, 0, -0.01)))
        band(nc, 'orange', -0.1, -0.06)
        s.greeble(s.plate(nc, merge=0.5, inset=0.004, depth=0.002, accents=[('hull2', 0.2)]), 0.14, keep=lambda c, n: c.y < 0.05)
        s.box(0.09, 0.22, 0.03, (sx * 0.15, -0.2, -0.005), 'hull2')
        s.bell(0.042, (sx * 0.23, -0.47, -0.01), name=f'drive_small_{sx}', length=0.05)
        wing = s.box(0.36, 0.26, 0.014, (sx * 0.41, -0.3, -0.012), 'orange', rot=(0, 0, sx * -0.35))
        s.box(0.3, 0.04, 0.018, (sx * 0.4, -0.2, -0.012), 'hull2', rot=(0, 0, sx * -0.35))
        s.box(0.3, 0.14, 0.004, (sx * 0.4, -0.12, 0.06), 'dark', rot=(0, -sx * 0.5, 0))
        s.lamp((sx * 0.585, -0.36, -0.01), 'green' if sx > 0 else 'red', 0.012)
        s.pdc((sx * 0.07, 0.1, at(0.1)[2] - 0.012), 1, s=0.016)
        s.windows((sx * (at(0.3)[1] + 0.001), 0.3, 0.03), (sx * (at(0.0)[1] + 0.001), 0.0, 0.03), 6, (sx, 0, 0), s=0.008)
        s.rcs((sx * at(0.55)[1], 0.55, 0), (sx, 0, 0), s=0.012)
    s.mast((0, 0.79, 0), 0.26, r=0.005, axis=(0, 1, 0))
    s.cyl(0.14, 0.12, 0.05, (0, -0.5, 0), 'dark', segs=24)
    s.bell(0.2, (0, -0.47, 0), name='drive_main', length=0.19)
    # You walk right up to this one in the docking bays: an airlock with its ladder on the port side,
    # a service hatch to starboard, and fittings on the hull clear of the cockpit and the cabin ports.
    q = at(-0.2)
    s.box(0.004, 0.11, 0.12, (-q[1] + 0.001, -0.2, -0.005), 'yellow')
    s.hatch((-q[1] - 0.0015, -0.2, -0.005), (-1, 0, 0), 0.1, 0.085, m='steel', lit=True)
    s.rungs((-q[1] - 0.002, -0.275, -0.07), (-q[1] - 0.002, -0.275, 0.06), (-1, 0, 0), n=7, w=0.03, r=0.002)
    s.hatch((q[1] + 0.0015, -0.2, 0.0), (1, 0, 0), 0.08, 0.12, m='hull2')
    s.greeble(hp, 0.09, m=('hull2', 'dark', 'steel'), keep=lambda c, n: c.y < 0.3 and not (abs(n.x) > 0.7 and (c.y > -0.05 and abs(c.z - 0.03) < 0.03 or -0.3 < c.y < -0.1)) and not (n.z > 0.5 and c.y > -0.4))
    return s


BUILD = {'corvette': corvette, 'battleship': battleship, 'hauler': hauler, 'tycho': tycho, 'dreadnought': dreadnought, 'racer': racer,
         'freighter': freighter, 'stealth': stealth, 'survey': survey, 'medina': medina, 'player': player}



def pack(path):
    """Squeeze the exported file to about a third: whole-number coordinates and meshopt compression
    (glTF-Transform, fetched by bunx). The game's loader unpacks it; nothing visible changes."""
    before = os.path.getsize(path)
    try:
        subprocess.run(['bunx', '@gltf-transform/cli@4.5.1', 'meshopt', path, path, '--level', 'medium'], check=True, capture_output=True, timeout=300)
        print(f'packed {os.path.basename(path)}: {before // 1024} KB -> {os.path.getsize(path) // 1024} KB')
    except Exception as e:
        print('not packed (the file still loads, it is just larger):', e)


# Where to stand for a third, close-up still of each ship.
CLOSE = {
    'corvette': ((0.42, 0.34, 0.2), (0.1, 0.05, 0.04)),
    'battleship': ((0.3, -0.05, 0.22), (0.05, -0.15, 0.08)),
    'player': ((0.55, 0.75, 0.3), (0.05, 0.25, 0.05)),
    'tycho': ((0.75, -0.6, 0.3), (0.3, 0.0, 0.05)),
    'hauler': ((0.3, 0.75, 0.16), (0.0, 0.42, 0.0)),
}

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['all']
which = list(BUILD) if argv[0] == 'all' else argv[0].split(',')
prev = argv[argv.index('--preview') + 1] if '--preview' in argv else None
for name in which:
    reset()
    ship = BUILD[name]()
    objs = ship.finish()
    print(name, 'tris ~', sum(len(p.vertices) - 2 for o in objs for p in o.data.polygons))
    if '--noao' not in argv:
        bake_ao(objs)
        weather(objs, ship)
    export(os.path.join(ROOT, 'assets', 'models', name + '.glb'))
    if '--nopack' not in argv:
        pack(os.path.join(ROOT, 'assets', 'models', name + '.glb'))
    if prev:
        far = ((1.6, -1.5, 0.9), (-1.5, 1.7, -0.6)) if name in ('tycho', 'player') else ((1.25, -1.15, 0.7), (-1.1, 1.3, -0.45))
        preview(os.path.join(prev, name), views=far + ((CLOSE[name],) if name in CLOSE else ()))
