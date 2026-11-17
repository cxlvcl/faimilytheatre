"""Frames for /canvas, one GLB per painting, built and baked in Blender.

Each frame is a moulding profile swept around the painting (mitred corners), with carved details:
bead rows, corner rosettes, shells and roundels as geometry, fine ornament (acanthus, punchwork,
ripple, reeding, Klimt's incised pattern) as normal maps. Ambient occlusion is baked by Cycles into
vertex colours, so recesses stay dark on the page without any lighting cost.

Units: painting height = 1. Blender: X right, Z up, the painting in the XZ plane facing −Y
(the glTF exporter turns this into the page's XY plane facing +Z).

Run: Blender -b -P canvas/blender/frames.py -- <out dir> [<preview dir>] [slug ...]
"""
import json
import math
import os
import sys

import bmesh
import bpy
import numpy as np

args = sys.argv[sys.argv.index("--") + 1:]
OUT = args[0]
PREVIEW = args[1] if len(args) > 1 and args[1] != "-" else None
ONLY = set(args[2:])
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = json.load(open(os.path.join(ROOT, "data/paintings.json"), encoding="utf-8"))
CACHE = os.path.join(ROOT, ".cache/polyhaven")
TEXTURES = os.path.join(OUT, "textures")
os.makedirs(TEXTURES, exist_ok=True)

LIP = 0.008          # the frame covers this much of the painting's edge
BACK = 0.045         # back of the frame behind the painting surface
PERIODS = {"acanthus": 0.11, "punch": 0.16, "ripple": 0.014, "reed": 0.5, "klimt": 0.12}
SLOTS = ["gold", "gold_old", "gold_acanthus", "gold_punch", "gold_reed", "gold_klimt",
         "lacquer", "lacquer_ripple", "wood_dark", "wood_oak", "back"]


# ---------------------------------------------------------------- profiles
class Profile:
    """Cross-section from the sight edge (d = 0) to the outer edge (d = 1); h is the height
    above the painting. Both in units of the frame width. Segments meet at a crease."""

    def __init__(self, d, h):
        self.segments = []
        self.pen = (d, h)

    def _add(self, points, slot, ornament=None):
        self.segments.append({"points": points, "slot": slot, "ornament": ornament})
        self.pen = points[-1]
        return self

    def _quad(self, control, end, slot, n):
        (d0, h0), (cd, ch), (d1, h1) = self.pen, control, end
        points = []
        for i in range(n + 1):
            t = i / n
            points.append(((1 - t) ** 2 * d0 + 2 * (1 - t) * t * cd + t * t * d1,
                           (1 - t) ** 2 * h0 + 2 * (1 - t) * t * ch + t * t * h1))
        return self._add(points, slot)

    def line(self, d, h, slot):
        return self._add([self.pen, (d, h)], slot)

    def round(self, d, h, slot, n=8):
        """Convex quarter round (a torus seen in section)."""
        d0, h0 = self.pen
        return self._quad((d0, h) if h > h0 else (d, h0), (d, h), slot, n)

    def cove(self, d, h, slot, n=8):
        """Concave hollow."""
        d0, h0 = self.pen
        return self._quad((d, h0) if h > h0 else (d0, h), (d, h), slot, n)

    def bead(self, d, height, slot, n=10):
        d0, h0 = self.pen
        return self._add([(d0 + (d - d0) * i / n, h0 + height * math.sin(math.pi * i / n)) for i in range(n + 1)], slot)

    def ogee(self, d, h, slot, n=14):
        d0, h0 = self.pen
        c1, c2 = (d0 + (d - d0) * 0.6, h0), (d0 + (d - d0) * 0.4, h)
        points = []
        for i in range(n + 1):
            t = i / n
            a, b, c, e = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t * t, t ** 3
            points.append((a * d0 + b * c1[0] + c * c2[0] + e * d, a * h0 + b * c1[1] + c * c2[1] + e * h))
        return self._add(points, slot)

    def height_at(self, d):
        best = None
        for segment in self.segments:
            for (d0, h0), (d1, h1) in zip(segment["points"], segment["points"][1:]):
                if min(d0, d1) <= d <= max(d0, d1) and d1 != d0:
                    h = h0 + (h1 - h0) * (d - d0) / (d1 - d0)
                    best = h if best is None else max(best, h)
        return best or 0.0


