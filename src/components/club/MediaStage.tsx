import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { Press } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { fmtClock, type Lesson } from '@/lib/club';
import { Icon } from '@/lib/icons';

/**
 * Lettore di video e audio del LifeClub.
 *  - con file (scelto dal creatore): expo-video / expo-audio;
 *  - senza file (lezioni di esempio): cronometro DIMOSTRATIVO con la stessa barra e gli stessi commenti ancorati al tempo.
 * Tutte le varianti espongono lo stesso controllo (play/pausa, barra, salto, velocita') e riportano la posizione al genitore,
 * che mostra i commenti sotto e come bolle in sovraimpressione.
 */
export type PB = { pos: number; dur: number; playing: boolean; toggle: () => void; seek: (s: number) => void; rate: number; setRate: (r: number) => void; error?: string };
export type SeekReq = { sec: number; n: number } | null;

type Props = {
  lesson: Lesson;
  startSec?: number;
  seekReq: SeekReq;
  onPos: (sec: number, dur: number) => void;
  /** posizioni (secondi) dei commenti ancorati, mostrate come punti sulla barra */
  markers: number[];
  /** bolle in sovraimpressione */
  overlay?: ReactNode;
};

const RATES = [1, 1.25, 1.5, 2, 0.75];

export function MediaStage(p: Props) {
  const l = p.lesson;
  if (l.kind === 'video' && l.uri) return <VideoStage {...p} uri={l.uri} />;
  if (l.kind === 'audio' && l.uri) return <AudioStage {...p} uri={l.uri} />;
  return <SimStage {...p} />;
}

