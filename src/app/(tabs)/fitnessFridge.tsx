import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { AiNote } from '@/components/AiNote';
import { FIT } from '@/components/fitness/kit';
import { Body, Btn, Card, H, Input, Page, Pill, Row, Sheet, TabRow } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { askSend, logSend } from '@/lib/aiConsent';
import { aiReadFiles, aiServerConfigured } from '@/lib/aiServer';
import { saveMediaToDrive } from '@/lib/driveSave';
import { FRIDGE_PROMPT, RECEIPT_ITEMS_PROMPT, lowStock, googleMayBeBetter, parseReceiptItems, parseTypedList, type Line, type PantryItem } from '@/lib/fitness/pantry';
import { Icon } from '@/lib/icons';
import { pickNetMedia, takeNetPhoto } from '@/lib/netMedia';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { useNet } from '@/store/network';
import { useFriends } from '@/store/friends';
import { peoplePool } from '@/lib/network';
import { usePantry } from '@/store/pantry';
import { toast } from '@/store/toast';
import { confirmClearFridge, confirmClearShopping } from '@/lib/clearData';

const UNITS = { g: 'g', ml: 'ml', pz: 'pz' } as const;
const fmt = (q: number, u: string) => `${Math.round(q * 10) / 10} ${u}`;