def style_profile(style):
    """Profile, side material and ornaments of each frame style."""
    o = []
    if style == "florentine":  # Renaissance cassetta: gilded mouldings around a flat punched frieze
        p = Profile(0, 0.06)
        p.round(0.045, 0.15, "gold").bead(0.1, 0.06, "gold").line(0.12, 0.15, "gold")
        p.cove(0.19, 0.09, "gold").line(0.21, 0.09, "gold_old").line(0.77, 0.09, "gold_punch")
        p.line(0.79, 0.09, "gold_old").cove(0.85, 0.22, "gold").round(0.93, 0.4, "gold").round(1.0, 0.24, "gold")
        o += [("rosettes", 0.49, 0.25, 0.16, "gold", True)]
        return p, "gold_old", o
    if style == "salon":  # 19th-century gilt frame: bead row, hollow, acanthus ogee, corner shells
        p = Profile(0, 0.05)
        p.round(0.04, 0.12, "gold").line(0.12, 0.12, "gold_old").round(0.145, 0.17, "gold")
        p.cove(0.3, 0.35, "gold").round(0.34, 0.4, "gold").ogee(0.8, 0.66, "gold_acanthus")
        p.round(0.9, 0.73, "gold").round(1.0, 0.48, "gold")
        o += [("beads", 0.08, 0.12, 0.028, "gold"), ("shells", 0.57, 0.3, "gold")]
        return p, "gold_old", o
    if style == "dutch":  # 17th-century Dutch ebonised frame with ripple mouldings
        p = Profile(0, 0.05)
        p.round(0.05, 0.12, "lacquer").cove(0.18, 0.24, "lacquer_ripple").round(0.24, 0.3, "lacquer")
        p.line(0.5, 0.34, "lacquer_ripple").round(0.6, 0.42, "lacquer").ogee(0.92, 0.62, "lacquer_ripple")
        p.round(1.0, 0.46, "lacquer")
        return p, "lacquer", o
    if style == "rossetti":  # Rossetti's flat gilded oak frame: reeded bands, roundels in the corners
        p = Profile(0, 0.04)
        p.round(0.04, 0.1, "gold").line(0.2, 0.1, "gold_reed").round(0.23, 0.14, "gold")
        p.line(0.84, 0.14, "gold_old").round(0.87, 0.1, "gold").line(0.97, 0.1, "gold_reed").round(1.0, 0.05, "gold")
        o += [("roundels", 0.535, 0.27, 0.1, "gold")]
        return p, "gold_old", o
    if style == "russian":  # dark carved wood with a gilded sight edge
        p = Profile(0, 0.05)
        p.round(0.04, 0.12, "gold").bead(0.12, 0.06, "gold").line(0.15, 0.12, "gold_old")
        p.round(0.18, 0.18, "wood_dark").cove(0.42, 0.38, "wood_dark").line(0.7, 0.4, "wood_dark")
        p.round(0.85, 0.46, "wood_dark").round(1.0, 0.3, "wood_dark")
        o += [("beads", 0.08, 0.12, 0.03, "gold")]
        return p, "wood_dark", o
    if style == "plain":  # simple gilt
        p = Profile(0, 0.06)
        p.round(0.08, 0.18, "gold").cove(0.3, 0.3, "gold").round(0.6, 0.5, "gold").round(1.0, 0.3, "gold")
        return p, "gold_old", o
    if style == "modern":  # narrow black frame
        p = Profile(0, 0.6)
        p.round(0.15, 0.9, "lacquer").line(0.85, 0.9, "lacquer").round(1.0, 0.7, "lacquer")
        return p, "lacquer", o
    if style == "klimt":  # flat gold with an incised pattern
        p = Profile(0, 0.05)
        p.round(0.05, 0.14, "gold").line(0.09, 0.14, "gold_old").line(0.91, 0.14, "gold_klimt")
        p.round(0.96, 0.2, "gold").round(1.0, 0.08, "gold")
        return p, "gold_old", o
    if style == "oak":  # light natural wood
        p = Profile(0, 0.05)
        p.round(0.06, 0.14, "wood_oak").cove(0.3, 0.3, "wood_oak").line(0.8, 0.34, "wood_oak").round(1.0, 0.2, "wood_oak")
        return p, "wood_oak", o
    raise ValueError(style)


