"""
HUNTER×HUNTER テーマの 3D 小道具を作る（Blender をスクリプトで動かす）。

  python art/hunter/build_models.py <出力先ディレクトリ> [--preview]

作るもの（すべてこのスクリプトが生成するオリジナルのモデル。手作業の調整は無い）:
  - license.glb : ハンターライセンス風のカード（濃紺の地・金の縁・金の紋章と文字）
  - card.glb    : トランプ風のカード（白地・金の縁・赤いダイヤ）
  - glass.glb   : 水見式のグラス（glass / water / leaf の3つ。水は底が原点で、y 方向に伸縮して水位にする）
再生成の手順は art/README.md。bpy（pip install bpy）が必要。
"""
import math
import os
import sys

import bpy  # bmesh より先に import する（bpy モジュールが bmesh を登録する）
import bmesh

OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else 'out'
PREVIEW = '--preview' in sys.argv
os.makedirs(OUT, exist_ok=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color, metallic=0.0, roughness=0.5, emission=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metallic
    b.inputs['Roughness'].default_value = roughness
    if emission:
        b.inputs['Emission Color'].default_value = (*emission, 1)
        b.inputs['Emission Strength'].default_value = 0.6
    return m


def rounded_box(name, w, h, d, radius, mat, z=0.0):
    """角の丸い薄い板（幅 w・高さ h・厚み d）。"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= w
        v.co.y *= h
        v.co.z *= d
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bev = obj.modifiers.new('bevel', 'BEVEL')
    bev.width = radius
    bev.segments = 4
    bev.limit_method = 'ANGLE'
    obj.location.z = z
    obj.data.materials.append(mat)
    return obj


def polygon(name, points, depth, mat, z=0.0):
    """平面の多角形を厚み depth で押し出す。"""
    bm = bmesh.new()
    verts = [bm.verts.new((x, y, 0)) for x, y in points]
    face = bm.faces.new(verts)
    bmesh.ops.reverse_faces(bm, faces=[face]) if face.normal.z < 0 else None
    res = bmesh.ops.extrude_face_region(bm, geom=[face])
    top = [v for v in res['geom'] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=top, vec=(0, 0, depth))
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location.z = z
    obj.data.materials.append(mat)
    return obj


def star(points_n, outer, inner):
    pts = []
    for i in range(points_n * 2):
        r = outer if i % 2 == 0 else inner
        a = math.pi / 2 + i * math.pi / points_n
        pts.append((r * math.cos(a), r * math.sin(a)))
    return pts


def ring(name, r_outer, r_inner, depth, mat, z=0.0, seg=64):
    """平たい円環（トーラスをつぶしたもの）。"""
    major = (r_outer + r_inner) / 2
    minor = (r_outer - r_inner) / 2
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=seg, minor_segments=12)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale.z = depth / (2 * minor)
    obj.location.z = z
    obj.data.materials.append(mat)
    return obj


def text(name, body, size, mat, z, x=0.0, y=0.0):
    curve = bpy.data.curves.new(name, 'FONT')
    curve.body = body
    curve.size = size
    curve.extrude = 0.004
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.location = (x, y, z)
    obj.data.materials.append(mat)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    return obj


def export(name, objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    # 位置合わせのため、全体を1つの親にまとめず、そのまま書き出す
    path = os.path.join(OUT, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True,
                              export_apply=True, export_yup=True, export_materials='EXPORT')
    print('wrote', path, os.path.getsize(path), 'bytes')
    return path


def preview(name):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 48
    scene.render.resolution_x, scene.render.resolution_y = 720, 480
    world = bpy.data.worlds.new('w')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.05, 0.05, 0.09, 1)
    scene.world = world
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    bpy.context.collection.objects.link(cam)
    cam.location = (0.35, -1.5, 0.9)
    cam.rotation_euler = (math.radians(62), 0, math.radians(14))
    scene.camera = cam
    for i, (loc, energy) in enumerate([((2, -2, 3), 400), ((-2.5, -1, 1.5), 150)]):
        light = bpy.data.objects.new(f'l{i}', bpy.data.lights.new(f'l{i}', 'AREA'))
        light.data.energy = energy
        light.data.size = 2
        light.location = loc
        bpy.context.collection.objects.link(light)
    scene.render.filepath = os.path.join(OUT, name + '_preview.png')
    bpy.ops.render.render(write_still=True)


GOLD = (0.83, 0.62, 0.12)
NAVY = (0.03, 0.035, 0.09)


def build_license():
    reset()
    body_m = material('license_body', NAVY, metallic=0.2, roughness=0.35)
    gold = material('gold', GOLD, metallic=1.0, roughness=0.28)
    W, H, D = 1.0, 0.63, 0.02
    objs = [rounded_box('body', W, H, D, 0.012, body_m)]
    # 金の縁（外枠）
    frame = rounded_box('frame', W - 0.05, H - 0.05, 0.004, 0.004, gold, z=D / 2 + 0.001)
    inner = rounded_box('frame_in', W - 0.075, H - 0.075, 0.006, 0.004, body_m, z=D / 2 + 0.002)
    objs += [frame, inner]
    # 紋章: 金の輪と四方の星
    objs.append(ring('emblem_ring', 0.13, 0.108, 0.006, gold, z=D / 2 + 0.004, seg=64))
    objs.append(polygon('emblem_star', star(4, 0.105, 0.03), 0.007, gold, z=D / 2 + 0.004))
    objs.append(text('title', 'HUNTER LICENSE', 0.055, gold, D / 2 + 0.005, y=-0.2))
    objs.append(text('no', 'No. 0001', 0.032, gold, D / 2 + 0.005, x=-0.28, y=0.22))
    export('license', objs)
    if PREVIEW:
        for o in objs:
            o.rotation_euler[0] = 0
        preview('license')


def build_card():
    reset()
    face = material('card_face', (0.93, 0.92, 0.88), metallic=0.0, roughness=0.5)
    gold = material('card_gold', GOLD, metallic=1.0, roughness=0.3)
    red = material('card_red', (0.75, 0.05, 0.10), metallic=0.1, roughness=0.4)
    W, H, D = 0.56, 0.84, 0.012
    objs = [rounded_box('card', W, H, D, 0.02, face)]
    objs.append(rounded_box('card_edge', W - 0.03, H - 0.03, 0.002, 0.01, gold, z=D / 2 + 0.0005))
    objs.append(rounded_box('card_edge_in', W - 0.045, H - 0.045, 0.003, 0.01, face, z=D / 2 + 0.001))
    diamond = [(0, 0.16), (0.1, 0), (0, -0.16), (-0.1, 0)]
    objs.append(polygon('diamond', diamond, 0.004, red, z=D / 2 + 0.002))
    small = [(0, 0.05), (0.03, 0), (0, -0.05), (-0.03, 0)]
    for sx, sy in [(-0.19, 0.33), (0.19, -0.33)]:
        objs.append(polygon('pip', [(x + sx, y + sy) for x, y in small], 0.003, red, z=D / 2 + 0.002))
    export('card', objs)
    if PREVIEW:
        preview('card')


def lathe(name, profile, mat, steps=48, z=0.0):
    """断面（半径, 高さ）の折れ線を軸まわりに回した回転体。"""
    bm = bmesh.new()
    verts = [bm.verts.new((r, 0, h)) for r, h in profile]
    edges = [bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
    bmesh.ops.spin(bm, geom=verts + edges, cent=(0, 0, 0), axis=(0, 0, 1), angle=math.tau, steps=steps)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location.z = z
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def build_glass():
    reset()
    glass_m = material('glass', (0.85, 0.92, 0.95), metallic=0.0, roughness=0.05)
    water_m = material('water', (0.55, 0.78, 0.95), metallic=0.0, roughness=0.1)
    leaf_m = material('leaf', (0.20, 0.55, 0.18), metallic=0.0, roughness=0.6)
    # グラス: 厚みのある壁と底（外側 → 縁 → 内側 → 内底）。高さ 0.5・口の半径 0.2
    wall = 0.012
    profile = [(0.0, 0.0), (0.155, 0.0), (0.16, 0.03), (0.2, 0.5), (0.2 - wall, 0.5), (0.16 - wall, 0.04), (0.0, 0.04)]
    glass = lathe('glass', profile, glass_m)
    # 水: 底が原点の錐台（高さ 1 単位 = 0.34）。three.js で y を伸縮して水位にする
    water = lathe('water', [(0.0, 0.0), (0.146, 0.0), (0.146 + 0.038, 0.34), (0.0, 0.34)], water_m, z=0.045)
    # 葉: 水面に浮かぶ、先のとがった楕円。中央の筋も入れる
    pts = []
    for i in range(24):
        a = math.tau * i / 24
        pts.append((0.085 * math.cos(a), 0.045 * math.sin(a) * (1 - 0.25 * math.cos(a)) if math.cos(a) < 0 else 0.045 * math.sin(a) * (1 - 0.6 * math.cos(a))))
    leaf = polygon('leaf', pts, 0.004, leaf_m, z=0.045 + 0.34)
    objs = [glass, water, leaf]
    export('glass', objs)
    if PREVIEW:
        preview('glass')


build_license()
build_card()
build_glass()
