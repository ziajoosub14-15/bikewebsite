import * as THREE from 'three';
import type { ResolvedBuild } from '../../../domain/bikeModel';
import type { Colourway } from '../../../types/components';
import { S, WHEEL_Y } from '../frameShape';
import { buildBike } from './buildBike';
import { studioEnvironment, studioFloor, studioLights } from './studio';

/**
 * Still images of the realistic bike, rendered off-screen with one shared WebGL context.
 * The camera covers exactly the same 920 × 520 area as the side-view drawing (x 40–960, y 60–580), so a
 * snapshot can replace the drawing anywhere, including the ride animation where wheels are added on top.
 */
let shared: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; floor: THREE.Object3D } | null = null;
let failed = false;
const cache = new Map<string, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();

function setup() {
  if (shared || failed) return shared;
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.environment = studioEnvironment(renderer);
    studioLights(scene);
    const floor = studioFloor();
    scene.add(floor);
    shared = { renderer, scene, floor };
  } catch {
    failed = true;
  }
  return shared;
}

export interface SnapshotOptions {
  wheels?: boolean;
  /** Render only the wheels. */
  only?: 'wheels';
  shadow?: boolean;
  /** Output width in pixels (height follows the 920:520 drawing ratio). */
  width?: number;
}

/** PNG data URL of the bike on a transparent background, or null if WebGL isn't available. */
export function bikeSnapshot(parts: ResolvedBuild, cw: Colourway, o: SnapshotOptions = {}): Promise<string | null> {
  const wheels = o.wheels ?? true;
  const shadow = o.shadow ?? true;
  const width = o.width ?? 1200;
  const key = JSON.stringify([Object.values(parts).map((p) => p.id), cw, wheels, shadow, width, o.only]);
  const hit = cache.get(key);
  if (hit) return hit;
  // Render one at a time on the shared context.
  const job = queue.then(
    () =>
      new Promise<string>((resolve, reject) => {
        const s = setup();
        if (!s) return reject(new Error('no webgl'));
        const height = Math.round((width * 520) / 920);
        s.renderer.setSize(width, height, false);
        s.floor.visible = shadow;
        const bike = buildBike(parts, cw, { wheels, only: o.only });
        s.scene.add(bike.group);
        // Match the drawing's coordinates (including how it lifts bikes with smaller tyres).
        const R = (311 + parts.tyres.widthMm) * S;
        const groundY = WHEEL_Y + (311 + 45) * S + 2;
        const lift = groundY - 2 - (WHEEL_Y + R);
        const Rm = (311 + parts.tyres.widthMm) / 1000;
        const wx = (x: number) => (x - 506) / S / 1000;
        const wy = (y: number) => Rm + (WHEEL_Y - (y - lift)) / S / 1000;
        const cam = new THREE.OrthographicCamera(wx(40), wx(960), wy(60), wy(580), 0.1, 20);
        cam.position.set(0, 0, 6);
        cam.lookAt(0, 0, 0);
        s.renderer.render(s.scene, cam);
        const url = s.renderer.domElement.toDataURL('image/png');
        s.scene.remove(bike.group);
        bike.dispose();
        resolve(url);
      }),
  );
  queue = job.catch(() => undefined);
  const out = job.catch(() => null) as Promise<string | null>;
  cache.set(key, out as Promise<string>);
  return out;
}
