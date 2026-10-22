import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { create } from 'zustand';
import { isRtlLayout } from '@/lib/rtl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';

import { PayQr } from '@/components/PayQr';
import { QrScanner } from '@/components/QrScanner';
import { sendLP } from '@/lib/paymentActions';
import { parsePayLink, type PayRequest } from '@/lib/payments';
import { Text } from '@/components/T';
import { LpTag } from '@/components/network';
import { Body, Btn, Input, Row, Seg, Sheet, useUI } from '@/components/ui';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import { useTheme } from '@/hooks/use-theme';
import { translateText } from '@/i18n/core';
import { formatCHF } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { ASSETS, CONVERT_FEE, DEMO_RATES, applyConversion, payToken, quote, type Asset } from '@/lib/lifepay';
import { go } from '@/lib/nav';
import { buildPayLink } from '@/lib/payments';
import { QrView } from '@/components/profile/CardFace';
import { daysLeft, passPayload, premiumState, PREMIUM_PRICE_LP } from '@/lib/fitness/premium';
import { useApp } from '@/store/app';
import { useFitness } from '@/store/fitness';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';
import { libraryPermission } from '@/lib/mediaPerm';

/** Scheda LifePass del portafoglio: il QR d'ingresso ai centri (diverso da quello dei pagamenti), che cambia ogni minuto. */
function PassTab({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const sub = useFitness((s) => s.sub);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const h = setInterval(() => setNow(Date.now()), 20000); return () => clearInterval(h); }, []);
  const state = premiumState(sub, now);
  if (!sub || state === 'nessuno' || state === 'scaduto') {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 12, gap: 8 }}>
        <Icon name="lifefitness" size={34} color={t.accent} />
        <Text style={{ color: t.text, fontWeight: '800', fontSize: 17 }}>{translateText(state === 'scaduto' ? 'Il tuo LifePass è scaduto' : 'Non hai il LifePass')}</Text>
        <Body small muted style={{ textAlign: 'center' }}>Un solo pass per entrare in palestre, piscine e centri sportivi convenzionati.</Body>
        <Btn style={{ alignSelf: 'stretch', marginTop: 6 }} title={`${translateText('Scopri il LifePass')} · ${PREMIUM_PRICE_LP} LP`} onPress={() => { onClose(); go('fitnessPass'); }} />
      </View>
    );
  }
  return (
    <View style={{ alignItems: 'center', gap: 8, marginVertical: 8 }}>
      <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 16 }}><QrView text={passPayload(me, sub, now)} size={180} color="#111" /></View>
      <Text style={{ color: t.text, fontWeight: '800', fontSize: 16 }}>{me}</Text>
      <Body small muted>{`${translateText('Valido fino al')} ${new Date(sub.renewsAt).toLocaleDateString()} · ${daysLeft(sub, now)} ${translateText('giorni')}`}</Body>
      <Body small muted style={{ textAlign: 'center' }}>Mostralo all'ingresso del centro: è il codice del LifePass, diverso da quello dei pagamenti, e cambia ogni minuto.</Body>
      <Btn ghost style={{ alignSelf: 'stretch', marginTop: 4 }} title="Gestisci il LifePass" onPress={() => { onClose(); go('lifefitness'); }} />
    </View>
  );
}

/**
 * Il portafoglio è un pulsante «trasparente»: di solito è quasi invisibile e i tocchi passano a quello che c'è dietro.
 * Per usarlo lo si tiene premuto (mezzo secondo): si accende, diventa pieno e per qualche secondo si può toccare.
 */
const useWallet = create<{ armed: boolean; visible: boolean; setArmed: (v: boolean) => void; setVisible: (v: boolean) => void }>((set) => ({ armed: false, visible: false, setArmed: (armed) => set({ armed }), setVisible: (visible) => set({ visible }) }));
const FAB = { start: 14, size: 44, bottom: 84 };
let held = false;
/** Vero mentre un dito sta premendo sul portafoglio: i widget dietro non devono reagire (es. entrare in modifica). */
export const walletHeld = () => held;

