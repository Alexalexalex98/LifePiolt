import { useState } from 'react';
import { Image, View } from 'react-native';

import { ensureMe, localToday, pickPhoto } from '@/components/casa/shared';
import { Body, Btn, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { alertT } from '@/lib/alert';
import { reviewTidy } from '@/lib/homeAi';
import { praiseOf } from '@/lib/homeCare';
import { guideOf, stepsDone } from '@/lib/homeGuides';
import { useCasa, type Tidy } from '@/store/casa';
import { toast } from '@/store/toast';

const newTidyId = () => `t${Date.now().toString(36)}`;

/** Avvia (o riprende) un riordino guidato per una zona; restituisce il suo id. */
export function startTidy(gid: string): string {
  const st = useCasa.getState(); const g = guideOf(gid)!; const ex = st.tidy.find((t) => t.guide === gid && !t.finished); if (ex) return ex.id;
  const room = st.rooms.find((r) => r.type === g.room)?.id ?? null; const t: Tidy = { id: newTidyId(), guide: gid, room, started: localToday(), done: [] }; st.upsertTidy(t); return t.id;
}

/** Riordino guidato: un passo alla volta, con la foto del prima e del dopo. Theia guarda la differenza e ti dice, con gentilezza, cosa è venuto bene. */
export function TidySheet({ id, onClose }: { id: string; onClose: () => void }) {
  const th = useTheme(); const t = useCasa((s) => s.tidy.find((x) => x.id === id)); const { upsertTidy, removeTidy, finishTidy } = useCasa(); const [busy, setBusy] = useState(false);
  if (!t) return null; const g = guideOf(t.guide)!;
  const set = (p: Partial<Tidy>) => upsertTidy({ ...t, ...p });
  const toggle = (i: number) => set({ done: t.done.includes(i) ? t.done.filter((x) => x !== i) : [...t.done, i] });
  const photo = async (k: 'before' | 'after') => { const uri = await pickPhoto(); if (uri) set(k === 'before' ? { before: uri, beforeNote: undefined, verdict: undefined } : { after: uri, verdict: undefined }); };
  const review = async () => { if (!t.before || !t.after) return; setBusy(true); const r = await reviewTidy(t.before, t.after, t.beforeNote); setBusy(false); if (!r.ok) { toast(r.message); return; } set({ beforeNote: r.data.note, verdict: r.data.verdict }); };
  const finish = () => { const me = ensureMe(); const pts = 15 + t.done.length * 3 + (t.after ? 10 : 0); finishTidy(t.id, useCasa.getState().me ?? me.id, localToday(), pts); toast(t.verdict?.praise ?? praiseOf(t.done.length)); onClose(); };
  return (
    <Sheet visible title={g.title} onClose={onClose}>
      <Body muted>{tl(g.intro)}</Body>
      <Row style={{ marginTop: 10, alignItems: 'flex-start' }}><Ph k="before" uri={t.before} onPick={() => { void photo('before'); }} /><Ph k="after" uri={t.after} onPick={() => { void photo('after'); }} /></Row>
      <Body small bold muted style={{ marginTop: 14, marginBottom: 6 }}>{`${tl('PASSI').toUpperCase()} · ${stepsDone(g, t.done)}%`}</Body>
      {g.steps.map((s, i) => (
        <Row key={i} style={{ marginBottom: 8, alignItems: 'flex-start' }}>
          <Pill label={t.done.includes(i) ? '✓' : String(i + 1)} on={t.done.includes(i)} onPress={() => toggle(i)} />
          <View style={{ flex: 1 }}><Body style={{ textDecorationLine: t.done.includes(i) ? 'line-through' : 'none' }}>{tl(s.text)}</Body><Body small muted>{`${s.minutes} min${s.tip ? ` · ${tl(s.tip)}` : ''}`}</Body></View>
        </Row>
      ))}
      {t.before && t.after ? <View style={{ alignSelf: 'flex-start', marginTop: 4 }}><Btn small icon="sparkle" disabled={busy} title={busy ? 'Theia guarda…' : 'Theia, dai un\'occhiata'} onPress={() => { void review(); }} /></View> : <Body small muted style={{ marginTop: 4 }}>{tl('Fai la foto del prima e del dopo: Theia può confrontarle e farti i complimenti.')}</Body>}
      {t.verdict ? (
        <View style={{ marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: th.chip }}>
          <Body bold>{t.verdict.verdict === 'meglio' ? tl('Si vede la differenza!') : t.verdict.verdict === 'uguale' ? tl('Quasi uguale: ci sei vicino') : tl('Manca pochissimo')}</Body>
          <Body small style={{ marginTop: 4 }}>{t.verdict.praise}</Body>
          {t.verdict.tips.map((x, i) => <Body key={i} small muted style={{ marginTop: 4 }}>{`• ${x}`}</Body>)}
          <Body small muted style={{ marginTop: 6 }}>{tl('L\'AI può sbagliare: fidati anche del tuo occhio.')}</Body>
        </View>
      ) : null}
      <View style={{ height: 12 }} />
      <Row><Btn icon="check" title="Ho finito" onPress={finish} /><Btn ghost danger title="Elimina" onPress={() => alertT('Eliminare questo riordino?', g.title, [{ text: 'Annulla', style: 'cancel' }, { text: 'Elimina', style: 'destructive', onPress: () => { removeTidy(t.id); onClose(); } }])} /></Row>
      <Body small muted style={{ marginTop: 8 }}>{tl('Puoi fermarti e riprendere quando vuoi: i passi fatti restano segnati.')}</Body>
    </Sheet>
  );
}

function Ph({ k, uri, onPick }: { k: 'before' | 'after'; uri?: string; onPick: () => void }) {
  const th = useTheme();
  return (
    <View style={{ flex: 1 }}>
      {uri ? <Image source={{ uri }} style={{ width: '100%', height: 120, borderRadius: 12, backgroundColor: th.chip }} resizeMode="cover" accessibilityLabel={k === 'before' ? tl('Prima') : tl('Dopo')} /> : <View style={{ height: 120, borderRadius: 12, backgroundColor: th.chip, alignItems: 'center', justifyContent: 'center' }}><Body small muted>{k === 'before' ? tl('Prima') : tl('Dopo')}</Body></View>}
      <View style={{ marginTop: 6 }}><Btn small ghost icon="camera" title={uri ? (k === 'before' ? 'Cambia il prima' : 'Cambia il dopo') : (k === 'before' ? 'Foto del prima' : 'Foto del dopo')} onPress={onPick} /></View>
    </View>
  );
}
