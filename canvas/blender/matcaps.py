"""Matcaps for the frames: a sphere of the real material rendered in Blender (Cycles, studio HDRI).
On the page a MeshMatcapMaterial reads them, so gilding and lacquer reflect like metal and varnish
without an environment map on the phone.

Run: .local-tools/blender/Blender.app/Contents/MacOS/Blender -b -P canvas/blender/matcaps.py -- <out dir>
"""
import math
import os
import sys

import bpy

out = sys.argv[sys.argv.index("--") + 1]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
hdri = os.path.join(root, ".cache/polyhaven/studio_small_08_1k.hdr")

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 96
scene.cycles.device = "CPU"
scene.render.resolution_x = scene.render.resolution_y = 512
scene.render.film_transparent = True
scene.view_settings.view_transform = "Standard"
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"

world = bpy.data.worlds.new("Studio")
scene.world = world
world.use_nodes = True
nodes = world.node_tree.nodes
env = nodes.new("ShaderNodeTexEnvironment")
env.image = bpy.data.images.load(hdri)
mapping = nodes.new("ShaderNodeMapping")
coords = nodes.new("ShaderNodeTexCoord")
# The softboxes of the HDRI turned to the upper left, where the page's key light is.
mapping.inputs["Rotation"].default_value = (0, 0, math.radians(110))
world.node_tree.links.new(coords.outputs["Generated"], mapping.inputs["Vector"])
world.node_tree.links.new(mapping.outputs["Vector"], env.inputs["Vector"])
background = nodes["Background"]
background.inputs["Strength"].default_value = 0.32
world.node_tree.links.new(env.outputs["Color"], background.inputs["Color"])

# Warm key from the top left, as on the page.
key = bpy.data.lights.new("Key", "AREA")
key.energy = 300
key.size = 2.5
key.color = (1.0, 0.92, 0.8)
key_object = bpy.data.objects.new("Key", key)
key_object.location = (-3.2, -4.0, 3.6)
key_object.rotation_euler = (math.radians(50), 0, math.radians(-38))
scene.collection.objects.link(key_object)

mesh = bpy.data.meshes.new("Sphere")
sphere = bpy.data.objects.new("Sphere", mesh)
scene.collection.objects.link(sphere)
import bmesh  # noqa: E402

bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=128, v_segments=64, radius=1.0)
for face in bm.faces:
    face.smooth = True
bm.to_mesh(mesh)
bm.free()

camera_data = bpy.data.cameras.new("Camera")
camera_data.type = "ORTHO"
camera_data.ortho_scale = 2.0
camera = bpy.data.objects.new("Camera", camera_data)
camera.location = (0, -10, 0)
camera.rotation_euler = (math.radians(90), 0, 0)
scene.collection.objects.link(camera)
scene.camera = camera


def material(name, base, metallic, roughness, coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*base, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Coat Weight"].default_value = coat
    bsdf.inputs["Coat Roughness"].default_value = 0.08
    return mat


# Water gilding: warm, burnished but not mirror-like (linear colours).
looks = {
    "matcap-gold": material("Gold", (0.92, 0.56, 0.17), 1.0, 0.27),
    "matcap-gold-old": material("GoldOld", (0.6, 0.37, 0.13), 1.0, 0.4),
    "matcap-lacquer": material("Lacquer", (0.012, 0.01, 0.009), 0.0, 0.35, coat=1.0),
}
for name, mat in looks.items():
    sphere.data.materials.clear()
    sphere.data.materials.append(mat)
    scene.render.filepath = os.path.join(out, name + ".png")
    bpy.ops.render.render(write_still=True)
    print("matcap", name)
