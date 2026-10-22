import React from 'react';
import { Composition, staticFile } from 'remotion';
import { Video, type Props } from './Video';
import { planVideo } from './timeline';
import type { AudioMeta, CaptureMeta, VideoSpec } from './types';

declare const require: { context: (dir: string, deep: boolean, re: RegExp) => { keys(): string[]; (k: string): { default?: VideoSpec } & VideoSpec } };
// Ogni file videos/*.json è un video: aggiungerne uno lo registra da solo.
const ctx = require.context('../videos', false, /\.json$/);
const specs: VideoSpec[] = ctx.keys().map((k) => { const m = ctx(k); return (m.default ?? m) as VideoSpec; });

const getJson = async <T,>(p: string): Promise<T | null> => { try { const r = await fetch(staticFile(p)); return r.ok ? ((await r.json()) as T) : null; } catch { return null; } };

export const Root: React.FC = () => (
  <>
    {specs.map((spec) => (
      <Composition
        key={spec.id}
        id={spec.id}
        component={Video}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={900}
        defaultProps={{ spec, cap: null as unknown as CaptureMeta, plan: null as unknown as Props['plan'] }}
        calculateMetadata={async () => {
          const cap = await getJson<CaptureMeta>(`data/${spec.capture}.capture.json`);
          if (!cap) throw new Error(`Manca la registrazione «${spec.capture}»: lancia  npm run capture -- ${spec.capture}`);
          const audio = await getJson<AudioMeta>(`data/${spec.id}.audio.json`);
          const plan = planVideo(spec, cap, audio);
          return { durationInFrames: Math.ceil(plan.total * 30), props: { spec, cap, plan } };
        }}
      />
    ))}
  </>
);
