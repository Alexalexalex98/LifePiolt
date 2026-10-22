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
import { RECEIPT_ITEMS_PROMPT, lowStock, parseReceiptItems, parseTypedList, type Line, type PantryItem } from '@/lib/fitness/pantry';
import { Icon } from '@/lib/icons';
import { pickNetMedia, takeNetPhoto } from '@/lib/netMedia';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { useNet } from '@/store/network';
import { usePantry } from '@/store/pantry';
import { toast } from '@/store/toast';

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
  const people = useMemo(() => [...new Set([...Object.values(chats).filter((c) => c.type === 'dm').map((c) => c.id.replace(/^dm:/, '')), ...following])].filter((n) => n && n !== me), [chats, following, me]);
  const low = lowStock(p.items);

  async function scan(camera: boolean) {
    setBusy(true);
    try {
      const m = camera ? await takeNetPhoto() : await pickNetMedia('photo');
      if (!m) return;
      saveMediaToDrive({ uri: m.uri, media: 'photo', from: 'Scontrino', folder: 'Ricevute' });
      if (!aiServerConfigured) { toast(tl('Per leggere lo scontrino serve il server AI, che qui non è collegato: scrivi tu la lista.')); setTyped(true); return; }
      if (!(await askSend('files', 'Foto di uno scontrino'))) { toast(tl('Non invio la foto: scrivi tu la lista.')); setTyped(true); return; }
      logSend('files', 0, ['image/jpeg']);
      const lines = parseReceiptItems(await aiReadFiles(RECEIPT_ITEMS_PROMPT, [{ uri: m.uri, mime: 'image/jpeg' }]));
      if (!lines.length) { toast(tl('Non riesco a leggere i prodotti: scrivi tu la lista.')); setTyped(true); return; }
      setReview(lines);
    } catch (e) { toast(e instanceof Error ? e.message : tl('Non riesco ad aprire la fotocamera')); } finally { setBusy(false); }
  }
  const addReview = () => { if (!review) return; const n = p.addLines(review); setReview(null); toast(tl('Aggiunti {0} prodotti al frigo', n)); };

  return (
    <Page id="fitnessFridge" back title={tl('Frigo e spesa')}>
      <TabRow options={['Frigo', 'Lista della spesa']} value={tab} onChange={setTab} />
      <Card accent={FIT}>
        <Row gap={10}>
          <Icon name="people" size={22} color={FIT} />
          <View style={{ flex: 1 }}>
            <Body bold>{p.shared.length ? tl('Condiviso con {0}', p.shared.join(', ')) : tl('Solo tuo')}</Body>
            <Body small muted>{tl('Se lo condividi, la lista della spesa arriva a loro in chat quando qualcosa sta finendo.')}</Body>
          </View>
          <Btn small ghost title={tl('Scegli')} onPress={() => setShare(true)} />
        </Row>
      </Card>

      {tab === 'Frigo' ? (
        <>
          <Row gap={8} style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
            <Btn small icon="camera" title={busy ? tl('Leggo…') : tl('Scontrino')} disabled={busy} onPress={() => void scan(true)} />
            <Btn small ghost icon="image" title={tl('Da galleria')} disabled={busy} onPress={() => void scan(false)} />
            <Btn small ghost icon="edit" title={tl('Scrivi la lista')} onPress={() => setTyped(true)} />
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
          <Body small muted>{tl('Tieni premuto su una voce per toglierla.')}</Body>
          {p.shop.some((s) => s.done) ? <Btn icon="check" title={tl('Spesa fatta: metti nel frigo')} onPress={() => toast(tl('Aggiunti {0} prodotti al frigo', p.finishShopping()))} /> : null}
          {p.shared.length && p.shop.some((s) => !s.done) ? <Btn ghost icon="share" title={tl('Manda la lista a chi condividi')} onPress={() => { p.shareShopping(); toast(tl('Lista inviata')); }} /> : null}
        </>
      )}
      <AiNote />

      <Sheet visible={!!review} title={tl('Cosa ho letto')} onClose={() => setReview(null)}>
        <Body small muted style={{ marginBottom: 6 }}>{tl('Controlla: l\'AI può sbagliare nomi e quantità. Togli le righe che non vanno.')}</Body>
        {(review ?? []).map((l, i) => (
          <Row key={i} style={{ paddingVertical: 6 }}><View style={{ flex: 1 }}><Body>{l.name}</Body></View><Body muted>{fmt(l.qty, l.unit)}</Body><Pressable accessibilityRole="button" accessibilityLabel={tl('Togli')} hitSlop={8} onPress={() => setReview((r) => (r ?? []).filter((_, k) => k !== i))}><Icon name="x" size={18} color={t.muted} /></Pressable></Row>
        ))}
        <Btn style={{ marginTop: 10 }} title={tl('Aggiungi al frigo')} disabled={!review?.length} onPress={addReview} />
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

      <Sheet visible={share} title={tl('Condividi con')} onClose={() => setShare(false)}>
        {people.length ? <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>{people.map((n) => <Pill key={n} label={n} on={p.shared.includes(n)} onPress={() => p.setShared(p.shared.includes(n) ? p.shared.filter((x) => x !== n) : [...p.shared, n])} />)}</Row> : <Body muted>{tl('Non hai ancora contatti: aggiungi qualcuno dalle chat.')}</Body>}
        <Body small muted style={{ marginTop: 10 }}>{tl('Per ora la lista arriva a loro nella chat. Il frigo vero e proprio resta sul tuo telefono.')}</Body>
      </Sheet>
    </Page>
  );
}
