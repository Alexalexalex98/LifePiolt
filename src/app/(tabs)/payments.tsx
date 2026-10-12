import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import { Text } from '@/components/T';

import { LpTag, UserAvatar } from '@/components/network';
import { PayQr } from '@/components/PayQr';
import { QrScanner } from '@/components/QrScanner';
import { Body, Btn, Card, Empty, H, Input, Item, Page, Row, Seg, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { fmtDate } from '@/i18n/format';
import { Icon } from '@/lib/icons';
import { CASH_FEE_PCT, buildPayLink, parsePayLink, payLinkFits, splitPayment, type PayRequest, type ReceiveMode } from '@/lib/payments';
import { receiveLP, sendLP } from '@/lib/paymentActions';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';
import { t as tl } from '@/i18n/core';

const TABS = ['Ricevi', 'Invia', 'Movimenti'] as const;
type Tab = (typeof TABS)[number];
const num = (s: string) => Math.floor(parseFloat(s.replace(',', '.')) || 0);

/** Pagamenti: QR proprietario per ricevere, invio a chiunque (QR, chat, LifePoints) e movimenti. Si paga e si riceve solo in LifePoints; chi riceve può scegliere il denaro (commissione 2,5%). */
export default function Payments() {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const demo = useApp((s) => s.demo);
  const { to: toParam, tab: tabParam } = useLocalSearchParams<{ to?: string; tab?: string }>();
  const balance = useNet((s) => s.lifePoints);
  const mode: ReceiveMode = 'lp'; // nell'app si paga e si riceve solo in LifePoints
  const payments = useNet((s) => s.payments) ?? [];
  const people = useNet((s) => s.suggested);
  const [tab, setTab] = useState<Tab>((TABS as readonly string[]).includes(tabParam ?? '') ? (tabParam as Tab) : toParam ? 'Invia' : 'Ricevi');
  // ricevi
  const [reqAmt, setReqAmt] = useState('');
  // invia
  const [to, setTo] = useState(toParam ?? '');
  const [amt, setAmt] = useState('');
  const [note, setNote] = useState('');
  const [code, setCode] = useState('');
  const [scan, setScan] = useState(false);
  const [confirm, setConfirm] = useState<{ req: PayRequest; amount: number } | null>(null);

  const amount = num(reqAmt);
  const link = buildPayLink({ to: me, amount: amount || undefined, mode });
  const lp = (n: number, size = 14) => <Row gap={2}><Text style={{ color: t.text, fontWeight: '800', fontSize: size + 2 }}>{n}</Text><LpTag size={size} /></Row>;

  function readCode(text: string) {
    const r = parsePayLink(text);
    setScan(false);
    if (!r) { toast('Questo non è un codice di pagamento LifePilot'); return; }
    if (r.to === me) { toast('Questo è il tuo codice: non puoi pagare te stesso'); return; }
    setTo(r.to); if (r.amount) setAmt(String(r.amount));
    setConfirm({ req: r, amount: r.amount ?? num(amt) });
    setCode('');
  }
  function pay(r: { to: string; mode: ReceiveMode }, a: number, via: 'qr' | 'lifepoints') {
    const res = sendLP(r.to, a, { note, mode: r.mode, via });
    toast(res.message);
    if (res.ok) { setAmt(''); setNote(''); setConfirm(null); setTab('Movimenti'); }
  }

  return (
    <Page id="payments" back title="Pagamenti">
      <Seg options={[...TABS]} value={tab} onChange={(v) => setTab(v as Tab)} />

      {tab === 'Ricevi' && (
        <>
          <Card style={{ alignItems: 'center' }}>
            <PayQr text={payLinkFits(link) ? link : buildPayLink({ to: me.slice(0, 30), amount: amount || undefined, mode })} size={220} />
            <Body bold style={{ marginTop: 12 }}>{me}</Body>
            <Body small muted style={{ textAlign: 'center', marginTop: 2 }}>Chi scansiona questo QR ti paga in LifePoints, da qualsiasi parte del mondo.</Body>
          </Card>
          <Card>
            <H>Importo (facoltativo)</H>
            <Input keyboardType="number-pad" placeholder="Se vuoto, lo sceglie chi paga" value={reqAmt} onChangeText={setReqAmt} />
            <Btn ghost icon="share" title="Condividi il codice" onPress={async () => { try { await Share.share({ message: link }); } catch { toast('Non riesco a condividere'); } }} />
          </Card>
          <Card><Body small muted>Nell'app si paga e si riceve solo in LifePoints, senza commissioni. Il denaro entra solo per essere convertito in LifePoints.</Body></Card>
          {demo && <Btn ghost icon="coin" title="Solo demo: simula un pagamento ricevuto" onPress={() => { const r = receiveLP(people[0] ?? 'Marco T.', 40, { via: 'qr', note: 'Grazie!' }); toast(r ? (r.mode === 'cash' ? `Ricevuti ${r.net} in denaro (commissione ${r.fee})` : `Ricevuti ${r.amount} LP`) : 'Errore'); }} />}
        </>
      )}

      {tab === 'Invia' && (
        <>
          <Card>
            <H>Paga con un QR</H>
            <Btn icon="camera" title="Scansiona il QR" onPress={() => setScan(true)} />
            <Input autoCapitalize="none" placeholder="Oppure incolla il codice (lp://pay/…)" value={code} onChangeText={(v) => { setCode(v); if (v.startsWith('lp://pay/')) readCode(v); }} />
          </Card>
          <Card>
            <H>Invia LifePoints a una persona</H>
            <Input placeholder="Nome della persona" value={to} onChangeText={setTo} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {people.filter((n) => n !== me).slice(0, 6).map((n) => (
                <Pressable key={n} onPress={() => setTo(n)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: to === n ? t.text : t.chip }}>
                  <UserAvatar name={n} size={22} /><Text style={{ color: to === n ? t.onText : t.text, fontSize: 13, fontWeight: '600' }}>{n.split(' ')[0]}</Text>
                </Pressable>
              ))}
            </View>
            <Input keyboardType="number-pad" placeholder="Quanti LifePoints" value={amt} onChangeText={setAmt} />
            <Input placeholder="Messaggio (facoltativo)" maxLength={120} value={note} onChangeText={setNote} />
            <Row><Body muted>Il tuo saldo</Body>{lp(balance)}</Row>
            <Btn style={{ marginTop: 10 }} title="Invia" onPress={() => pay({ to, mode: 'lp' }, num(amt), 'lifepoints')} />
            <Body small muted style={{ marginTop: 8 }}>Puoi inviare LifePoints a chiunque, anche dalla chat con la persona.</Body>
          </Card>
        </>
      )}

      {tab === 'Movimenti' && (
        <Card>
          {payments.length === 0 ? <Empty text="Ancora nessun pagamento." /> : payments.map((p, i) => (
            <Item key={p.id} last={i === payments.length - 1}>
              <Row gap={10}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}><Icon name={p.dir === 'in' ? 'arrow-down' : 'arrow-up'} size={16} color={p.dir === 'in' ? t.positive : t.text} /></View>
                <View style={{ flex: 1 }}>
                  <Body bold>{p.dir === 'in' ? tl('Da {0}', p.peer) : tl('A {0}', p.peer)}</Body>
                  <Body small muted>{fmtDate(new Date(p.ts), { day: 'numeric', month: 'short' })}{p.note ? ` · ${p.note}` : ''}{p.dir === 'in' && p.mode === 'cash' ? tl(' · in denaro, commissione {0}', p.fee) : ''}</Body>
                </View>
                <Row gap={2}><Text style={{ color: p.dir === 'in' ? t.positive : t.text, fontWeight: '800', fontSize: 16 }}>{p.dir === 'in' ? '+' : '-'}{p.amount}</Text><LpTag size={13} /></Row>
              </Row>
            </Item>
          ))}
        </Card>
      )}

      <Sheet visible={scan} title="Scansiona il QR" onClose={() => setScan(false)}>
        {scan && <QrScanner onCode={readCode} onClose={() => setScan(false)} />}
      </Sheet>
      <Sheet visible={!!confirm} title="Conferma il pagamento" onClose={() => setConfirm(null)}>
        {confirm && (
          <>
            <Row gap={10} style={{ justifyContent: 'flex-start' }}><UserAvatar name={confirm.req.to} size={44} /><Body bold style={{ fontSize: 17 }}>{confirm.req.to}</Body></Row>
            {confirm.req.amount ? <View style={{ marginTop: 12 }}><Row><Body muted>Importo</Body>{lp(confirm.req.amount)}</Row></View> : <Input keyboardType="number-pad" placeholder="Quanti LifePoints" value={amt} onChangeText={(v) => { setAmt(v); setConfirm({ ...confirm, amount: num(v) }); }} />}
            <Input placeholder="Messaggio (facoltativo)" maxLength={120} value={note} onChangeText={setNote} />
            <Body small muted>{confirm.req.mode === 'cash' ? `${confirm.req.to} ha scelto di ricevere in denaro: tu paghi l'importo intero in LifePoints, la commissione del ${CASH_FEE_PCT}% la sostiene lui.` : `${confirm.req.to} riceve i LifePoints senza commissioni.`}</Body>
            <Row style={{ marginTop: 6 }}><Body muted>Il tuo saldo</Body>{lp(balance)}</Row>
            <Btn style={{ marginTop: 12 }} title="Paga" onPress={() => pay(confirm.req, confirm.req.amount ?? confirm.amount, 'qr')} />
          </>
        )}
      </Sheet>
    </Page>
  );
}