# ---------------------------------------------------------------- geometry
SIDES = [((1, 0), (0, 1)), ((0, 1), (-1, 0)), ((-1, 0), (0, -1)), ((0, -1), (1, 0))]


class Builder:
    def __init__(self):
        self.verts, self.faces, self.uvs, self.mats = [], [], [], []

    def grid(self, rows, slot, uv_rows):
        """rows: list of lists of (x, y, z); quads between consecutive rows and columns."""
        base = len(self.verts)
        cols = len(rows[0])
        for row, uv_row in zip(rows, uv_rows):
            self.verts.extend(row)
            self.uvs.extend(uv_row)
        for i in range(len(rows) - 1):
            for j in range(cols - 1):
                a = base + i * cols + j
                self.faces.append((a, a + cols, a + cols + 1, a + 1))
                self.mats.append(SLOTS.index(slot))

    def add_mesh(self, verts, faces, slot, uvs=None):
        base = len(self.verts)
        self.verts.extend(verts)
        self.uvs.extend(uvs or [(0, 0)] * len(verts))
        for face in faces:
            self.faces.append(tuple(base + i for i in face))
            self.mats.append(SLOTS.index(slot))


def sweep(builder, profile, side_slot, W, H, b):
    """Profile around the opening (half sizes W, H), plus the frame's outer side, back and rebate."""
    first, last = profile.segments[0]["points"][0], profile.segments[-1]["points"][-1]
    back = -BACK / b
    segments = list(profile.segments) + [
        {"points": [last, (1.0, back)], "slot": side_slot},
        {"points": [(1.0, back), (0.0, back)], "slot": "back"},
        {"points": [(0.0, back), (0.0, 0.0)], "slot": "back"},
        {"points": [(0.0, 0.0), first], "slot": side_slot},
    ]
    for (ox, oz), (ex, ez) in SIDES:
        half_o, half_e = (W, H) if ox else (H, W)
        # Rings close together near the corners (where the occlusion changes), sparse along the middle.
        extent_max = half_e + b
        zone = min(0.16, extent_max * 0.45)
        marks = [i / 6 * zone for i in range(7)]
        middle = max(1, int((2 * extent_max - 2 * zone) / 0.14))
        marks += [zone + (2 * extent_max - 2 * zone) * i / middle for i in range(1, middle)]
        marks += [2 * extent_max - m for m in reversed(marks[:7])]
        ts = [m / (2 * extent_max) for m in marks]
        for segment in segments:
            points = segment["points"]
            slot = segment["slot"]
            kind = slot.split("_")[-1]
            period = PERIODS.get(kind)
            lengths = [0.0]
            for (d0, h0), (d1, h1) in zip(points, points[1:]):
                lengths.append(lengths[-1] + math.hypot(d1 - d0, h1 - h0) * b)
            total = lengths[-1] or 1.0
            rows, uv_rows = [], []
            for (d, h), along_profile in zip(points, lengths):
                r = d * b
                extent = half_e + r
                row, uv_row = [], []
                for t in ts:
                    s = -extent + 2 * extent * t
                    x = ox * (half_o + r) + ex * s
                    z = oz * (half_o + r) + ez * s
                    row.append((x, -h * b, z))
                    # Ornament: repeats along the side, spans the segment across; wood: grain along the side.
                    uv_row.append((s / period, along_profile / total) if period else (s / 0.5, (d * b + 0.3 * along_profile) / 0.5))
                rows.append(row)
                uv_rows.append(uv_row)
            builder.grid(rows, slot, uv_rows)


