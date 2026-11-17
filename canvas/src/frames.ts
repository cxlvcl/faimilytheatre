/**
 * Frame models made in Blender (canvas/blender/frames.py): one meshopt-compressed GLB per painting.
 * The GLB carries geometry, UVs and baked occlusion (vertex colours); its material names pick the
 * shared materials here. Gilding and lacquer are matcaps rendered from the real materials in Blender,
 * so they shine like metal and varnish without an environment map on the phone.
 */
import {
  Group, Material, Mesh, MeshMatcapMaterial, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, Texture, TextureLoader, Vector2,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'

const BASE = '/assets/canvas/frames/textures/'

export interface FrameKit {
  load(url: string): Promise<Group>
}

export function createFrameKit(): FrameKit {
  const textures = new TextureLoader()
  const texture = (name: string, color: boolean) => {
    const map = textures.load(BASE + name + '.webp')
    map.wrapS = map.wrapT = RepeatWrapping
    if (color) map.colorSpace = SRGBColorSpace
    return map
  }
  const gold = texture('matcap-gold', true)
  const goldOld = texture('matcap-gold-old', true)
  const lacquer = texture('matcap-lacquer', true)
  const matcap = (cap: Texture, ornament?: string, strength = 1) => new MeshMatcapMaterial({
    matcap: cap, vertexColors: true,
    ...(ornament ? { normalMap: texture('ornament-' + ornament, false), normalScale: new Vector2(strength, strength) } : {}),
  })
  const wood = (name: string) => new MeshStandardMaterial({
    map: texture(name, true), normalMap: texture(name + '-normal', false), roughness: 0.5, metalness: 0, vertexColors: true,
    // The scans are reddish; a neutral tint brings them closer to old varnished wood.
    color: 0xB8AC9C,
  })
  const materials: Record<string, Material> = {
    gold: matcap(gold),
    gold_old: matcap(goldOld),
    gold_acanthus: matcap(gold, 'acanthus'),
    gold_punch: matcap(goldOld, 'punch'),
    gold_reed: matcap(gold, 'reed'),
    gold_klimt: matcap(gold, 'klimt'),
    lacquer: matcap(lacquer),
    lacquer_ripple: matcap(lacquer, 'ripple', 0.8),
    wood_dark: wood('wood-dark'),
    wood_oak: wood('wood-oak'),
    back: new MeshStandardMaterial({ color: 0x2B211A, roughness: 0.9, vertexColors: true }),
  }
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)

  return {
    async load(url) {
      const gltf = await loader.loadAsync(url)
      const group = new Group()
      gltf.scene.traverse(object => {
        if (!(object instanceof Mesh)) return
        const name = (object.material as Material).name
        ;(object.material as Material).dispose()
        object.material = materials[name] ?? materials.gold
      })
      group.add(gltf.scene)
      return group
    },
  }
}
