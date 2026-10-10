import { useState } from 'react';
import { View } from 'react-native';

import { Body, Btn, Card, H, Input, Pill, Row, Sheet, Switch } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { KIND_NAME } from '@/lib/aiRouter/labels';
import type { Plan } from '@/lib/aiRouter/pipeline';
import { simulate } from '@/lib/aiRouter/runtime';
import { tx } from '@/lib/aiRouter/tx';
import { useAiRouter } from '@/store/aiRouter';
import { toast } from '@/store/toast';

const EXAMPLES = ['disegna un gato rosso con un capello blue, 3 stele sopra', 'componi una canzone sul mare', 'aggiungi riunione al piano domani alle 15', 'una canzone'];

function verdictText(p: Plan): { label: string; tone: 'ok' | 'ask' | 'out' } {
  if (p.verdict === 'local') return { label: 'In locale', tone: 'ok' };
  if (p.verdict === 'clarify') return { label: 'Chiedo chiarimenti', tone: 'ask' };
  if (p.phoneOnly && p.providerShort) return { label: tx('Servirebbe {0}: bloccato', p.providerShort), tone: 'out' };
  return { label: p.providerShort ? tx('Delego a {0}', p.providerShort) : 'Non posso delegare', tone: 'out' };
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ paddingVertical: 8 }}>
      <Body small muted>{k}</Body>
      <Body>{v}</Body>
    </View>
  );
}

export function ConsentPreview({ plan, visible, onClose }: { plan: Plan | null; visible: boolean; onClose: () => void }) {
  const done = (what: string) => { onClose(); toast(`Simulazione: ${what}. Non ho inviato nulla`); };
  return (
    <Sheet visible={visible} title={plan?.providerShort ? tx('Inviare a {0}?', plan.providerShort) : 'Consenso'} onClose={onClose}>
      {plan?.outgoing ? (
        <View>
          <Body bold>{plan.outgoing.headline}</Body>
          <Body style={{ marginTop: 8 }} muted>{plan.outgoing.notSent}</Body>
          <Body small muted style={{ marginTop: 8 }}>{plan.outgoing.sensitive ? 'Ci sono dati sensibili: te lo chiederò ogni volta.' : 'È la prima volta con questo fornitore.'}</Body>
          <View style={{ gap: 8, marginTop: 14 }}>
            <Btn title="Consenti una volta" onPress={() => done('consentito una volta')} />
            <Btn ghost title="Consenti sempre per questo fornitore" onPress={() => done('consentito sempre')} />
            <Btn ghost danger title="Annulla" onPress={() => done('annullato')} />
          </View>
        </View>
      ) : <Body muted>Questa richiesta non uscirebbe dal telefono.</Body>}
    </Sheet>
  );
}

/** «Prova una richiesta»: mostra cosa farebbe il router, senza inviare nulla. */
export function Simulator() {
  const t = useTheme();
  const phoneOnly = useAiRouter((s) => s.prefs.phoneOnly);
  const [text, setText] = useState('');
  const [withImage, setWithImage] = useState(false);
  const [asPhoneOnly, setAsPhoneOnly] = useState<boolean | null>(null);
  const [limits, setLimits] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [consent, setConsent] = useState(false);

  const run = (txt = text) => setPlan(simulate(txt, { phoneOnly: asPhoneOnly ?? phoneOnly, images: withImage ? 1 : 0, limitsReached: limits }));
  const v = plan ? verdictText(plan) : null;
  const tone = v?.tone === 'ok' ? t.positive : v?.tone === 'ask' ? t.accent : t.accent;

  return (
    <>
      <Card>
        <H>Prova una richiesta</H>
        <Body small muted style={{ marginBottom: 8 }}>Scrivi una richiesta e vedi cosa farebbe Theia: se la fa da sola, se ti chiede chiarimenti o a chi la delega, con testo riscritto, cosa uscirebbe dal telefono, costo e limite. Non viene inviato nulla.</Body>
        <Input value={text} onChangeText={setText} placeholder="Scrivi una richiesta..." multiline accessibilityLabel="Richiesta da provare" style={{ minHeight: 70 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {EXAMPLES.map((e) => <Pill key={e} label={e.length > 28 ? e.slice(0, 27) + '…' : e} onPress={() => { setText(e); run(e); }} />)}
        </View>
        <View style={{ marginTop: 10 }}>
          <Row><Body style={{ flex: 1 }}>Con un'immagine allegata</Body><Switch value={withImage} onValueChange={setWithImage} accessibilityLabel="Con un'immagine allegata" /></Row>
          <Row style={{ marginTop: 6 }}><Body style={{ flex: 1 }}>Come se «Solo sul telefono» fosse attivo</Body><Switch value={asPhoneOnly ?? phoneOnly} onValueChange={setAsPhoneOnly} accessibilityLabel="Simula Solo sul telefono" /></Row>
          <Row style={{ marginTop: 6 }}><Body style={{ flex: 1 }}>Fai finta che i limiti di oggi siano raggiunti</Body><Switch value={limits} onValueChange={setLimits} accessibilityLabel="Simula limiti raggiunti" /></Row>
        </View>
        <Btn style={{ marginTop: 12 }} icon="search" title="Simula" onPress={() => run()} disabled={!text.trim() && !withImage} />
      </Card>

      {plan && v ? (
        <Card accent={tone}>
          <Row><H style={{ marginBottom: 0 }}>Verdetto</H><Pill label={v.label} on /></Row>
          <Line k="Compito riconosciuto" v={`${tx(KIND_NAME[plan.cls.kind])}${plan.cls.docFormat ? ` (${plan.cls.docFormat})` : ''} · sicurezza ${Math.round(plan.cls.confidence * 100)}%`} />
          <Line k="Perché" v={plan.cls.local ? plan.cls.localReason ?? plan.cls.reason : plan.cls.reason || '—'} />
          {plan.verdict === 'clarify' && plan.options ? <Line k="Ti chiederei" v={plan.options.join(' — ')} /> : null}
          {plan.selection?.ok ? (
            <>
              <Line k="Fornitore scelto e perché" v={plan.selection.explanation} />
              <Line k="Alternative in ordine" v={plan.selection.ranking.map((c) => c.provider.short).join(' › ')} />
              {plan.rewrite ? <Line k="Testo riscritto (quello che invierei)" v={`«${plan.prompt}»`} /> : <Line k="Testo che invierei" v={`«${plan.prompt}»`} />}
              {plan.rewrite ? <Body small muted>{plan.rewrite.note}</Body> : null}
              <Line k="Cosa uscirebbe dal telefono" v={plan.outgoing ? `${plan.outgoing.headline} ${plan.outgoing.notSent}` : '—'} />
              <Line k="Costo stimato" v={`circa ${(Math.round(plan.estCost * 1000) / 1000).toLocaleString('it-IT')} unità (stima da verificare) · circa ${plan.estTokens.toLocaleString('it-IT')} token`} />
              <Line k="Limite" v={plan.quota && !plan.quota.ok ? plan.quota.reason : 'Dentro i limiti del tuo piano.'} />
            </>
          ) : plan.selection ? <Line k="Fornitore" v={plan.selection.message} /> : null}
          <Line k="Risultato per l'utente" v={plan.message} />
          {plan.outgoing ? <Btn small ghost style={{ marginTop: 8 }} icon="shield" title="Mostra la richiesta di consenso" onPress={() => setConsent(true)} /> : null}
        </Card>
      ) : null}
      <ConsentPreview plan={plan} visible={consent} onClose={() => setConsent(false)} />
    </>
  );
}