/** Da mettere sulla vista principale dell'app: osserva i tocchi (senza prenderli) e accende il portafoglio se lo tieni premuto. */
export function useWalletTouch() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const off = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const clear = () => { held = false; if (timer.current) { clearTimeout(timer.current); timer.current = null; } origin.current = null; };
  const inside = (x: number, y: number) => {
    const left = (isRtlLayout() ? width - FAB.start - FAB.size : FAB.start) - 10, right = left + FAB.size + 20;
    const bottomY = height - (FAB.bottom + insets.bottom), topY = bottomY - FAB.size;
    return x >= left && x <= right && y >= topY - 10 && y <= bottomY + 10;
  };
  return {
    onTouchStart: (e: GestureResponderEvent) => {
      clear();
      const n = e.nativeEvent; if (n.touches.length !== 1 || !useWallet.getState().visible || useWallet.getState().armed || !inside(n.pageX, n.pageY)) return;
      held = true;
      origin.current = { x: n.pageX, y: n.pageY };
      timer.current = setTimeout(() => {
        timer.current = null;
        useWallet.getState().setArmed(true);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        if (off.current) clearTimeout(off.current);
        off.current = setTimeout(() => useWallet.getState().setArmed(false), 6000);
      }, 480);
    },
    onTouchMove: (e: GestureResponderEvent) => { const o = origin.current; if (o && Math.hypot(e.nativeEvent.pageX - o.x, e.nativeEvent.pageY - o.y) > 12) clear(); },
    onTouchEnd: clear,
    onTouchCancel: clear,
  };
}

/** Pulsante sempre raggiungibile: apre il portafoglio LifePay da qualsiasi schermata (tenendolo premuto, vedi sopra). */
export function LifePayFab() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const open = useUI((s) => s.payOpen);
  const setPay = useUI((s) => s.setPay);
  const kb = useKeyboardInset();
  const pathname = usePathname();
  const armed = useWallet((s) => s.armed);
  const hidden = open || kb.visible || /conversationPage|liveRoom|storyView|storyCreate|swipeDeck|photoEdit/.test(pathname);
  useEffect(() => { useWallet.getState().setVisible(!hidden); if (hidden) useWallet.getState().setArmed(false); }, [hidden]);
  if (hidden) return null;
  return (
    <Pressable pointerEvents={armed ? 'auto' : 'none'} onPress={() => { useWallet.getState().setArmed(false); setPay(true); }} accessibilityRole="button" accessibilityLabel={translateText('Apri LifePay: tieni premuto per attivarlo')} hitSlop={8}
      style={{ position: 'absolute', start: FAB.start, bottom: FAB.bottom + insets.bottom, width: FAB.size, height: FAB.size, borderRadius: FAB.size / 2, backgroundColor: armed ? t.text : 'transparent', borderWidth: armed ? 0 : 1, borderColor: t.text + '44', alignItems: 'center', justifyContent: 'center', opacity: armed ? 0.96 : 0.35, transform: [{ scale: armed ? 1.12 : 1 }] }}>
      <Icon name="wallet" size={22} color={armed ? t.onText : t.text} />
    </Pressable>
  );
}

const TABS = ['Paga', 'Versa', 'LifePass'] as const;
const METHODS = ['Carta', 'Cripto'] as const;
const CARD_AMOUNTS = [50, 100, 250, 500];