function useSeekReq(req: SeekReq, pb: PB) {
  const last = useRef(0);
  useEffect(() => {
    if (!req || req.n === last.current) return;
    last.current = req.n;
    pb.seek(req.sec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req?.n]);
}

function VideoStage(p: Props & { uri: string }) {
  const startRef = useRef(p.startSec ?? 0);
  const player = useVideoPlayer(p.uri, (pl) => { pl.timeUpdateEventInterval = 0.5; pl.loop = false; });
  const [st, setSt] = useState({ pos: startRef.current, dur: p.lesson.durationSec ?? 0, playing: false, rate: 1, error: undefined as string | undefined });
  useEffect(() => {
    try { if (startRef.current > 0) player.currentTime = startRef.current; } catch { /* ancora in caricamento */ }
    const a = player.addListener('timeUpdate', (e) => setSt((v) => ({ ...v, pos: e.currentTime, dur: player.duration || v.dur })));
    const b = player.addListener('playingChange', (e) => setSt((v) => ({ ...v, playing: e.isPlaying })));
    const c = player.addListener('statusChange', (e) => { if (e.status === 'error') setSt((v) => ({ ...v, error: 'Non riesco a riprodurre questo video' })); });
    return () => { a.remove(); b.remove(); c.remove(); };
  }, [player]);
  const pb: PB = {
    ...st,
    toggle: () => { try { if (st.playing) player.pause(); else player.play(); } catch { /* player rilasciato */ } },
    seek: (s) => { try { player.currentTime = Math.max(0, s); setSt((v) => ({ ...v, pos: s })); player.play(); } catch { /* ignora */ } },
    setRate: (r) => { try { player.playbackRate = r; setSt((v) => ({ ...v, rate: r })); } catch { /* ignora */ } },
  };
  useSeekReq(p.seekReq, pb);
  useEffect(() => { p.onPos(st.pos, st.dur); }, [st.pos, st.dur]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Shell pb={pb} markers={p.markers} overlay={p.overlay} visual={<VideoView player={player} style={{ width: '100%', height: '100%' }} nativeControls={false} contentFit="contain" />} />
  );
}

function AudioStage(p: Props & { uri: string }) {
  const player = useAudioPlayer(p.uri, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const [rate, setRateS] = useState(1);
  const startRef = useRef(p.startSec ?? 0);
  useEffect(() => { if (startRef.current > 0) void player.seekTo(startRef.current).catch(() => undefined); }, [player]);
  const dur = status.duration || p.lesson.durationSec || 0;
  const pb: PB = {
    pos: status.currentTime, dur, playing: status.playing, rate,
    toggle: () => {
      if (status.playing) { player.pause(); return; }
      void setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, interruptionMode: 'duckOthers' }).catch(() => undefined);
      if (status.didJustFinish) void player.seekTo(0).catch(() => undefined);
      player.play();
    },
    seek: (s) => { void player.seekTo(Math.max(0, s)).catch(() => undefined); player.play(); },
    setRate: (r) => { try { player.setPlaybackRate(r); setRateS(r); } catch { /* ignora */ } },
  };
  useSeekReq(p.seekReq, pb);
  useEffect(() => { p.onPos(pb.pos, pb.dur); }, [pb.pos, pb.dur]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Shell pb={pb} markers={p.markers} overlay={p.overlay} audio visual={null} />;
}

function SimStage(p: Props) {
  const dur = p.lesson.durationSec ?? 300;
  const [pos, setPos] = useState(Math.min(dur, p.startSec ?? 0));
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  useEffect(() => {
    if (!playing) return;
    const i = setInterval(() => setPos((v) => { const n = v + 0.25 * rate; if (n >= dur) { setPlaying(false); return dur; } return n; }), 250);
    return () => clearInterval(i);
  }, [playing, rate, dur]);
  const pb: PB = { pos, dur, playing, rate, toggle: () => setPlaying((v) => (pos >= dur ? false : !v)), seek: (s) => { setPos(Math.max(0, Math.min(dur, s))); setPlaying(true); }, setRate };
  useSeekReq(p.seekReq, pb);
  useEffect(() => { p.onPos(pos, dur); }, [pos, dur]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Shell pb={pb} markers={p.markers} overlay={p.overlay} audio={p.lesson.kind === 'audio'} visual={null} sim title={p.lesson.title} />;
}

/* ---------- interfaccia comune ---------- */
function Shell({ pb, visual, markers, overlay, audio, sim, title }: { pb: PB; visual: ReactNode; markers: number[]; overlay?: ReactNode; audio?: boolean; sim?: boolean; title?: string }) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const dur = Math.max(1, pb.dur);
  const frac = Math.min(1, pb.pos / dur);
  return (
    <View>
      <View style={{ aspectRatio: audio ? 16 / 6 : 16 / 9, backgroundColor: '#0b0f15', borderRadius: 14, overflow: 'hidden' }}>
        {visual ?? (
          <LinearGradient colors={audio ? ['#2b3a67', '#1a2342'] : ['#1f2a44', '#0b0f15']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <Pressable onPress={pb.toggle} accessibilityRole="button" accessibilityLabel={pb.playing ? 'Pausa' : 'Riproduci'} style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: '#ffffff26', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={pb.playing ? 'pause' : audio ? 'headphones' : 'play'} size={28} color="#fff" fill={pb.playing || !audio ? '#fff' : 'none'} />
            </Pressable>
            {sim && <Text numberOfLines={2} style={{ color: '#ffffffcc', fontSize: 12, marginTop: 10, textAlign: 'center' }}>{`${title ?? ''}${title ? ' · ' : ''}anteprima dimostrativa: il file video arriva col server`}</Text>}
          </LinearGradient>
        )}
        {!!pb.error && <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000a' }}><Text style={{ color: '#fff' }}>{pb.error}</Text></View>}
        {overlay}
        {visual && !pb.playing && (
          <Pressable onPress={pb.toggle} accessibilityRole="button" accessibilityLabel="Riproduci" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={26} color="#fff" fill="#fff" /></View>
          </Pressable>
        )}
      </View>
      {/* barra */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
        <Press onPress={pb.toggle} accessibilityLabel={pb.playing ? 'Pausa' : 'Riproduci'} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.text, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={pb.playing ? 'pause' : 'play'} size={16} color={t.bg} fill={t.bg} />
        </Press>
        <Text style={{ color: t.muted, fontSize: 12, minWidth: 38 }}>{fmtClock(pb.pos)}</Text>
        <Pressable
          onLayout={(e) => setW(e.nativeEvent.layout.width)}
          onPress={(e) => { if (w > 0) pb.seek((e.nativeEvent.locationX / w) * dur); }}
          accessibilityRole="adjustable" accessibilityLabel="Posizione del video" accessibilityValue={{ min: 0, max: Math.round(dur), now: Math.round(pb.pos) }}
          hitSlop={{ top: 12, bottom: 12 }}
          style={{ flex: 1, height: 22, justifyContent: 'center' }}>
          <View style={{ height: 5, borderRadius: 3, backgroundColor: t.border }}>
            <View style={{ width: `${frac * 100}%`, height: '100%', borderRadius: 3, backgroundColor: t.accent }} />
          </View>
          {markers.map((m, i) => <View key={i} pointerEvents="none" style={{ position: 'absolute', start: `${Math.min(99, (m / dur) * 100)}%`, top: 2, width: 6, height: 6, borderRadius: 3, backgroundColor: '#f5b301', borderWidth: 1, borderColor: t.bg }} />)}
          <View pointerEvents="none" style={{ position: 'absolute', start: Math.max(0, frac * w - 6), width: 12, height: 12, borderRadius: 6, backgroundColor: t.accent }} />
        </Pressable>
        <Text style={{ color: t.muted, fontSize: 12, minWidth: 38, textAlign: 'right' }}>{fmtClock(pb.dur)}</Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Press onPress={() => pb.seek(pb.pos - 10)} accessibilityLabel="Indietro di 10 secondi" style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: t.chip }}><Text style={{ color: t.text, fontSize: 12, fontWeight: '600' }}>-10 s</Text></Press>
          <Press onPress={() => pb.seek(pb.pos + 10)} accessibilityLabel="Avanti di 10 secondi" style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: t.chip }}><Text style={{ color: t.text, fontSize: 12, fontWeight: '600' }}>+10 s</Text></Press>
        </View>
        <Press onPress={() => pb.setRate(RATES[(RATES.indexOf(pb.rate) + 1) % RATES.length])} accessibilityLabel="Velocità" style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: t.chip }}><Text style={{ color: t.text, fontSize: 12, fontWeight: '700' }}>{`${pb.rate}x`}</Text></Press>
      </View>
    </View>
  );
}