def surface_y(profile, b, d):
    return -profile.height_at(d) * b


def corners(W, H, r):
    return [(sx * (W + r), sz * (H + r), sx, sz) for sx in (1, -1) for sz in (1, -1)]


def polar(builder, cx, cz, y0, radius, height, fn, slot, rings=10, segs=40, angle=(0.0, 2 * math.pi), rotate=0.0):
    """A carved boss on a flat or gently curved surface: heights from fn(rho, theta)."""
    verts, uvs = [], []
    full = abs(angle[1] - angle[0] - 2 * math.pi) < 1e-6
    count = segs if full else segs + 1
    verts.append((cx, y0 - height * fn(0.0, 0.0), cz))
    for i in range(1, rings + 1):
        rho = i / rings
        for j in range(count):
            th = angle[0] + (angle[1] - angle[0]) * j / segs
            x = cx + radius * rho * math.cos(th + rotate)
            z = cz + radius * rho * math.sin(th + rotate)
            verts.append((x, y0 - height * fn(rho, th), z))
    faces = []
    for j in range(segs):
        j2 = (j + 1) % count
        faces.append((0, 1 + j2, 1 + j))
    for i in range(rings - 1):
        a0, a1 = 1 + i * count, 1 + (i + 1) * count
        for j in range(segs):
            j2 = (j + 1) % count
            faces.append((a0 + j, a0 + j2, a1 + j2, a1 + j))
    builder.add_mesh(verts, faces, slot)


def ellipsoid(builder, center, axes, slot, u=10, v=7):
    cx, cy, cz = center
    ax, ay, az = axes
    verts = [(cx, cy - ay, cz)]  # front pole (toward the viewer)
    for i in range(1, v):
        phi = math.pi * i / v
        for j in range(u):
            th = 2 * math.pi * j / u
            verts.append((cx + ax * math.sin(phi) * math.cos(th), cy - ay * math.cos(phi), cz + az * math.sin(phi) * math.sin(th)))
    verts.append((cx, cy + ay, cz))
    faces = []
    for j in range(u):
        faces.append((0, 1 + (j + 1) % u, 1 + j))
    for i in range(v - 2):
        a, c = 1 + i * u, 1 + (i + 1) * u
        for j in range(u):
            faces.append((a + j, a + (j + 1) % u, c + (j + 1) % u, c + j))
    last = len(verts) - 1
    base = 1 + (v - 2) * u
    for j in range(u):
        faces.append((base + j, base + (j + 1) % u, last))
    builder.add_mesh(verts, faces, slot)