export function LifePayHost() {
  const t = useTheme();
  const open = useUI((s) => s.payOpen);
  const setPay = useUI((s) => s.setPay);
  const me = useApp((s) => s.account.name);
  const demo = useApp((s) => s.demo);
  const lp = useNet((s) => s.lifePoints);
  const crypto = useNet((s) => s.crypto);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Paga');
  const [asset, setAsset] = useState<Asset>('ETH');
  const [amt, setAmt] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]>('Carta');
  const [cardLp, setCardLp] = useState(100);
  const bal = crypto?.[asset] ?? 0;
  const n = parseFloat(amt.replace(',', '.'));
  const q = amt ? quote(asset, n, bal) : null;
  const link = buildPayLink({ to: me.slice(0, 30), mode: 'lp' }) + (open ? `?t=${payToken(Date.now())}` : '');
  const close = () => { setPay(false); setFlow(null); setCode(''); };
  const [flow, setFlow] = useState<null | { step: 'scan' } | { step: 'confirm'; req: PayRequest; amount: number } | { step: 'done'; req: PayRequest; amount: number }>(null);
  const [code, setCode] = useState('');
  const onCode = (text: string) => {
    const tx = text.trim();
    if (tx.startsWith('lp://gym/')) { close(); go('fitnessGyms', { pay: tx }); return; }
    const r = parsePayLink(tx);
    if (!r) { toast('Questo non è un codice di pagamento LifePilot'); setFlow(null); return; }
    if (r.to === me) { toast('Questo è il tuo codice: non puoi pagare te stesso'); setFlow(null); return; }
    if (!r.amount) { toast('Il codice non ha un importo: usa Movimenti e ricevi per scegliere quanto'); setFlow(null); return; }
    setFlow({ step: 'confirm', req: r, amount: r.amount }); setCode('');
  };
  const fromPhoto = async () => {
    try {
      const perm = await libraryPermission();
      if (!perm.granted && perm.accessPrivileges !== 'limited') { toast('Permesso foto negato: abilitalo dalle impostazioni del telefono.'); return; }
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (r.canceled || !r.assets[0]) return;
      const res = await Camera.scanFromURLAsync(r.assets[0].uri, ['qr']);
      if (!res.length) { toast('Nessun QR trovato nell’immagine'); return; }
      onCode(res[0].data);
    } catch { toast('Non riesco a leggere l’immagine'); }
  };
  const payNow = () => {
    if (!flow || flow.step !== 'confirm') return;
    const res = sendLP(flow.req.to, flow.amount, { note: flow.req.item, via: 'qr', merchant: true });
    if (!res.ok) { toast(res.message); return; }
    setFlow({ step: 'done', req: flow.req, amount: flow.amount });
  };
  const convert = () => {
    if (!q || !q.ok) { toast(q && !q.ok ? q.reason : 'Inserisci una quantità'); return; }
    const st = useNet.getState();
    st.earn(q.lp, `Cambio ${n} ${asset} in LifePoints`);
    st.patch({ crypto: applyConversion(st.crypto, asset, n), cryptoLog: [{ ts: Date.now(), asset, amount: n, lp: q.lp }, ...(st.cryptoLog ?? [])].slice(0, 30) });
    setAmt(''); toast(`Hai ricevuto ${formatCHF(q.lp)} LP`);
  };
  const topUpCard = () => { useNet.getState().earn(cardLp, 'Versamento con la carta'); toast(`Versati ${formatCHF(cardLp)} LP`); };
  const addDemo = () => { const st = useNet.getState(); st.patch({ crypto: { BTC: (st.crypto?.BTC ?? 0) + 0.01, ETH: (st.crypto?.ETH ?? 0) + 1, USDC: (st.crypto?.USDC ?? 0) + 500, SOL: (st.crypto?.SOL ?? 0) + 10 } }); toast('Cripto di prova aggiunte'); };
  return (
    <Sheet visible={open} title="LifePay" onClose={close}>
      <LinearGradient colors={['#2b3a8f', '#6a3fb8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 20, padding: 18, marginBottom: 14 }}>
        <Row>
          <Text style={{ color: '#ffffffcc', fontWeight: '800', letterSpacing: 1 }}>LIFEPAY</Text>
          <Icon name="wallet" size={22} color="#fff" />
        </Row>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }}>
          <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800' }}>{formatCHF(lp)}</Text><LpTag size={22} dark={false} />
        </View>
        <Text style={{ color: '#ffffffb0', marginTop: 10, letterSpacing: 2 }}>{'•••• •••• ' + (Math.abs([...me].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % 9000 + 1000)}</Text>
        <Text style={{ color: '#fff', fontWeight: '700', marginTop: 2 }}>{me}</Text>
      </LinearGradient>
      <Seg options={[...TABS]} value={tab} onChange={(v) => setTab(v as (typeof TABS)[number])} />
      {tab === 'LifePass' ? <PassTab onClose={close} /> : tab === 'Paga' ? (
        flow?.step === 'scan' ? (
          <>
            <QrScanner onCode={onCode} onClose={() => setFlow(null)} />
            <Btn ghost style={{ marginTop: 8 }} icon="image" title="Leggi da una foto o uno screenshot" onPress={fromPhoto} />
            <Input autoCapitalize="none" placeholder="Oppure incolla il codice (lp://pay/…)" value={code} onChangeText={(v) => { setCode(v); if (v.startsWith('lp://')) onCode(v); }} style={{ marginTop: 8 }} />
          </>
        ) : flow?.step === 'confirm' ? (
          <>
            <View style={{ alignItems: 'center', paddingVertical: 14 }}>
              <Text style={{ color: t.muted, fontSize: 13 }}>{translateText('Stai pagando')}</Text>
              <Text style={{ color: t.text, fontSize: 22, fontWeight: '800', marginTop: 4, textAlign: 'center' }}>{flow.req.to}</Text>
              {flow.req.item ? <Text style={{ color: t.text, fontSize: 16, marginTop: 4, textAlign: 'center' }}>{flow.req.item}</Text> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }}><Text style={{ color: t.text, fontSize: 44, fontWeight: '800' }}>{formatCHF(flow.amount)}</Text><LpTag size={28} /></View>
              <Body small muted style={{ marginTop: 6 }}>Ti resteranno {formatCHF(Math.max(0, lp - flow.amount))} LP</Body>
              {lp < flow.amount ? <Body small color={t.danger} style={{ marginTop: 4 }}>LifePoints insufficienti: versane con la scheda «Versa».</Body> : null}
            </View>
            <Btn title={`Paga ${formatCHF(flow.amount)} LP`} disabled={lp < flow.amount} onPress={payNow} />
            <Btn ghost style={{ marginTop: 8 }} title="Annulla" onPress={() => setFlow(null)} />
          </>
        ) : flow?.step === 'done' ? (
          <>
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.positive, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={34} color="#fff" stroke={3} /></View>
              <Text style={{ color: t.text, fontSize: 20, fontWeight: '800', marginTop: 12 }}>{translateText('Pagamento riuscito')}</Text>
              <Body small muted style={{ marginTop: 6, textAlign: 'center' }}>{flow.req.to}{flow.req.item ? ` · ${flow.req.item}` : ''}</Body>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}><Text style={{ color: t.text, fontSize: 28, fontWeight: '800' }}>{formatCHF(flow.amount)}</Text><LpTag size={20} /></View>
              <Body small muted style={{ marginTop: 6 }}>{new Date().toLocaleString()}</Body>
            </View>
            <Btn title="Fatto" onPress={() => setFlow(null)} />
          </>
        ) : (
        <>
          <View style={{ alignItems: 'center', marginVertical: 8 }}>
            <PayQr text={link} size={170} />
            <Body small muted style={{ textAlign: 'center', marginTop: 8 }}>Mostra il codice alla cassa: cambia ogni minuto. Il pagamento esce dal tuo saldo in LifePoints.</Body>
          </View>
          <Btn icon="camera" title="Scansiona e paga" onPress={() => setFlow({ step: 'scan' })} />
          <Btn ghost style={{ marginTop: 8 }} icon="wallet" title="Prova con una cassa di esempio" onPress={() => { close(); go('posDemo'); }} />
          <Btn ghost style={{ marginTop: 8 }} title="Movimenti e ricevi" onPress={() => { close(); go('payments'); }} />
        </>
        )
      ) : (
        <>
          <Body small muted style={{ marginBottom: 8 }}>Versa per avere LifePoints: con la carta oppure cambiando cripto. Poi si paga sempre e solo in LifePoints.</Body>
          <Seg options={[...METHODS]} value={method} onChange={(v) => setMethod(v as (typeof METHODS)[number])} />
          {method === 'Carta' ? (
            <>
              <Row style={{ flexWrap: 'wrap', justifyContent: 'flex-start', gap: 8, marginVertical: 10 }}>
                {CARD_AMOUNTS.map((a) => (
                  <Pressable key={a} onPress={() => setCardLp(a)} accessibilityRole="button" accessibilityState={{ selected: cardLp === a }} style={{ paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, backgroundColor: cardLp === a ? t.text : t.chip }}>
                    <Text style={{ color: cardLp === a ? t.onText : t.text, fontWeight: '700' }}>{a} LP</Text>
                  </Pressable>
                ))}
              </Row>
              <Btn icon="wallet" title={`Versa ${cardLp} LP con la carta`} onPress={topUpCard} />
              <Body small muted style={{ marginTop: 10 }}>Nella versione demo il versamento con carta è simulato. Per quello vero serve un fornitore di pagamenti autorizzato (anche per Apple Pay e Google Pay).</Body>
            </>
          ) : (
            <>
              <Body small muted style={{ marginVertical: 8 }}>Cambi le tue cripto in LifePoints, come con la carta. Commissione {Math.round(CONVERT_FEE * 100)}%.</Body>
              <Row style={{ flexWrap: 'wrap', justifyContent: 'flex-start', gap: 8, marginBottom: 10 }}>
                {ASSETS.map((a) => (
                  <Pressable key={a.id} onPress={() => { setAsset(a.id); setAmt(''); }} accessibilityRole="button" accessibilityState={{ selected: asset === a.id }} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: asset === a.id ? t.text : t.chip }}>
                    <Text style={{ color: asset === a.id ? t.onText : t.text, fontWeight: '700' }}>{a.id}</Text>
                  </Pressable>
                ))}
              </Row>
              <Body small muted>Hai {bal} {asset} · 1 {asset} ≈ {formatCHF(DEMO_RATES[asset])} LP (tasso dimostrativo)</Body>
              <Input keyboardType="decimal-pad" placeholder={`Quanti ${asset} vuoi cambiare?`} value={amt} onChangeText={setAmt} style={{ marginTop: 8 }} />
              {q ? (q.ok ? <Body small style={{ marginBottom: 8 }}>Ricevi {formatCHF(q.lp)} LP (commissione {formatCHF(q.fee)} LP)</Body> : <Body small color={t.warn} style={{ marginBottom: 8 }}>{q.reason}</Body>) : null}
              <Btn title="Cambia in LifePoints" disabled={!q || !q.ok} onPress={convert} />
              {demo ? <Btn ghost style={{ marginTop: 8 }} title="Solo demo: aggiungi cripto di prova" onPress={addDemo} /> : null}
              <Body small muted style={{ marginTop: 10 }}>Nella versione demo il cambio è simulato. Quello vero richiede un fornitore autorizzato e la verifica dell'identità.</Body>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