/** Il frigo virtuale e la lista della spesa: scontrino, scorte, ciò che sta finendo e condivisione. */
export default function Fridge() {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const p = usePantry();
  const [tab, setTab] = useState('Frigo');
  const [review, setReview] = useState<Line[] | null>(null);
  const [typed, setTyped] = useState(false);
  const [text, setText] = useState('');
  const [edit, setEdit] = useState<PantryItem | null>(null);
  const [qty, setQty] = useState('');
  const [share, setShare] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [busy, setBusy] = useState(false);
  const chats = useChat((s) => s.chats);
  const following = useNet((s) => s.following);
  const msgs = useChat((s) => s.messages);
  const friends = useFriends((s) => s.friends);
  const [who, setWho] = useState('');
  /* i contatti con cui scrivi di piu' vengono per primi; chi non e' tra questi si trova con la ricerca */
  const known = useMemo(() => {
    const names = new Set<string>();
    Object.values(chats).filter((c) => c.type === 'dm').forEach((c) => names.add(c.id.replace(/^dm:/, '')));
    following.forEach((n) => names.add(n));
    friends.filter((f) => f.status === 'accepted').forEach((f) => names.add(f.chat || f.name));
    const all = [...names].filter((n) => n && n !== me);
    const score = (n: string) => (msgs[`dm:${n}`]?.length ?? 0);
    return all.sort((a, b) => score(b) - score(a) || a.localeCompare(b));
  }, [chats, following, friends, msgs, me]);
  const pool = useMemo(() => { try { return peoplePool(me).filter((n) => n && n !== me && !known.includes(n)); } catch { return [] as string[]; } }, [me, known]);
  const q = who.trim().toLowerCase();
  const shown = q ? [...known, ...pool].filter((n) => n.toLowerCase().includes(q)).slice(0, 40) : known.slice(0, 12);
  const toggle = (n: string) => p.setShared(p.shared.includes(n) ? p.shared.filter((x) => x !== n) : [...p.shared, n]);
  const low = lowStock(p.items);

  /* l'ultima foto letta, per poterla rifare con Google se la lettura sembra debole */
  const [again, setAgain] = useState<{ uri: string; what: 'receipt' | 'fridge' } | null>(null);
  async function redoWithGoogle() {
    if (!again || busy) return;
    setBusy(true);
    try {
      toast(tl('Sto leggendo la foto: può volerci fino a un minuto.'));
      const lines = parseReceiptItems(await aiReadFiles(again.what === 'fridge' ? FRIDGE_PROMPT : RECEIPT_ITEMS_PROMPT, [{ uri: again.uri, mime: 'image/jpeg' }], 90000, again.what === 'fridge' ? 1000 : 2000, true));
      if (!lines.length) { toast(tl('Anche Google non ha riconosciuto prodotti: scrivi tu la lista.')); setTyped(true); return; }
      setReview(lines); setAgain(null);
    } catch (e) { toast(e instanceof Error && e.message ? e.message : tl('Google non ha risposto: riprova tra poco.')); } finally { setBusy(false); }
  }
  async function scan(camera: boolean, what: 'receipt' | 'fridge' = 'receipt') {
    setBusy(true);
    try {
      const m = camera ? await takeNetPhoto() : await pickNetMedia('photo');
      if (!m) return;
      saveMediaToDrive({ uri: m.uri, media: 'photo', from: what === 'fridge' ? 'Frigo' : 'Scontrino', ...(what === 'fridge' ? {} : { folder: 'Ricevute' }) });
      if (!aiServerConfigured) { toast(tl('Per leggere la foto serve il server AI, che qui non è collegato: scrivi tu la lista.')); setTyped(true); return; }
      if (!(await askSend('files', what === 'fridge' ? 'Foto del frigo' : 'Foto di uno scontrino'))) { toast(tl('Non invio la foto: scrivi tu la lista.')); setTyped(true); return; }
      logSend('files', 0, ['image/jpeg']);
      toast(tl('Sto leggendo la foto: può volerci fino a un minuto.'));
      const lines = parseReceiptItems(await aiReadFiles(what === 'fridge' ? FRIDGE_PROMPT : RECEIPT_ITEMS_PROMPT, [{ uri: m.uri, mime: 'image/jpeg' }], 90000, what === 'fridge' ? 1000 : 2000, what !== 'fridge'));
      if (!lines.length) { toast(tl('Non ho riconosciuto prodotti in questa foto: riprova più da vicino o scrivi tu la lista.')); setTyped(true); return; }
      setReview(lines);
      setAgain(googleMayBeBetter(what, lines) ? { uri: m.uri, what } : null);
    } catch (e) { const msg = e instanceof Error ? e.message : ''; toast(/tempo|time|abort/i.test(msg) ? tl('La lettura ha impiegato troppo tempo. Riprova con una foto più vicina e nitida, oppure scrivi tu la lista.') : msg || tl('Non riesco ad aprire la fotocamera')); setTyped(true); } finally { setBusy(false); }
  }
  const setLine = (i: number, patch: Partial<Line>) => setReview((r) => (r ?? []).map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const step = (u: string) => (u === 'pz' ? 1 : u === 'g' ? 50 : 100);
  const addReview = () => { if (!review) return; const n = p.addLines(review.filter((l) => l.name.trim() && l.qty > 0)); setReview(null); toast(tl('Aggiunti {0} prodotti al frigo', n)); };

  return (
    <Page id="fitnessFridge" back title={tl('Frigo e spesa')} backRight={<Btn small icon="share" title={p.shared.length ? tl('Condiviso con {0}', p.shared.length) : tl('Condividi frigo')} onPress={() => setShare(true)} />}>
      <TabRow options={['Frigo', 'Lista della spesa']} value={tab} onChange={setTab} />

      {tab === 'Frigo' ? (
        <>
          <Row gap={8} style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
            <Btn small icon="camera" title={busy ? tl('Leggo…') : tl('Scontrino')} disabled={busy} onPress={() => void scan(true)} />
            <Btn small icon="camera" title={tl('Foto del frigo')} disabled={busy} onPress={() => void scan(true, 'fridge')} />
            <Btn small ghost icon="image" title={tl('Da galleria')} disabled={busy} onPress={() => void scan(false)} />
            <Btn small ghost icon="edit" title={tl('Scrivi la lista')} onPress={() => setTyped(true)} />
            <Btn small ghost danger icon="trash" title={tl('Svuota il frigo')} disabled={!p.items.length} onPress={confirmClearFridge} />
          </Row>
          {low.length ? (
            <Card accent={t.warn}>
              <H>{tl('Sta finendo')}</H>
              {low.map((x) => <Body key={x.id} small>{x.name}: {fmt(x.qty, x.unit)}</Body>)}
              <Body small muted style={{ marginTop: 6 }}>{tl('Sono già nella lista della spesa.')}</Body>
            </Card>
          ) : null}
          {p.items.length ? p.items.map((x) => {
            const isLow = x.qty <= x.min;
            return (
              <Card key={x.id} onPress={() => { setEdit(x); setQty(String(x.qty)); }}>
                <Row><View style={{ flex: 1 }}><Body bold>{x.name}</Body><Body small muted>{isLow ? tl('Sta finendo') : tl('Va bene')}</Body></View><Text style={{ color: isLow ? t.warn : t.text, fontWeight: '800', fontSize: 16 }}>{fmt(x.qty, x.unit)}</Text></Row>
              </Card>
            );
          }) : <Card><Body muted>{tl('Il frigo è vuoto. Carica uno scontrino o scrivi cosa hai comprato.')}</Body></Card>}
          <Row gap={10}><View style={{ flex: 1 }}><Body>{tl('Scala dal frigo ciò che mangi')}</Body><Body small muted>{tl('Quando segni un pasto con i suoi ingredienti, le scorte calano da sole. Le quantità dei pezzi sono stime.')}</Body></View><Pill label={p.autoConsume ? tl('Sì') : tl('No')} on={p.autoConsume} onPress={() => p.setAutoConsume(!p.autoConsume)} /></Row>
        </>
      ) : (
        <>
          <Row gap={8}><View style={{ flex: 1 }}><Input value={newItem} onChangeText={setNewItem} placeholder={tl('Aggiungi (es. latte)')} onSubmitEditing={() => { p.addShop(newItem); setNewItem(''); }} /></View><Btn small icon="plus" title="" onPress={() => { p.addShop(newItem); setNewItem(''); }} /></Row>
          {p.shop.length ? p.shop.map((s) => (
            <Pressable key={s.id} accessibilityRole="checkbox" accessibilityState={{ checked: s.done }} onPress={() => p.toggleShop(s.id)} onLongPress={() => p.removeShop(s.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.border }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: s.done ? FIT : t.border, backgroundColor: s.done ? FIT : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{s.done ? <Icon name="check" size={14} color="#1c0b04" stroke={3} /> : null}</View>
              <View style={{ flex: 1 }}><Body style={s.done ? { opacity: 0.5, textDecorationLine: 'line-through' } : undefined}>{s.name}</Body>{s.auto ? <Body small muted>{tl('Stava finendo')}</Body> : null}</View>
              {s.qty ? <Body small muted>{fmt(s.qty, s.unit ?? '')}</Body> : null}
            </Pressable>
          )) : <Card><Body muted>{tl('La lista è vuota. Ciò che sta finendo nel frigo compare qui da solo.')}</Body></Card>}
          {p.plan ? <Btn ghost icon="note" title={tl('Prepara la lista dal piano alimentare')} onPress={() => { const n = p.shopForPlan(7).length; toast(n ? tl('Aggiunti {0} prodotti: ciò che serve per 7 giorni e non hai in frigo', n) : tl('In frigo hai già tutto per 7 giorni')); }} /> : null}
          <Body small muted>{tl('Tieni premuto su una voce per toglierla.')}</Body>
          <Btn small ghost danger icon="trash" style={{ alignSelf: 'flex-start' }} title={tl('Cancella tutta la lista')} disabled={!p.shop.length} onPress={confirmClearShopping} />
          {p.shop.some((s) => s.done) ? <Btn icon="check" title={tl('Spesa fatta: metti nel frigo')} onPress={() => toast(tl('Aggiunti {0} prodotti al frigo', p.finishShopping()))} /> : null}
          {p.shared.length && p.shop.some((s) => !s.done) ? <Btn ghost icon="share" title={tl('Manda la lista a chi condividi')} onPress={() => { p.shareShopping(); toast(tl('Lista inviata')); }} /> : null}
        </>
      )}
      <AiNote />

      <Sheet visible={!!review} title={tl('Cosa ho letto')} onClose={() => { setReview(null); setAgain(null); }}>
        <Body small muted style={{ marginBottom: 6 }}>{tl('Controlla prima di salvare: l\'AI può sbagliare nomi e quantità. Puoi cambiare il nome, la quantità e l\'unità, togliere le righe che non vanno e aggiungere altri alimenti.')}</Body>
        {(review ?? []).map((l, i) => (
          <View key={i} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.border, gap: 6 }}>
            <Row gap={8}>
              <View style={{ flex: 1 }}><Input value={l.name} onChangeText={(v) => setLine(i, { name: v })} placeholder={tl('Alimento')} accessibilityLabel={tl('Alimento')} /></View>
              <Pressable accessibilityRole="button" accessibilityLabel={tl('Togli')} hitSlop={8} onPress={() => setReview((r) => (r ?? []).filter((_, k) => k !== i))}><Icon name="x" size={18} color={t.muted} /></Pressable>
            </Row>
            <Row gap={8} style={{ justifyContent: 'flex-start' }}>
              <Pill label="−" onPress={() => setLine(i, { qty: Math.max(0, Math.round((l.qty - step(l.unit)) * 10) / 10) })} />
              <View style={{ width: 84 }}><Input value={String(l.qty)} onChangeText={(v) => setLine(i, { qty: Number(v.replace(',', '.')) || 0 })} keyboardType="numeric" accessibilityLabel={tl('Quantità')} /></View>
              <Pill label="+" onPress={() => setLine(i, { qty: Math.round((l.qty + step(l.unit)) * 10) / 10 })} />
              {(['pz', 'g', 'ml'] as const).map((u) => <Pill key={u} label={u} on={l.unit === u} onPress={() => setLine(i, { unit: u })} />)}
            </Row>
          </View>
        ))}
        {again ? (
          <View style={{ marginTop: 10, gap: 6 }}>
            <Body small muted>{tl('La lettura sembra incompleta. Google Gemini potrebbe leggerla meglio, ma per farlo la foto va a Google (fuori da UE e Svizzera): lo fai solo se tocchi qui sotto.')}</Body>
            <Btn small ghost icon="rotate" title={tl('Rifai con Google')} disabled={busy} onPress={() => void redoWithGoogle()} />
          </View>
        ) : null}
        <Btn style={{ marginTop: 10 }} small ghost icon="plus" title={tl('Aggiungi un alimento')} onPress={() => setReview((r) => [...(r ?? []), { name: '', qty: 1, unit: 'pz' } as Line])} />
        <Btn style={{ marginTop: 10 }} title={tl('Aggiungi al frigo')} disabled={!review?.some((l) => l.name.trim() && l.qty > 0)} onPress={addReview} />
      </Sheet>

      <Sheet visible={typed} title={tl('Scrivi cosa hai comprato')} onClose={() => setTyped(false)}>
        <Body small muted style={{ marginBottom: 6 }}>{tl('Una riga o separati da virgola. Es. 2 latte, 500 g pasta, 6 uova')}</Body>
        <Input value={text} onChangeText={setText} multiline maxLines={6} placeholder="2 latte, 500 g pasta, uova" />
        <Btn style={{ marginTop: 10 }} title={tl('Continua')} disabled={!text.trim()} onPress={() => { setReview(parseTypedList(text)); setText(''); setTyped(false); }} />
      </Sheet>

      <Sheet visible={!!edit} title={edit?.name ?? ''} onClose={() => setEdit(null)}>
        {edit ? (
          <>
            <Body small muted>{tl('Quanto ne è rimasto ({0})', UNITS[edit.unit])}</Body>
            <Input value={qty} onChangeText={setQty} keyboardType="numeric" />
            <Row gap={8} style={{ marginTop: 10 }}>
              <Btn style={{ flex: 1 }} title={tl('Salva')} onPress={() => { p.setQty(edit.id, Number(qty.replace(',', '.')) || 0); setEdit(null); }} />
              <Btn style={{ flex: 1 }} ghost danger title={tl('Toglilo')} onPress={() => { p.removeItem(edit.id); setEdit(null); }} />
            </Row>
          </>
        ) : null}
      </Sheet>

      <Sheet visible={share} title={tl('Condividi il frigo')} onClose={() => { setShare(false); setWho(''); }}>
        <Body small muted>{tl('Chi scegli riceve la lista della spesa in chat quando qualcosa sta finendo. Prima i contatti con cui scrivi di più.')}</Body>
        <Input placeholder={tl('Cerca un contatto per nome')} value={who} onChangeText={setWho} />
        {p.shared.length ? <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 6 }} gap={8}>{p.shared.map((n) => <Pill key={`s-${n}`} label={`${n}  ✕`} on onPress={() => toggle(n)} />)}</Row> : null}
        {shown.length ? <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>{shown.map((n) => <Pill key={n} label={n} on={p.shared.includes(n)} onPress={() => toggle(n)} />)}</Row> : <Body muted>{tl('Non hai ancora contatti.')}</Body>}
        {q && !shown.some((n) => n.toLowerCase() === q) ? <Btn style={{ marginTop: 10 }} ghost icon="plus" title={tl('Condividi con «{0}»', who.trim())} onPress={() => { if (!p.shared.includes(who.trim())) toggle(who.trim()); setWho(''); }} /> : null}
        <Body small muted style={{ marginTop: 10 }}>{tl('Per ora la lista arriva a loro nella chat. Il frigo vero e proprio resta sul tuo telefono.')}</Body>
      </Sheet>
    </Page>
  );
}
