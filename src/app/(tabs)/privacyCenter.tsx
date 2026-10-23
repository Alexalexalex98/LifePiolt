import { useState } from 'react';
import { t as tl } from '@/i18n/core';
import { Share, View } from 'react-native';

import { SendLog } from '@/components/aiSettings/SendLog';
import { Body, Btn, Card, H, Pill, Page, Row } from '@/components/ui';
import { confirmDelete } from '@/lib/confirm';
import { LEGAL } from '@/lib/legal';
import { go } from '@/lib/nav';
import { CATS, exportJson, labelOf, modeOf, type CatId, type Mode } from '@/lib/privacyCenter';
import { useAiRouter } from '@/store/aiRouter';
import { useClub } from '@/store/club';
import { useFin } from '@/store/finance';
import { useFitness } from '@/store/fitness';
import { useHealth } from '@/store/health';
import { useTheiaMemory } from '@/store/theiaMemory';
import { useLife } from '@/store/life';
import { useMindSpace } from '@/store/mindSpace';
import { usePet } from '@/store/pet';
import { useLpMoney } from '@/store/lpMoney';
import { useNet } from '@/store/network';
import { usePantry } from '@/store/pantry';
import { useShifts } from '@/store/shifts';
import { toast } from '@/store/toast';
import { useTravel } from '@/store/travel';

type AnyStore = { getState: () => unknown; setState: (s: never, replace: true) => void; getInitialState: () => unknown };
const STORES: Record<CatId, AnyStore[]> = {
  agenda: [useLife, useShifts] as unknown as AnyStore[],
  finance: [useFin, useLpMoney] as unknown as AnyStore[],
  health: [useHealth, useMindSpace, usePet] as unknown as AnyStore[],
  fitness: [useFitness, usePantry] as unknown as AnyStore[],
  travel: [useTravel] as unknown as AnyStore[],
  network: [useNet, useClub] as unknown as AnyStore[],
};

const MODES: { m: Mode; label: string }[] = [{ m: 'ask', label: 'Chiedi ogni volta' }, { m: 'always', label: 'Consenti sempre' }, { m: 'never', label: 'Mai' }];