def ornaments(builder, profile, items, W, H, b):
    for item in items:
        kind = item[0]
        if kind == "beads":
            _, d, h, radius, slot = item
            r, rad = d * b, max(radius * b, 0.0045)
            spacing = rad * 3.2
            for (ox, oz), (ex, ez) in SIDES:
                half_o, half_e = (W, H) if ox else (H, W)
                extent = half_e + r
                n = max(2, int(2 * extent / spacing))
                for k in range(n):
                    s = -extent + (k + 0.5) * 2 * extent / n
                    x, z = ox * (half_o + r) + ex * s, oz * (half_o + r) + ez * s
                    along = (abs(ex) * rad * 1.25, rad, abs(ez) * rad * 1.25)
                    ellipsoid(builder, (x, -h * b, z), (along[0] or rad * 0.9, rad * 0.95, along[2] or rad * 0.9), slot, u=8, v=5)
                    # The reel between two beads.
                    s2 = s + extent / n
                    if k < n - 1:
                        x2, z2 = ox * (half_o + r) + ex * s2, oz * (half_o + r) + ez * s2
                        ellipsoid(builder, (x2, -h * b, z2), (abs(ex) * rad * 0.35 or rad * 0.6, rad * 0.6, abs(ez) * rad * 0.35 or rad * 0.6), slot, u=6, v=4)
        elif kind == "rosettes":
            _, d, radius, height, slot, mid = item
            r, rad = d * b, radius * b
            y0 = surface_y(profile, b, d) + 0.0015

            def flower(rho, th):
                petals = 0.72 + 0.28 * math.cos(8 * th)
                dome = max(0.0, 1 - rho * rho / max(petals, 0.3)) ** 0.6
                button = 0.6 * max(0.0, 1 - (rho / 0.28) ** 2) ** 0.5
                return dome * (0.75 + 0.25 * math.cos(math.pi * rho * 3) ** 2) + button

            spots = [(x, z) for x, z, _, _ in corners(W, H, r)]
            if mid:
                spots += [(W + r, 0), (-W - r, 0), (0, H + r), (0, -H - r)]
            for x, z in spots:
                polar(builder, x, z, y0, rad, height * b, flower, slot, rings=9, segs=48)
        elif kind == "shells":
            _, d, radius, slot = item
            r, rad = d * b, radius * b
            y0 = surface_y(profile, b, d) + 0.002

            def shell(rho, th):
                ribs = 0.8 + 0.2 * abs(math.cos(7 * th))
                return (1 - rho ** 2) ** 0.5 * ribs * (0.4 + 0.6 * rho ** 0.3)

            for x, z, sx, sz in corners(W, H, r):
                # Fan opening outward along the corner diagonal.
                rot = math.atan2(sz, sx)
                polar(builder, x, z, y0, rad, 0.22 * b, shell, slot, rings=10, segs=36, angle=(-math.pi / 2, math.pi / 2), rotate=rot)
                polar(builder, x, z, y0 - 0.0005, rad * 0.32, 0.26 * b, lambda rho, th: (1 - rho * rho) ** 0.5, slot, rings=6, segs=24)
        elif kind == "roundels":
            _, d, radius, height, slot = item
            r, rad = d * b, radius * b
            y0 = surface_y(profile, b, d) + 0.0015

            def roundel(rho, th):
                ring = math.exp(-((rho - 0.82) / 0.09) ** 2)
                dome = 0.75 * max(0.0, 1 - (rho / 0.55) ** 2) ** 0.5
                groove = -0.12 * math.exp(-((rho - 0.62) / 0.04) ** 2)
                return max(0.0, ring + dome + groove)

            for x, z, _, _ in corners(W, H, r):
                polar(builder, x, z, y0, rad, height * b, roundel, slot, rings=12, segs=40)


# ---------------------------------------------------------------- normal maps
def save_normal(name, height, strength):
    gy, gx = np.gradient(height)
    nx, ny = -gx * strength, -gy * strength
    nz = np.ones_like(height)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    rgb = np.stack([nx / length, ny / length, nz / length], axis=-1) * 0.5 + 0.5
    h, w = height.shape
    image = bpy.data.images.new(name, w, h, alpha=False)
    image.colorspace_settings.name = "Non-Color"
    pixels = np.concatenate([rgb, np.ones((h, w, 1))], axis=-1)
    image.pixels = pixels.astype(np.float32).ravel()
    image.filepath_raw = os.path.join(TEXTURES, name + ".png")
    image.file_format = "PNG"
    image.save()
    return image


