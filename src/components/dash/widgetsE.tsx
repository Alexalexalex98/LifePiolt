import { Pressable, View } from 'react-native';

import { Chrome } from '@/components/dash/Tile';
import type { WProps } from '@/components/dash/widgetsA';
import { Text } from '@/components/T';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { computeDashboard } from '@/lib/analyticsData';
import { PLANS, fastStatus, fmtLeft, hmToMin } from '@/lib/fitness/fasting';
import { Icon } from '@/lib/icons';
import { exerciseById } from '@/lib/mindLibrary';
import { recommend } from '@/lib/mindRecommend';
import { go } from '@/lib/nav';
import { childrenOf, useWorkspace } from '@/store/workspace';
import { useFasting } from '@/store/fasting';
import { useHealth } from '@/store/health';
import { useMindSpace } from '@/store/mindSpace';

const MIND = '#c9b6ff';
const FOOD = '#5fd39a';
const WORK = '#8fb3ff';

/** Digiuno intermittente: se puoi mangiare o sei in digiuno e quanto manca. */
export function FastingW(p: WProps) {
  const t = useTheme();
  const f = useFasting();
  const plan = PLANS.find((x) => x.id === f.plan) ?? PLANS[1]!;
  const d = new Date();
  const st = fastStatus(d.getHours() * 60 + d.getMinutes(), hmToMin(f.start), plan.eatHours);
  const c = st.eating ? FOOD : MIND;
  return (
    <Chrome pw={p.pw} ph={p.ph} color={c} label={tl('Digiuno intermittente')} onPress={() => go('fasting')}>
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="clock" size={16} color={c} stroke={2} /><Text numberOfLines={1} style={{ color: t.muted, fontSize: 11.5, fontWeight: '700' }}>{tl('Digiuno intermittente')}</Text></View>
        {f.on ? (
          <View style={{ gap: 4 }}>
            <Text style={{ color: t.text, fontSize: p.h >= 2 ? 22 : 16, fontWeight: '800' }}>{st.eating ? tl('Puoi mangiare') : tl('Sei in digiuno')}</Text>
            <Text style={{ color: t.muted, fontSize: 12 }}>{st.eating ? tl('Si chiude tra {0}', fmtLeft(st.minutesLeft)) : tl('Mangi tra {0}', fmtLeft(st.minutesLeft))}</Text>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: c + '33', overflow: 'hidden' }}><View style={{ width: `${Math.round(st.progress * 100)}%`, height: 6, backgroundColor: c }} /></View>
          </View>
        ) : <Text style={{ color: t.muted, fontSize: 13 }}>{tl('Tocca per attivarlo')}</Text>}
      </View>
    </Chrome>
  );
}

/** Un esercizio di benessere mentale scelto per te adesso (dai tuoi dati e dall'ora). */
export function MindRecoW(p: WProps) {
  const t = useTheme();
  const entries = useMindSpace((s) => s.entries);
  useHealth((s) => s.moods);
  let weak: { id: string; why: string }[] = []; let sleepAvg: number | undefined;
  try { weak = computeDashboard().lifeScore.down.slice(0, 2).map((x) => ({ id: x.id, why: x.why })); } catch { /* senza Life Score */ }
  const sl = (useHealth.getState().series?.sleep ?? []).slice(-7); if (sl.length) sleepAvg = sl.reduce((a, b) => a + b, 0) / sl.length;
  const now = new Date();
  const r = recommend({ weak, sleepAvg, hour: now.getHours(), recent: [...entries].reverse().map((e) => e.ex), seed: now.getFullYear() * 400 + now.getMonth() * 31 + now.getDate() }, 1)[0];
  const ex = r ? exerciseById(r.exId) : undefined;
  return (
    <Chrome pw={p.pw} ph={p.ph} color={MIND} label={tl('Benessere mentale')} onPress={() => go('mindfulness')}>
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="sparkle" size={16} color={MIND} stroke={2} /><Text numberOfLines={1} style={{ color: t.muted, fontSize: 11.5, fontWeight: '700' }}>{tl('Per te adesso')}</Text></View>
        {ex ? (<View style={{ gap: 3 }}><Text numberOfLines={p.h >= 2 ? 3 : 2} style={{ color: t.text, fontSize: p.h >= 2 ? 18 : 15, fontWeight: '800' }}>{tl(ex.title)}</Text><Text numberOfLines={2} style={{ color: t.muted, fontSize: 12 }}>{`${ex.minutes} min · ${tl(r!.reason)}`}</Text></View>) : null}
      </View>
    </Chrome>
  );
}

/** Le ultime pagine del workspace, una dopo l'altra. */
export function WorkspaceRecentW(p: WProps) {
  const t = useTheme();
  const pages = useWorkspace((s) => s.pages);
  const recent = [...pages].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, Math.max(1, Math.floor((p.ph - 60) / 26)));
  return (
    <Chrome pw={p.pw} ph={p.ph} color={WORK} label="LifeWorkspace" onPress={() => go('workspace')}>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="note" size={16} color={WORK} stroke={2} /><Text numberOfLines={1} style={{ color: t.muted, fontSize: 11.5, fontWeight: '700' }}>LifeWorkspace</Text></View>
        {recent.length ? recent.map((x) => (
          <Pressable key={x.id} onPress={() => go('workspace')} accessibilityRole="button" accessibilityLabel={x.title}><Text numberOfLines={1} style={{ color: t.text, fontSize: 14, fontWeight: '700' }}>{`${x.kind === 'db' ? '▦' : '▸'} ${x.title || tl('Pagina senza titolo')}`}{childrenOf(pages, x.id).length ? ` · ${childrenOf(pages, x.id).length}` : ''}</Text></Pressable>
        )) : <Text style={{ color: t.muted, fontSize: 13 }}>{tl('Nessuna pagina: creane una')}</Text>}
      </View>
    </Chrome>
  );
}
