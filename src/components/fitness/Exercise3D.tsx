import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import { Text } from '@/components/T';

import { ExerciseFigure } from '@/components/fitness/ExerciseFigure';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import type { ExerciseX } from '@/lib/fitness/exerciseDb';
import { FAMILIES } from '@/lib/fitness/poses';

type Ex = Pick<ExerciseX, 'fam' | 'photos' | 'name'>;
const PERIOD = 3400; // ms per un'andata e ritorno
/** Posizione tra partenza (0) e arrivo (1): sosta breve a ogni estremo e passaggio morbido in mezzo. */
const cycle = (ms: number) => { const x = (ms % PERIOD) / PERIOD; const tri = x < 0.5 ? x * 2 : (1 - x) * 2; const d = Math.min(1, Math.max(0, (tri - 0.12) / 0.76)); return d * d * (3 - 2 * d); };

/**
 * Dimostrazione in 3D: l'omino ripete il movimento da partenza ad arrivo e si gira trascinando il dito.
 * Se il 3D non parte (telefono o Expo Go senza supporto) torna alle due immagini piane, senza errori a schermo.
 */
export function Exercise3D({ ex, height = 280 }: { ex: Ex | undefined; height?: number }) {
  const t = useTheme();
  const fam = ex?.fam ? FAMILIES[ex.fam] : undefined;
  const [failed, setFailed] = useState(false);
  const az = useRef(-0.55);
  const alive = useRef(true);
  const light = t.mode === 'light';
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const pan = useMemo(() => {
    let start = 0;
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderGrant: () => { start = az.current; },
      onPanResponderMove: (_, g) => { az.current = start + g.dx / 90; },
      onPanResponderTerminationRequest: () => false,
    });
  }, []);

  if (!fam || (ex?.photos?.length ?? 0) > 0 || failed || !GLView) return <View style={{ alignItems: 'center' }}><ExerciseFigure ex={ex} size={150} /></View>;

  const start = async (gl: ExpoWebGLRenderingContext) => {
    try {
      const THREE = await import('three');
      const { buildRig, RIG_COLORS } = await import('@/lib/fitness/rig3d');
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      const canvas = { width: w, height: h, clientWidth: w, clientHeight: h, style: {}, addEventListener: () => {}, removeEventListener: () => {}, getContext: () => gl } as unknown as HTMLCanvasElement;
      const renderer = new THREE.WebGLRenderer({ canvas, context: gl as unknown as WebGL2RenderingContext, antialias: true, alpha: true });
      renderer.setSize(w, h, false); renderer.setClearColor(0x000000, 0);
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight('#ffffff', light ? '#9aa6c0' : '#40506e', 1.15));
      const sun = new THREE.DirectionalLight('#ffffff', 1.6); sun.position.set(60, 90, 80); scene.add(sun);
      const rig = buildRig(fam, { ...RIG_COLORS, floor: light ? '#d9e0ee' : '#2a3550' });
      scene.add(rig.group);
      const cam = new THREE.PerspectiveCamera(30, w / h, 1, 1000);
      const c = rig.bounds.center, R = rig.bounds.size * 2.0;
      const t0 = Date.now();
      const frame = () => {
        if (!alive.current) { rig.dispose(); renderer.dispose(); return; }
        rig.update(fam.b ? cycle(Date.now() - t0) : 0);
        cam.position.set(c.x + Math.sin(az.current) * R, c.y + R * 0.2, Math.cos(az.current) * R);
        cam.lookAt(c);
        renderer.render(scene, cam);
        gl.endFrameEXP();
        requestAnimationFrame(frame);
      };
      frame();
    } catch { if (alive.current) setFailed(true); }
  };

  return (
    <View style={{ height, borderRadius: 18, backgroundColor: t.chip, overflow: 'hidden' }} accessible accessibilityLabel={`${ex?.name ?? fam.name}: ${tl('dimostrazione in 3D, trascina per girare')}`}>
      <GLView style={{ flex: 1 }} onContextCreate={(gl) => { void start(gl); }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} {...pan.panHandlers} />
      <Text style={{ position: 'absolute', bottom: 8, alignSelf: 'center', color: t.muted, fontSize: 11 }}>{tl('Trascina per girare')}</Text>
    </View>
  );
}