def ornament_maps():
    maps = {}
    # Acanthus leaves along the ogee: lobed leaves with a central vein, one per tile.
    w, h = 512, 256
    x, y = np.meshgrid(np.linspace(0, 1, w, endpoint=False), np.linspace(0, 1, h))
    width = 0.46 * np.sin(np.pi * np.clip(y * 0.92 + 0.04, 0, 1)) ** 0.7
    rel = np.abs(x - 0.5) / np.maximum(width, 1e-3)
    inside = np.clip(1 - rel, 0, 1)
    lobes = 0.65 + 0.35 * np.cos(2 * np.pi * (rel * 2.2 + y * 3.5))
    vein = 1 - 0.55 * np.exp(-((x - 0.5) / 0.012) ** 2)
    leaf = (inside ** 0.6) * lobes * vein
    tips = 0.5 * np.exp(-(((x - 0.0) % 1 - 0.0) ** 2 + (y - 0.85) ** 2) / 0.004) + 0.5 * np.exp(-(((x - 1.0)) ** 2 + (y - 0.85) ** 2) / 0.004)
    maps["acanthus"] = save_normal("ornament-acanthus", leaf + tips, 26)
    # Punchwork on the cassetta frieze: rows of small dots and rosettes of dots.
    w = h = 256
    x, y = np.meshgrid(np.linspace(0, 1, w, endpoint=False), np.linspace(0, 1, h))
    dots = np.zeros_like(x)
    for cy in np.linspace(0.08, 0.92, 9):
        for cx in np.linspace(0, 1, 13, endpoint=False):
            dots += np.exp(-(((x - cx + 0.5) % 1 - 0.5) ** 2 + (y - cy) ** 2) / 0.00012) * (0.5 if 0.2 < cy < 0.8 else 1.0)
    rr = np.sqrt((x - 0.5) ** 2 + (y - 0.5) ** 2)
    petals = np.exp(-((rr - 0.22 - 0.05 * np.cos(8 * np.arctan2(y - 0.5, x - 0.5))) / 0.012) ** 2)
    maps["punch"] = save_normal("ornament-punch", -(dots + petals), 20)
    # Dutch ripple: fine wavy ridges across the moulding.
    w, h = 256, 128
    x, y = np.meshgrid(np.linspace(0, 1, w, endpoint=False), np.linspace(0, 1, h))
    maps["ripple"] = save_normal("ornament-ripple", np.sin(2 * np.pi * (x * 2 + 0.25 * np.sin(2 * np.pi * y * 2))), 6)
    # Reeding: parallel rounded ribs along the band.
    maps["reed"] = save_normal("ornament-reed", np.abs(np.sin(np.pi * y * 6)) ** 0.6, 10)
    # Klimt: incised rectangles and small spirals.
    w = h = 256
    x, y = np.meshgrid(np.linspace(0, 1, w, endpoint=False), np.linspace(0, 1, h))
    lines = np.exp(-((y - 0.15) / 0.01) ** 2) + np.exp(-((y - 0.85) / 0.01) ** 2)
    boxes = np.exp(-(np.minimum(np.abs(x - 0.1), np.abs(x - 0.6)) / 0.01) ** 2) * ((y > 0.15) & (y < 0.85))
    spiral_r = np.sqrt((x - 0.35) ** 2 + (y - 0.5) ** 2)
    spiral = np.exp(-((np.sin(spiral_r * 90 - np.arctan2(y - 0.5, x - 0.35))) ** 2) / 0.05) * (spiral_r < 0.18)
    maps["klimt"] = save_normal("ornament-klimt", -(lines + boxes + 0.6 * spiral), 18)
    return maps


