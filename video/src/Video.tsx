import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Captions } from './components/Captions';
import { PhoneScene } from './components/Phone';
import { OUTRO } from './timeline';
import type { CaptureMeta, Plan, VideoSpec } from './types';

export type Props = { spec: VideoSpec; cap: CaptureMeta; plan: Plan };
const FONT = 'Inter, Helvetica, Arial, sans-serif';

/** Il video: il template viene riempito da spec (testi), cap (registrazione dell'app) e plan (tempi). Non serve toccare il codice per cambiarlo. */
export const Video: React.FC<Props> = ({ spec, cap, plan }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / fps;
  const [c1, c2] = spec.bg ?? ['#0b1020', '#05070d'];
  const clip = `clips/${spec.capture}.mp4`;
  const active = plan.scenes.find((s) => t >= s.start && t < s.start + s.dur) ?? null;
  const hook = active?.title ?? spec.hook;
  const sentence = active ? active.sentences.find((x, i, a) => { const lo = active.start + x.start; const hi = i === a.length - 1 ? active.start + active.dur : active.start + a[i + 1].start; return t >= lo && t < hi; }) ?? null : null;
  const local = active && sentence ? t - active.start - sentence.start : 0;
  const outroT = t - plan.outroStart;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${c1}, ${c2})`, fontFamily: FONT }}>
      <div style={{ position: 'absolute', top: -260, left: -160, width: 900, height: 900, borderRadius: 900, background: `radial-gradient(circle, ${spec.accent}55, transparent 65%)` }} />
{spec.music !== null ? <Audio src={staticFile(`music/${spec.music?.file ?? 'bed.mp3'}`)} loop volume={(f) => Math.min(1, (spec.music?.volume ?? 0.14) * interpolate(f / fps, [0, 1.2, plan.total - 1.5, plan.total], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }))} /> : null}
      {t < plan.outroStart ? (
        <>
          <div style={{ position: 'absolute', top: 52, left: 60, right: 60, color: '#fff', fontWeight: 900, fontSize: 62, lineHeight: 1.08, letterSpacing: -1.5 }}>{hook}</div>
          {plan.scenes.map((s, i) => (
            <Sequence key={i} from={Math.round(s.start * fps)} durationInFrames={Math.max(1, Math.round(s.dur * fps))} layout="none">
              <PhoneScene scene={s} cap={cap} clip={clip} accent={spec.accent} />
            </Sequence>
          ))}
          <Captions sentence={sentence} local={local} accent={spec.accent} />
          {plan.scenes.flatMap((s, si) => s.sentences.filter((x) => x.file).map((x, i) => (
            <Sequence key={`${si}-${i}`} from={Math.round((s.start + x.start) * fps)} layout="none"><Audio src={staticFile(x.file!)} /></Sequence>
          )))}
        </>
      ) : (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 80, opacity: interpolate(outroT, [0, 0.4], [0, 1], { extrapolateRight: 'clamp' }) }}>
          <div style={{ color: spec.accent, fontWeight: 900, fontSize: 150, letterSpacing: -4 }}>{spec.outro.title}</div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 64, marginTop: 24, lineHeight: 1.2 }}>{spec.outro.subtitle}</div>
          <div style={{ marginTop: 70, background: spec.accent, color: '#0b0d12', fontWeight: 900, fontSize: 56, padding: '28px 56px', borderRadius: 999 }}>{spec.outro.cta}</div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
export { OUTRO };
