import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { PlannedSentence } from '../types';

const CHUNK = 5; // parole mostrate insieme

/** Sottotitoli animati stile Reels/TikTok: poche parole alla volta, quella detta in evidenza. */
export const Captions: React.FC<{ sentence: PlannedSentence | null; local: number; accent: string }> = ({ sentence, local, accent }) => {
  const { fps } = useVideoConfig();
  useCurrentFrame();
  if (!sentence) return null;
  const ws = sentence.words;
  const idx = Math.max(0, ws.findIndex((w) => local >= w.start && local < w.end));
  const cur = local >= sentence.dur ? ws.length - 1 : local < 0 ? 0 : idx;
  const chunkStart = Math.floor(cur / CHUNK) * CHUNK;
  const chunk = ws.slice(chunkStart, chunkStart + CHUNK);
  const since = local - chunk[0].start;
  const pop = spring({ frame: Math.max(0, Math.round(since * fps)), fps, config: { damping: 14, stiffness: 220 }, durationInFrames: 14 });
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top: 1610, height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ transform: `scale(${interpolate(pop, [0, 1], [0.92, 1])})`, opacity: interpolate(pop, [0, 1], [0.4, 1]), fontFamily: 'Inter, Helvetica, Arial, sans-serif', fontWeight: 900, fontSize: 82, lineHeight: 1.12, color: '#fff', textShadow: '0 6px 28px rgba(0,0,0,.7)', letterSpacing: -1 }}>
        {chunk.map((w, k) => {
          const i = chunkStart + k; const active = i === cur;
          return <span key={i} style={{ display: 'inline-block', margin: '0 12px', color: active ? accent : '#fff', transform: active ? 'scale(1.08)' : 'none' }}>{w.w}</span>;
        })}
      </div>
    </div>
  );
};