# ---------------------------------------------------------------- materials (for baking and previews)
def principled(name, base, metallic, roughness, normal=None, texture=None, normal_texture=None, coat=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    tree = mat.node_tree
    bsdf = tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*base, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Coat Weight"].default_value = coat
    for image in [normal, normal_texture]:
        if image is None:
            continue
        tex = tree.nodes.new("ShaderNodeTexImage")
        tex.image = image
        nmap = tree.nodes.new("ShaderNodeNormalMap")
        tree.links.new(tex.outputs["Color"], nmap.inputs["Color"])
        tree.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    if texture is not None:
        tex = tree.nodes.new("ShaderNodeTexImage")
        tex.image = texture
        tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def materials(maps):
    def load(name, color=True):
        image = bpy.data.images.load(os.path.join(CACHE, name))
        image.colorspace_settings.name = "sRGB" if color else "Non-Color"
        return image

    gold = (0.92, 0.56, 0.17)
    old = (0.6, 0.37, 0.13)
    lac = (0.012, 0.01, 0.009)
    return {
        "gold": principled("gold", gold, 1, 0.27),
        "gold_old": principled("gold_old", old, 1, 0.4),
        "gold_acanthus": principled("gold_acanthus", gold, 1, 0.3, maps["acanthus"]),
        "gold_punch": principled("gold_punch", old, 1, 0.36, maps["punch"]),
        "gold_reed": principled("gold_reed", gold, 1, 0.3, maps["reed"]),
        "gold_klimt": principled("gold_klimt", gold, 1, 0.3, maps["klimt"]),
        "lacquer": principled("lacquer", lac, 0, 0.35, coat=1),
        "lacquer_ripple": principled("lacquer_ripple", lac, 0, 0.35, maps["ripple"], coat=1),
        "wood_dark": principled("wood_dark", (0.2, 0.12, 0.07), 0, 0.5, texture=load("dark_wood_diff_1k.jpg"), normal_texture=load("dark_wood_nor_gl_1k.jpg", False)),
        "wood_oak": principled("wood_oak", (0.5, 0.35, 0.2), 0, 0.55, texture=load("oak_veneer_01_diff_1k.jpg"), normal_texture=load("oak_veneer_01_nor_gl_1k.jpg", False)),
        "back": principled("back", (0.16, 0.12, 0.09), 0, 0.9),
    }


# ---------------------------------------------------------------- scene helpers
def reset():
    for collection in (bpy.data.objects, bpy.data.meshes):
        for item in list(collection):
            collection.remove(item)


def make_object(name, builder, mats):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(builder.verts, [], builder.faces)
    mesh.update()
    for slot in SLOTS:
        mesh.materials.append(mats[slot])
    mesh.polygons.foreach_set("material_index", builder.mats)
    mesh.polygons.foreach_set("use_smooth", [True] * len(builder.faces))
    uv = mesh.uv_layers.new(name="UVMap")
    loop_uvs = [builder.uvs[v] for poly in mesh.polygons for v in poly.vertices]
    uv.data.foreach_set("uv", [c for pair in loop_uvs for c in pair])
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def stand_in(aspect):
    """The painting and its stretched canvas: they shade the frame's rebate during the AO bake."""
    builder = Builder()
    a, d = aspect / 2, 0.03
    verts = [(-a, 0, -0.5), (a, 0, -0.5), (a, 0, 0.5), (-a, 0, 0.5), (-a, d, -0.5), (a, d, -0.5), (a, d, 0.5), (-a, d, 0.5)]
    faces = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    mesh = bpy.data.meshes.new("Painting")
    mesh.from_pydata(verts, [], faces)
    obj = bpy.data.objects.new("Painting", mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def bake_ao(obj):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 48
    scene.render.bake.target = "VERTEX_COLORS"
    attr = obj.data.color_attributes.new("Color", "BYTE_COLOR", "POINT")
    obj.data.color_attributes.active_color = attr
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type="AO")
    # Keep recesses dark but never black: gilding still shows in the deepest hollow.
    values = np.empty(len(attr.data) * 4, dtype=np.float32)
    attr.data.foreach_get("color", values)
    values = values.reshape(-1, 4)
    values[:, :3] = 0.3 + 0.7 * values[:, :3]
    attr.data.foreach_set("color", values.ravel())


def export(obj, path):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_apply=True,
        # Images go out only so the exporter keeps the UVs; build-frames.mjs strips them (shared textures on the page).
        export_materials="EXPORT", export_image_format="AUTO", export_vertex_color="ACTIVE",
        export_all_vertex_colors=False, export_texcoords=True, export_normals=True, export_tangents=False,
    )