export default function PrivacyCenter() {
  const modes = useAiRouter((s) => s.dataConsent);
  const history = useAiRouter((s) => s.consentLog);
  const { setDataConsent, revokeAllConsents } = useAiRouter.getState();
  const [showHist, setShowHist] = useState(false);
  const learned = useTheiaMemory((s) => s.entries.length);

  const exportCat = async (id: CatId) => {
    const data = Object.fromEntries(STORES[id].map((s, i) => [`parte${i + 1}`, s.getState()]));
    try { await Share.share({ message: exportJson({ categoria: labelOf(id), esportatoIl: new Date().toISOString(), dati: data }), title: `LifePilot: ${tl(labelOf(id))}` }); } catch { toast('Esportazione non riuscita'); }
  };
  const wipeCat = (id: CatId) => confirmDelete(tl('tutti i dati di «{0}»', tl(labelOf(id))), () => { for (const s of STORES[id]) s.setState(s.getInitialState() as never, true); toast('Dati cancellati dal telefono'); }, () => undefined);

  return (
    <Page id="privacyCenter" title="Centro Privacy" back>
      <Body small muted style={{ marginBottom: 10 }}>Qui decidi tu su tutti i tuoi dati: cosa Theia può mandare all'AI esterna, cosa esportare e cosa cancellare. Valgono le regole del GDPR (UE) e della nLPD (Svizzera).</Body>

      <Card>
        <H>Cosa può vedere l'AI esterna</H>
        <Body small muted style={{ marginTop: 4 }}>Theia legge tutto sul telefono. Solo quando risponde con l'AI esterna (Google Gemini, tramite il nostro server) manda le parti che servono, e solo come scegli qui sotto. Finanze, salute e cibo sono dati particolarmente sensibili: non escono mai senza il tuo consenso.</Body>
        {CATS.map((c) => (
          <View key={c.id} style={{ marginTop: 12 }}>
            <Body bold>{c.label}</Body>
            <Body small muted>{c.what}</Body>
            <Row gap={8} style={{ marginTop: 6, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
              {MODES.map((x) => <Pill key={x.m} label={x.label} on={modeOf(modes, c.id) === x.m} onPress={() => { setDataConsent([c.id], x.m, 'Dal Centro Privacy'); toast('Scelta salvata'); }} />)}
            </Row>
          </View>
        ))}
        <Btn small ghost style={{ marginTop: 14 }} title="Revoca tutti i consensi" onPress={() => { revokeAllConsents(); toast('Consensi revocati: da ora chiedo ogni volta'); }} />
        <Btn small ghost style={{ marginTop: 8 }} title={showHist ? 'Nascondi la cronologia delle scelte' : 'Cronologia delle tue scelte'} onPress={() => setShowHist(!showHist)} />
        {showHist ? (history.length ? history.slice(-20).reverse().map((e) => <Body key={`${e.ts}-${e.cat}`} small muted style={{ marginTop: 4 }}>{`${new Date(e.ts).toLocaleString()} · ${tl(labelOf(e.cat))} · ${tl(e.note ?? e.mode)}`}</Body>) : <Body small muted style={{ marginTop: 6 }}>Nessuna scelta registrata.</Body>) : null}
      </Card>

      <Card>
        <H>I tuoi dati, categoria per categoria</H>
        <Body small muted style={{ marginTop: 4 }}>Esporta una copia leggibile (portabilità) o cancella dal telefono. La cancellazione riporta quella parte dell'app allo stato iniziale e non si può annullare: esporta prima se ti serve.</Body>
        {CATS.map((c) => (
          <View key={c.id} style={{ marginTop: 12 }}>
            <Body bold>{c.label}</Body>
            <Row gap={8} style={{ marginTop: 6, justifyContent: 'flex-start' }}>
              <Btn small ghost icon="share" title="Esporta" onPress={() => void exportCat(c.id)} />
              <Btn small ghost danger icon="trash" title="Cancella" onPress={() => wipeCat(c.id)} />
            </Row>
          </View>
        ))}
        <View style={{ gap: 8, marginTop: 14 }}>
          <Btn small ghost icon="lock" title="Backup cifrato e archivio" onPress={() => go('security')} />
          <Btn small ghost danger title="Elimina tutti i miei dati e l'account" onPress={() => go('settings')} />
        </View>
      </Card>

      <Card>
        <H>Cosa ha imparato Theia</H>
        <Body small muted style={{ marginTop: 4 }}>Quando l'AI risponde a una domanda di conoscenza generale (non personale), Theia la ricorda sul telefono e la prossima volta risponde da sola. Non impara mai dai tuoi dati personali. Puoi cancellare tutto quando vuoi.</Body>
        <Body small style={{ marginTop: 6 }}>{`${tl('Risposte ricordate')}: ${learned}`}</Body>
        <Btn small ghost danger style={{ marginTop: 8 }} title="Cancella ciò che ha imparato" onPress={() => { useTheiaMemory.getState().clear(); toast('Memoria di Theia cancellata'); }} />
      </Card>

      <SendLog />

      <Card>
        <H>Documenti legali</H>
        <View style={{ gap: 8, marginTop: 8 }}>
          <Btn small ghost icon="file" title="Informativa sulla privacy (testo completo)" onPress={() => go('legalDoc', { doc: 'privacy' })} />
          <Btn small ghost icon="file" title="Termini di servizio" onPress={() => go('legalDoc', { doc: 'terms' })} />
        </View>
      </Card>

      <Card>
        <H>Informativa sulla privacy (GDPR / nLPD)</H>
        <Body small muted style={{ marginTop: 4 }}>{LEGAL.controller ? `${tl('Titolare del trattamento')}: ${LEGAL.controller}, ${LEGAL.address}.${LEGAL.privacyEmail ? ` ${tl('Contatto privacy')}: ${LEGAL.privacyEmail}.` : ''}${LEGAL.dpo ? ` ${tl('Responsabile protezione dati')}: ${LEGAL.dpo}.` : ''}` : tl('Titolare del trattamento: in corso di definizione prima del lancio.')}</Body>
        <Body bold style={{ marginTop: 10 }}>Quali dati e perché</Body>
        <Body small muted>I dati che inserisci nell'app (agenda, finanze, salute, cibo, viaggi, rete) restano sul tuo telefono e servono a farti funzionare le funzioni dell'app. Non vendiamo i tuoi dati e non li usiamo per la pubblicità.</Body>
        <Body bold style={{ marginTop: 10 }}>Base giuridica</Body>
        <Body small muted>Per mandare i tuoi dati all'AI esterna: il tuo consenso esplicito (art. 6.1.a e 9.2.a GDPR; consenso nLPD). Per il funzionamento dell'app sul telefono: l'esecuzione del servizio che hai richiesto. Puoi revocare il consenso quando vuoi, senza conseguenze sulle funzioni che restano sul telefono.</Body>
        <Body bold style={{ marginTop: 10 }}>A chi vanno e dove</Body>
        <Body small muted>Solo se consenti: al nostro server e al servizio AI (Google Gemini), per la singola richiesta. Il trattamento può avvenire fuori da UE e Svizzera, con le garanzie previste dalla legge (clausole contrattuali standard o decisione di adeguatezza).</Body>
        <Body bold style={{ marginTop: 10 }}>Per quanto tempo</Body>
        <Body small muted>Sul telefono finché non li cancelli tu. Le richieste all'AI non vengono conservate da noi; nel registro degli invii restano solo tipo, data e dimensione.</Body>
        <Body bold style={{ marginTop: 10 }}>I tuoi diritti</Body>
        <Body small muted>Accesso e portabilità (Esporta), rettifica (modifica nell'app), cancellazione (Cancella), limitazione e opposizione (consensi «Mai»), revoca del consenso. Puoi presentare reclamo all'autorità: in Svizzera l'IFPDT (EDÖB), in Italia il Garante per la protezione dei dati personali, negli altri paesi UE la tua autorità nazionale.</Body>
        <Body bold style={{ marginTop: 10 }}>Minori</Body>
        <Body small muted>L'app è per persone dai 16 anni in su.</Body>
        <Body small muted style={{ marginTop: 10 }}>L'AI può sbagliare. Le informazioni su salute e finanze sono indicative e non sostituiscono un medico, un dietista o un consulente.</Body>
      </Card>
    </Page>
  );
}
