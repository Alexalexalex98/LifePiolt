import React from 'react';
import { AbsoluteFill, Freeze, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import type { CaptureMeta, PlannedScene } from '../types';

export const PHONE = { w: 648, h: 1402, top: 178, radius: 62 };
const VIEW_W = 390;

/** Ondina dove l'utente tocca. */
const Ripple: React.FC<{ x: number; y: number; local: number; color: string }> = ({ x, y, local, color }) => {
  if (local < 0 || local > 0.7) return null;
  const p = local / 0.7;
  return (
    <>
      <div style={{ position: 'absolute', left: x - 26, top: y - 26, width: 52, height: 52, borderRadius: 52, border: `5px solid ${color}`, opacity: 1 - p, transform: `scale(${0.5 + p * 1.5})` }} />
      <div style={{ position: 'absolute', left: x - 13, top: y - 13, width: 26, height: 26, borderRadius: 26, background: color, opacity: Math.min(1, 1.6 - p * 1.6) * 0.9, transform: `scale(${1 - p * 0.3})` }} />
    </>
  );
};

/** Una scena: la clip reale dell'app (con velocità adattata al voice over), tocchi, zoom e cornice sugli elementi importanti. */
export const PhoneScene: React.FC<{ scene: PlannedScene; cap: CaptureMeta; clip: string; accent: string }> = ({ scene, cap, clip, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sc = PHONE.w / VIEW_W;
  const t = frame / fps; // tempo nella scena
  const capT = scene.cue.start + Math.min(t, scene.playDur) * scene.rate; // tempo nella registrazione
  const startFrom = Math.round(scene.cue.start * fps);
  const playFrames = Math.max(1, Math.floor(scene.playDur * fps));

  // zoom: l'ultimo "focus" iniziato (o in corso) nella scena
  const fx = cap.focuses.filter((f) => f.t >= scene.cue.start - 0.05 && f.t <= scene.cue.end).map((f) => ({ ...f, ls: (f.t - scene.cue.start) / scene.rate, ld: f.dur / scene.rate }));
  let zoom = 1, ox = PHONE.w / 2, oy = PHONE.h / 2, ring: null | { x: number; y: number; w: number; h: number; o: number } = null;
  for (const f of fx) {
    const into = t - f.ls;
    if (into < -0.05 || into > f.ld + 0.6) continue;
    const cx = (f.x + f.w / 2) * sc, cy = (f.y + f.h / 2) * sc;
    const target = Math.min(1.7, Math.max(1.25, 260 / Math.max(f.w, f.h)));
    const inP = spring({ frame: Math.round((into) * fps), fps, config: { damping: 200, mass: 0.7 } });
    const outP = interpolate(into, [f.ld, f.ld + 0.6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
    const k = Math.max(0, inP) * (1 - outP);
    zoom = 1 + (target - 1) * k; ox = cx; oy = cy;
    ring = { x: f.x * sc - 8, y: f.y * sc - 8, w: f.w * sc + 16, h: f.h * sc + 16, o: k };
  }
  // l'origine dello zoom resta dentro lo schermo
  ox = Math.min(PHONE.w * 0.78, Math.max(PHONE.w * 0.22, ox)); oy = Math.min(PHONE.h * 0.78, Math.max(PHONE.h * 0.22, oy));

  return (
    <div style={{ position: 'absolute', left: (1080 - PHONE.w) / 2, top: PHONE.top, width: PHONE.w, height: PHONE.h, borderRadius: PHONE.radius, overflow: 'hidden', boxShadow: '0 40px 120px rgba(0,0,0,.55), 0 0 0 10px #0b0d12, 0 0 0 12px #2a3040', background: '#07090d' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${zoom})`, transformOrigin: `${ox}px ${oy}px` }}>
        <Sequence from={0} durationInFrames={playFrames} layout="none">
          <OffthreadVideo src={staticFile(clip)} startFrom={startFrom} playbackRate={scene.rate} muted style={{ width: PHONE.w, height: PHONE.h, objectFit: 'cover' }} />
        </Sequence>
        {scene.dur > scene.playDur ? (
          <Sequence from={playFrames} layout="none">
            <Freeze frame={playFrames - 1}>
              <OffthreadVideo src={staticFile(clip)} startFrom={startFrom} playbackRate={scene.rate} muted style={{ width: PHONE.w, height: PHONE.h, objectFit: 'cover' }} />
            </Freeze>
          </Sequence>
        ) : null}
        {cap.taps.filter((p) => p.t >= scene.cue.start - 0.02 && p.t <= scene.cue.end).map((p, i) => <Ripple key={i} x={p.x * sc} y={p.y * sc} local={t - (p.t - scene.cue.start) / scene.rate} color={accent} />)}
        {ring ? <div style={{ position: 'absolute', left: ring.x, top: ring.y, width: ring.w, height: ring.h, borderRadius: 26, border: `6px solid ${accent}`, opacity: ring.o, boxShadow: `0 0 36px ${accent}` }} /> : null}
      </div>
    </div>
  );
};
export { Img, AbsoluteFill };
