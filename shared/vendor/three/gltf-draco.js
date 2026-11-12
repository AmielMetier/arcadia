// shared/vendor/three/gltf-draco.js — un chargeur de .glb qui sait lire les modèles compressés (Draco et Meshopt).
// Les gros modèles du dépôt sont compressés par `gltf-transform draco` : tout chargeur qui les lit doit passer par ici.
import { GLTFLoader } from './GLTFLoader.js';
import { DRACOLoader } from './DRACOLoader.js';
import { MeshoptDecoder } from './meshopt_decoder.module.js';

let draco = null;
export function gltfLoader() {
  if (!draco) { draco = new DRACOLoader(); draco.setDecoderPath(new URL('./draco/', import.meta.url).href); }
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}
