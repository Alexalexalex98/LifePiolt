import { Image } from 'expo-image';
import { File } from 'expo-file-system';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AiNote } from '@/components/AiNote';
import { FIT } from '@/components/fitness/kit';
import { LogoLoader } from '@/components/LogoLoader';
import { PhotoViewer } from '@/components/PhotoViewer';
import { RichText } from '@/components/RichText';
import { Body, Btn, Card, H, Page, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { confirmDelete } from '@/lib/confirm';
import { askSend, logSend } from '@/lib/aiConsent';
import { tidy } from '@/lib/aiPersona';
import { AiServerError, aiReadFiles, aiServerConfigured } from '@/lib/aiServer';
import { BODY_SLOTS, BODY_TIPS, bodyPrompt, type BodySlot } from '@/lib/fitness/bodyCheck';
import { persistFile } from '@/lib/chatMedia';
import { Icon } from '@/lib/icons';
import { pickNetMedia, takeNetPhoto } from '@/lib/netMedia';
import { useBodyCheck } from '@/store/bodyCheck';
import { useFitness } from '@/store/fitness';
import { toast } from '@/store/toast';

/** Controllo del corpo: 4 foto (davanti, dietro, lati) che l'AI guarda per dire cosa va bene e cosa migliorare con esercizi e alimentazione. */
export default function FitnessBody() {
  const t = useTheme();
  const { photos, reports, setPhoto, addReport, delReport, clearPhotos } = useBodyCheck();
  const fit = useFitness();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [viewer, setViewer] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(reports[0]?.id ?? null);
  const have = BODY_SLOTS.filter((s) => photos[s.id]).length;

  async function take(slot: BodySlot, camera: boolean) {
    try {
      const m = camera ? await takeNetPhoto() : await pickNetMedia('photo');
      if (m) setPhoto(slot, m.uri); // resta solo sul telefono: non va in LifeDrive
    } catch (e) { toast(e instanceof Error ? e.message : 'Non riesco ad aprire la fotocamera'); }
  }
  async function analyze() {
    if (have < 4 || busy) return;
    setError('');
    if (!aiServerConfigured) { setError('L\'AI non è collegata in questa app.'); return; }
    if (!(await askSend('body', 'Davanti, dietro, lato sinistro e lato destro'))) { toast('Non invio niente: senza il tuo permesso l\'analisi non parte.'); return; }
    setBusy(true);
    try {
      const files = BODY_SLOTS.map((s) => ({ uri: photos[s.id]!, mime: 'image/jpeg' }));
      logSend('body', 0, ['4 foto del corpo']);
      const b = fit.body;
      const reply = await aiReadFiles(bodyPrompt({ sex: b?.sex, age: b?.age, weightKg: b?.weightKg, heightCm: b?.heightCm, goal: b?.goal, activity: b?.activity }), files, 120000, 1100);
      const text = tidy(reply);
      if (!text) { setError('Non ho ricevuto una risposta: riprova tra poco.'); return; }
      setOpenId(addReport(text));
    } catch (e) { setError(e instanceof AiServerError ? e.message : 'Non sono riuscito a contattare il servizio AI.'); }
    finally { setBusy(false); }
  }
  function wipePhotos() {
    confirmDelete('le 4 foto del corpo', () => {
      for (const s of BODY_SLOTS) { const u = photos[s.id]; if (u) { try { new File(u).delete(); } catch { /* gia' tolta */ } } }
      clearPhotos();
    }, undefined, { undoMessage: '' });
  }
  const when = (ts: number) => new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Page id="fitnessBody" back title="Controllo del corpo">
      <Card accent={FIT}>
        <H>Quattro foto, un parere sul tuo allenamento</H>
        <Body small muted style={{ marginTop: 2 }}>Scatta o scegli 4 foto: davanti, dietro e i due lati. L'AI guarda cosa va bene e cosa si può migliorare con esercizi, alimentazione e abitudini. È una valutazione indicativa da foto, non una visita.</Body>
        {BODY_TIPS.map((x) => <Body key={x} small muted style={{ marginTop: 3 }}>{`• ${tl(x)}`}</Body>)}
      </Card>

      <Card>
        <Row style={{ flexWrap: 'wrap', alignItems: 'stretch' }} gap={10}>
          {BODY_SLOTS.map((s) => (
            <View key={s.id} style={{ flexBasis: '47%', flexGrow: 1 }}>
              <Body bold>{s.label}</Body>
              <Pressable accessibilityRole="button" accessibilityLabel={photos[s.id] ? tl('Apri la foto') : tl('Aggiungi la foto')} onPress={() => (photos[s.id] ? setViewer(photos[s.id]!) : void take(s.id, true))} style={{ marginTop: 6, aspectRatio: 3 / 4, borderRadius: 14, overflow: 'hidden', backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.border }}>
                {photos[s.id] ? <Image source={{ uri: photos[s.id]! }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <View style={{ alignItems: 'center', padding: 8 }}><Icon name="camera" size={26} color={t.muted} /><Body small muted style={{ textAlign: 'center', marginTop: 4 }}>{s.hint}</Body></View>}
              </Pressable>
              <Row gap={6} style={{ marginTop: 6 }}>
                <Btn small ghost style={{ flex: 1 }} icon="camera" title="Scatta" onPress={() => void take(s.id, true)} />
                <Btn small ghost style={{ flex: 1 }} icon="image" title="Galleria" onPress={() => void take(s.id, false)} />
              </Row>
            </View>
          ))}
        </Row>
        <Btn style={{ marginTop: 12 }} icon="sparkle" title={busy ? 'Analizzo le foto…' : have < 4 ? `Mancano ${4 - have} foto` : 'Analizza le 4 foto'} disabled={busy || have < 4} onPress={() => void analyze()} />
        {busy ? <Row gap={10} style={{ marginTop: 10, justifyContent: 'flex-start' }}><LogoLoader size={44} /><Body muted style={{ flex: 1 }}>Sto guardando le foto: ci può volere un minuto.</Body></Row> : null}
        {error ? <Body small style={{ marginTop: 8, color: t.danger }}>{error}</Body> : null}
        <Body small muted style={{ marginTop: 8 }}>Le foto restano solo sul tuo telefono, non finiscono in LifeDrive. Le mando all'AI solo per l'analisi, con il tuo permesso ogni volta: il server non le conserva.</Body>
        {have ? <Btn small ghost danger style={{ marginTop: 8, alignSelf: 'flex-start' }} icon="trash" title="Cancella le foto" onPress={wipePhotos} /> : null}
      </Card>

      {reports.length ? (
        <Card>
          <H>Le tue analisi</H>
          {reports.map((r) => (
            <View key={r.id} style={{ marginTop: 10 }}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: openId === r.id }} onPress={() => setOpenId(openId === r.id ? null : r.id)}>
                <Row><Body bold style={{ flex: 1 }}>{when(r.ts)}</Body><Icon name="chevron" size={18} color={t.muted} /></Row>
              </Pressable>
              {openId === r.id ? (
                <View style={{ marginTop: 6 }}>
                  <RichText text={r.text} color={t.text} accent={t.text} />
                  <AiNote />
                  <Btn small ghost danger style={{ marginTop: 8, alignSelf: 'flex-start' }} icon="trash" title="Elimina questa analisi" onPress={() => delReport(r.id)} />
                </View>
              ) : null}
            </View>
          ))}
        </Card>
      ) : null}
      <PhotoViewer uri={viewer} onClose={() => setViewer(null)} />
    </Page>
  );
}
