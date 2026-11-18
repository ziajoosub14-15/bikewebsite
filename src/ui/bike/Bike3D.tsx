import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import type { ResolvedBuild } from '../../domain/bikeModel';
import type { Colourway } from '../../types/components';
import { buildBike, type BuiltBike } from './three/buildBike';
import { studioEnvironment, studioFloor, studioLights } from './three/studio';
import { backgroundTexture } from './three/textures';

const TARGET = new THREE.Vector3(0.0, 0.52, 0);
const VIEWS = {
  side: { label: 'Side', pos: [0.0, 0.55, 3.05] },
  'three-quarter': { label: '3/4', pos: [1.6, 0.85, 2.25] },
  'non-drive': { label: 'Other side', pos: [0.0, 0.55, -3.05] },
  front: { label: 'Front', pos: [2.9, 0.8, 0.02] },
  rear: { label: 'Rear', pos: [-2.9, 0.8, 0.02] },
  top: { label: 'Top', pos: [0.02, 3.3, 0.3] },
  detail: { label: 'Drivetrain', pos: [0.15, 0.5, 1.15] },
} as const;
type ViewId = keyof typeof VIEWS;

/**
 * Realistic 3D view of the configured bike: studio lighting with softbox reflections, clear-coated carbon,
 * soft shadows and ambient occlusion. Drag to rotate, scroll or pinch to zoom.
 */
export default function Bike3D({ parts, colourway, backdrop = 'studio', initialView = 'side' }: { parts: ResolvedBuild; colourway: Colourway; backdrop?: string; initialView?: ViewId }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const ctx = useRef<{
    renderer: THREE.WebGLRenderer;
    composer: EffectComposer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    bike?: BuiltBike;
    anim?: { from: THREE.Vector3; to: THREE.Vector3; t0: number };
    dirty: boolean;
  } | null>(null);
  const [view, setView] = useState<ViewId>(initialView);
  const [spin, setSpin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const mount = mountRef.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    } catch {
      setError('The realistic view needs WebGL, which this browser or device has turned off.');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';

    const scene = new THREE.Scene();
    scene.environment = studioEnvironment(renderer);
    studioLights(scene);
    scene.add(studioFloor());

    const camera = new THREE.PerspectiveCamera(22, 1, 0.05, 50);
    camera.position.fromArray(VIEWS[initialView].pos);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(TARGET);
    controls.enableDamping = true;
    controls.minDistance = 0.5;
    controls.maxDistance = 7;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.autoRotateSpeed = 1.4;

    // Ambient occlusion (soft darkening where parts meet) on top of a multisampled render.
    const target = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
    const composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    const gtao = new GTAOPass(scene, camera, 1, 1);
    gtao.blendIntensity = 0.85;
    gtao.updateGtaoMaterial({ radius: 0.12, distanceExponent: 1.5, thickness: 1.2, scale: 1.0, samples: 12 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    composer.addPass(gtao);
    composer.addPass(new OutputPass());

    ctx.current = { renderer, composer, scene, camera, controls, dirty: true };
    controls.addEventListener('change', () => {
      if (ctx.current) ctx.current.dirty = true;
    });

    const resize = () => {
      const w = mount.clientWidth;
      const h = Math.max(280, Math.round(w * 0.58));
      renderer.setSize(w, h);
      composer.setSize(w, h);
      gtao.setSize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (ctx.current) ctx.current.dirty = true;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let raf = 0;
    const loop = (now: number) => {
      const c = ctx.current!;
      if (c.anim) {
        const k = Math.min(1, (now - c.anim.t0) / 700);
        const e = 1 - Math.pow(1 - k, 3);
        camera.position.lerpVectors(c.anim.from, c.anim.to, e);
        c.dirty = true;
        if (k >= 1) c.anim = undefined;
      }
      controls.update();
      // Only re-render when something changed: keeps laptops cool.
      if (c.dirty || controls.autoRotate) {
        composer.render();
        c.dirty = false;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      ctx.current?.bike?.dispose();
      scene.environment?.dispose();
      target.dispose();
      composer.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      ctx.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild the bike when parts or colours change.
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    if (c.bike) {
      c.scene.remove(c.bike.group);
      c.bike.dispose();
    }
    c.bike = buildBike(parts, colourway);
    c.scene.add(c.bike.group);
    c.dirty = true;
  }, [parts, colourway]);

  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    c.scene.background = backgroundTexture(backdrop);
    c.dirty = true;
  }, [backdrop]);

  useEffect(() => {
    if (ctx.current) ctx.current.controls.autoRotate = spin;
  }, [spin]);

  const goTo = (v: ViewId) => {
    setView(v);
    const c = ctx.current;
    if (!c) return;
    c.controls.target.copy(v === 'detail' ? new THREE.Vector3(-0.15, 0.32, 0.06) : TARGET);
    c.anim = { from: c.camera.position.clone(), to: new THREE.Vector3().fromArray(VIEWS[v].pos), t0: performance.now() };
  };

  if (error) return <div className="flex h-72 items-center justify-center p-6 text-center text-sm text-slate-500">{error}</div>;

  return (
    <div className="relative">
      <div ref={mountRef} className="w-full cursor-grab overflow-hidden active:cursor-grabbing" aria-label="Realistic 3D view of the bike. Drag to rotate, scroll or pinch to zoom." role="img" />
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex flex-wrap items-center justify-center gap-1.5 px-2">
        {(Object.keys(VIEWS) as ViewId[]).map((v) => (
          <button
            key={v}
            onClick={() => goTo(v)}
            aria-pressed={view === v}
            className={`pointer-events-auto rounded-full px-3 py-1 text-xs font-semibold shadow-sm backdrop-blur transition ${view === v ? 'bg-slate-900 text-white' : 'bg-white/85 text-slate-700 hover:bg-white'}`}
          >
            {VIEWS[v].label}
          </button>
        ))}
        <button
          onClick={() => setSpin((s) => !s)}
          aria-pressed={spin}
          className={`pointer-events-auto rounded-full px-3 py-1 text-xs font-semibold shadow-sm backdrop-blur ${spin ? 'bg-brand-600 text-white' : 'bg-white/85 text-slate-700 hover:bg-white'}`}
        >
          {spin ? 'Stop spin' : 'Spin'}
        </button>
      </div>
      <p className="pointer-events-none absolute left-3 top-2 rounded bg-white/60 px-1.5 text-[11px] text-slate-600 backdrop-blur">Drag to rotate · scroll or pinch to zoom</p>
    </div>
  );
}