def preview(obj, painting, path):
    scene = bpy.context.scene
    scene.cycles.samples = 40
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 900, 700
    scene.view_settings.view_transform = "Standard"
    scene.render.filepath = path
    if not scene.world:
        world = bpy.data.worlds.new("Studio")
        scene.world = world
        world.use_nodes = True
        env = world.node_tree.nodes.new("ShaderNodeTexEnvironment")
        env.image = bpy.data.images.load(os.path.join(CACHE, "studio_small_08_1k.hdr"))
        world.node_tree.links.new(env.outputs["Color"], world.node_tree.nodes["Background"].inputs["Color"])
        world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35
    # reset() removes objects between frames: light and camera come back each time.
    key = bpy.data.lights.get("Key") or bpy.data.lights.new("Key", "AREA")
    key.energy = 400
    key.size = 2
    key_object = bpy.data.objects.new("Key", key)
    key_object.location = (-2.5, -3.5, 2.8)
    key_object.rotation_euler = (math.radians(55), 0, math.radians(-35))
    scene.collection.objects.link(key_object)
    cam = bpy.data.cameras.get("Camera") or bpy.data.cameras.new("Camera")
    cam.lens = 85
    camera = bpy.data.objects.new("Camera", cam)
    scene.collection.objects.link(camera)
    scene.camera = camera
    # The painting itself on the stand-in, for judging the frame in context.
    canvas = bpy.data.objects["Painting"]
    mat = bpy.data.materials.get("PaintingMat") or bpy.data.materials.new("PaintingMat")
    mat.use_nodes = True
    tree = mat.node_tree
    tex = tree.nodes.get("Image Texture") or tree.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(os.path.join(ROOT, "public/paintings", painting["image"] + "-1024.webp"))
    tree.links.new(tex.outputs["Color"], tree.nodes["Principled BSDF"].inputs["Base Color"])
    tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.8
    canvas.data.materials.clear()
    canvas.data.materials.append(mat)
    if not canvas.data.uv_layers:
        uv = canvas.data.uv_layers.new()
        coords = [(0, 0), (1, 0), (1, 1), (0, 1)] + [(0, 0)] * 20
        for i, loop in enumerate(canvas.data.loops):
            uv.data[i].uv = coords[i] if i < 4 else (0, 0)
    size = max(painting["aspect"], 1) + 0.6
    camera.location = (size * 1.1, -size * 3.2, size * 0.6)
    import mathutils
    camera.rotation_euler = (mathutils.Vector((0, 0, 0)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.render.render(write_still=True)


# ---------------------------------------------------------------- main
bpy.ops.wm.read_factory_settings(use_empty=True)
maps = ornament_maps()
mats = materials(maps)
seen_styles = set()
for painting in DATA["paintings"]:
    style = painting["frame"]
    if style == "none" or (ONLY and painting["slug"] not in ONLY):
        continue
    reset()
    a = painting["aspect"]
    b = DATA["frames"][style]["width"] * min(a, 1.0)
    W, H = a / 2 - LIP, 0.5 - LIP
    profile, side_slot, items = style_profile(style)
    builder = Builder()
    sweep(builder, profile, side_slot, W, H, b)
    ornaments(builder, profile, items, W, H, b)
    frame = make_object("Frame", builder, mats)
    stand_in(a)
    bake_ao(frame)
    path = os.path.join(OUT, painting["image"] + ".glb")
    export(frame, path)
    print("frame", painting["number"], style, len(builder.faces), "faces", os.path.getsize(path) // 1024, "KB")
    if PREVIEW and style not in seen_styles:
        seen_styles.add(style)
        preview(frame, painting, os.path.join(PREVIEW, f"{painting['number']}-{style}.png"))
