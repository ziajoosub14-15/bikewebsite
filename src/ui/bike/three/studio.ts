import * as THREE from 'three';

/**
 * Photo-studio lighting. Reflections come from an environment built out of big soft light panels
 * (like softboxes and strip lights in a product shoot), so glossy paint and clear-coated carbon show
 * long, soft highlights instead of plastic-looking hot spots.
 */
export function studioEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const env = new THREE.Scene();
  env.background = new THREE.Color('#2a2d31');
  const panel = (w: number, h: number, intensity: number, pos: [number, number, number], look: [number, number, number]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity, intensity), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(...look);
    env.add(m);
  };
  // Big overhead softbox, two tall strip lights, a soft fill from the front and a warm floor bounce.
  panel(6, 3, 3.2, [0, 5, 0], [0, 0, 0]);
  panel(1.2, 5, 4.0, [-4, 2, 3], [0, 0.6, 0]);
  panel(1.2, 5, 3.2, [4, 2, -3], [0, 0.6, 0]);
  panel(5, 2, 1.4, [0, 1.5, 5], [0, 0.6, 0]);
  panel(5, 2, 1.0, [0, 1.5, -5], [0, 0.6, 0]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ color: '#8a8580' }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.5;
  env.add(floor);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  env.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
  return tex;
}

/** Key light that casts soft shadows on the floor, plus a gentle sky fill. */
export function studioLights(scene: THREE.Scene) {
  const hemi = new THREE.HemisphereLight('#ffffff', '#b9b2aa', 0.35);
  scene.add(hemi);
  const key = new THREE.DirectionalLight('#ffffff', 1.6);
  key.position.set(1.2, 4, 2.4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -1.3;
  key.shadow.camera.right = 1.3;
  key.shadow.camera.top = 1.3;
  key.shadow.camera.bottom = -1.3;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 10;
  key.shadow.radius = 6;
  key.shadow.blurSamples = 16;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.01;
  scene.add(key);
  return { hemi, key };
}

/** Floor that only shows the shadow, plus a very soft contact shadow under the tyres. */
export function studioFloor(): THREE.Group {
  const g = new THREE.Group();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.22 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.receiveShadow = true;
  g.add(shadow);
  // Contact shadow: a blurred dark ellipse right under the bike.
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(0,0,0,0.45)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.32), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.001;
  g.add(contact);
  return g;
}
