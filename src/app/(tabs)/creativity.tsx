import { useRef, useState } from 'react';
import { View } from 'react-native';

import { SpecView } from '@/components/creative/SpecView';
import { Text } from '@/components/T';
import { Body, Btn, Card, Empty, H, Input, Item, Page, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { confirmDelete } from '@/lib/confirm';
import { askBuilder } from '@/lib/creative/builder';
import { TERMS_POINTS, TERMS_VERSION } from '@/lib/creative/terms';
import { useCreations, type Creation, type CreationStatus, type Visibility } from '@/store/creations';
import { toast } from '@/store/toast';

const STATUS: Record<CreationStatus, string> = { bozza: 'Bozza', in_revisione: 'In revisione', approvata: 'Approvata', rifiutata: 'Da rivedere' };
const VIS: { v: Visibility; label: string; hint: string }[] = [
  { v: 'free', label: 'Gratis per tutti', hint: 'Compare nella lista degli aggiornamenti e chiunque può attivarla.' },
  { v: 'private', label: 'Solo mia', hint: 'La attivi solo tu. Resta tua e non compare agli altri.' },
  { v: 'shared', label: 'Con chi dico io', hint: 'La attivano solo le persone che scrivi qui sotto.' },
];

/** Creatività: racconti un'idea, Theia costruisce un'anteprima (solo blocchi, nessun codice), la mandi in revisione; se approvata diventa un aggiornamento con la visibilità che scegli. */
export default function Creativity() {
  const th = useTheme();
  const items = useCreations((s) => s.items);
  const [openId, setOpenId] = useState<string | null>(null);
  const cur = items.find((x) => x.id === openId) ?? null;
  if (cur) return <Editor c={cur} onBack={() => setOpenId(null)} />;
  const mine = items.filter((x) => x.installed && x.spec);
  return (
    <Page id="creativity" title={tl('Creatività')} back>
      <Card>
        <H>{tl('Racconta un\'idea')}</H>
        <Body small muted style={{ marginBottom: 10 }}>{tl('Dimmi cosa vorresti nell\'app: costruisco un\'anteprima. Se ti piace la mandi in revisione e, se la approviamo, diventa un aggiornamento.')}</Body>
        <Btn icon="plus" title={tl('Nuova idea')} onPress={() => setOpenId(useCreations.getState().create().id)} />
      </Card>
      {mine.length ? (
        <Card>
          <H>{tl('Le mie funzioni')}</H>
          {mine.map((c, i) => <Item key={c.id} last={i === mine.length - 1} onPress={() => setOpenId(c.id)}><Row><Body bold>{c.title || tl('Senza titolo')}</Body><Body small muted>{tl('Attiva')}</Body></Row></Item>)}
        </Card>
      ) : null}
      <Card>
        <H>{tl('Le mie idee')}</H>
        {items.length ? items.map((c, i) => (
          <Item key={c.id} last={i === items.length - 1} onPress={() => setOpenId(c.id)}>
            <Row><View style={{ flex: 1 }}><Body bold numberOfLines={1}>{c.title || c.spec?.title || tl('Senza titolo')}</Body><Body small muted>{new Date(c.createdAt).toLocaleDateString()}</Body></View><Text style={{ color: c.status === 'approvata' ? th.positive : th.muted, fontSize: 12, fontWeight: '700' }}>{tl(STATUS[c.status])}</Text></Row>
          </Item>
        )) : <Empty text={tl('Ancora nessuna idea: la prima è a un tocco.')} />}
      </Card>
    </Page>
  );
}

function Editor({ c, onBack }: { c: Creation; onBack: () => void }) {
  const th = useTheme();
  const { patch, remove, restore } = useCreations.getState();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [terms, setTerms] = useState(false);
  const [agree, setAgree] = useState(false);
  const [contact, setContact] = useState(false);
  const [names, setNames] = useState(c.sharedWith.join(', '));
  const editable = c.status === 'bozza' || c.status === 'rifiutata';
  const sent = useRef(false);

  const send = async () => {
    const msg = text.trim();
    if (!msg || busy) return;
    setText(''); setBusy(true);
    const chat = [...c.chat, { who: 'me' as const, text: msg }];
    patch(c.id, { chat });
    try {
      const r = await askBuilder(chat, c.spec);
      patch(c.id, { chat: [...chat, { who: 'ai', text: r.text }], spec: r.spec, title: r.spec?.title ?? c.title });
    } catch { patch(c.id, { chat: [...chat, { who: 'ai', text: tl('Dammi un attimo e riproviamo: riscrivimi l\'idea quando vuoi.') }] }); }
    setBusy(false);
  };
  const submit = () => {
    if (!agree || sent.current) return;
    sent.current = true;
    patch(c.id, { status: 'in_revisione', submittedAt: Date.now(), terms: { version: TERMS_VERSION, at: Date.now(), contactOk: contact } });
    setTerms(false); toast(tl('Inviata in revisione: ti faremo sapere.'));
  };
  const del = () => confirmDelete(tl('l\'idea «{0}»', c.title || tl('Senza titolo')), () => { remove(c.id); onBack(); }, () => restore(c));
  const setVis = (v: Visibility) => patch(c.id, { visibility: v, ...(v === 'shared' ? {} : { sharedWith: [] }) });
  const saveNames = (v: string) => { setNames(v); patch(c.id, { sharedWith: v.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 20) }); };

  return (
    <Page id="creativity" title={c.title || tl('Nuova idea')} back onBack={onBack}>
      <Card>
        {c.chat.length === 0 ? <Body muted>{tl('Di cosa vuoi parlare? Per esempio: «una pagina per seguire le mie abitudini di studio».')}</Body> : null}
        {c.chat.map((m, i) => (
          <View key={i} style={{ alignSelf: m.who === 'me' ? 'flex-end' : 'flex-start', maxWidth: '88%', backgroundColor: m.who === 'me' ? th.accent + '33' : th.tile, borderRadius: 14, padding: 10, marginBottom: 8 }}>
            <Body>{m.text}</Body>
          </View>
        ))}
        {editable ? (
          <>
            <Input value={text} onChangeText={setText} placeholder={tl('Descrivi l\'idea o cosa cambiare…')} multiline maxLines={4} />
            <Btn small icon="send" title={busy ? tl('Ci penso…') : tl('Invia')} disabled={busy || !text.trim()} onPress={() => void send()} />
          </>
        ) : null}
      </Card>

      {c.spec ? (
        <Card>
          <View style={{ backgroundColor: th.tile, borderRadius: 10, padding: 8, marginBottom: 10 }}><Body small muted>{c.installed ? tl('Scheda attiva nella tua app.') : tl('ANTEPRIMA: è una demo, non si può ancora usare davvero.')}</Body></View>
          <SpecView spec={c.spec} demo={!c.installed} />
        </Card>
      ) : null}

      {editable && c.spec ? <Btn icon="check" title={tl('Manda in revisione')} onPress={() => { setAgree(false); setContact(false); sent.current = false; setTerms(true); }} /> : null}
      {c.status === 'rifiutata' && c.reviewNote ? <Card><Body small muted>{c.reviewNote}</Body></Card> : null}
      {c.status === 'in_revisione' ? (
        <Card>
          <Body bold>{tl('È in revisione')}</Body>
          <Body small muted style={{ marginTop: 2 }}>{tl('La guardiamo e ti avvisiamo. Se la approviamo, qui scegli chi può usarla.')}</Body>
          {__DEV__ ? <Row style={{ justifyContent: 'flex-start', marginTop: 8 }} gap={8}><Btn small ghost title="Test: approva" onPress={() => patch(c.id, { status: 'approvata' })} /><Btn small ghost title="Test: rifiuta" onPress={() => patch(c.id, { status: 'rifiutata', reviewNote: 'Ci servono più dettagli su come funzionerebbe.' })} /></Row> : null}
        </Card>
      ) : null}
      {c.status === 'approvata' ? (
        <Card>
          <H>{tl('Approvata: chi può usarla?')}</H>
          {VIS.map((o) => (
            <View key={o.v} style={{ marginBottom: 8 }}>
              <Pill label={tl(o.label)} on={c.visibility === o.v} onPress={() => setVis(o.v)} />
              {c.visibility === o.v ? <Body small muted style={{ marginTop: 4 }}>{tl(o.hint)}</Body> : null}
            </View>
          ))}
          {c.visibility === 'shared' ? <Input value={names} onChangeText={saveNames} placeholder={tl('Nomi separati da virgola')} /> : null}
          <Btn style={{ marginTop: 6 }} title={c.installed ? tl('Disattiva dalla mia app') : tl('Attiva nella mia app')} ghost={c.installed} onPress={() => patch(c.id, { installed: !c.installed })} />
        </Card>
      ) : null}
      <Btn ghost danger small style={{ marginTop: 6 }} title={tl('Elimina l\'idea')} onPress={del} />

      <Sheet visible={terms} title={tl('Prima di mandarla')} onClose={() => setTerms(false)}>
        <Body small muted style={{ marginBottom: 10 }}>{tl('Poche cose chiare:')}</Body>
        {TERMS_POINTS.map((p, i) => <Body key={i} small style={{ marginBottom: 6 }}>{`•  ${tl(p)}`}</Body>)}
        <View style={{ gap: 8, marginVertical: 12 }}>
          <Pill label={tl('Ho letto e accetto le condizioni')} on={agree} onPress={() => setAgree(!agree)} />
          <Pill label={tl('Potete contattarmi per collaborare (facoltativo)')} on={contact} onPress={() => setContact(!contact)} />
        </View>
        <Btn title={tl('Manda in revisione')} disabled={!agree} onPress={submit} />
      </Sheet>
    </Page>
  );
}
