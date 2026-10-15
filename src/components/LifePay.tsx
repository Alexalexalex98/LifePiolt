import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';

import { PayQr } from '@/components/PayQr';
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
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

/** Pulsante sempre raggiungibile: apre il portafoglio LifePay da qualsiasi schermata. */
export function LifePayFab() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const open = useUI((s) => s.payOpen);
  const setPay = useUI((s) => s.setPay);
  const kb = useKeyboardInset();
  const pathname = usePathname();
  if (open || kb.visible || /conversationPage|liveRoom|storyView|swipeDeck/.test(pathname)) return null;
  return (
    <Pressable onPress={() => setPay(true)} accessibilityRole="button" accessibilityLabel={translateText('Apri LifePay')} hitSlop={8}
      style={{ position: 'absolute', start: 14, bottom: 84 + insets.bottom, width: 44, height: 44, borderRadius: 22, backgroundColor: t.text, alignItems: 'center', justifyContent: 'center', opacity: 0.92, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 }}>
      <Icon name="wallet" size={22} color={t.onText} />
    </Pressable>
  );
}

const TABS = ['Paga', 'Versa'] as const;
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
  const close = () => setPay(false);
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
      {tab === 'Paga' ? (
        <>
          <View style={{ alignItems: 'center', marginVertical: 8 }}>
            <PayQr text={link} size={200} />
            <Body small muted style={{ textAlign: 'center', marginTop: 8 }}>Mostra il codice alla cassa: cambia ogni minuto. Il pagamento esce dal tuo saldo in LifePoints.</Body>
          </View>
          <Btn icon="camera" title="Scansiona un QR e paga" onPress={() => { close(); go('payments'); }} />
          <Btn ghost style={{ marginTop: 8 }} title="Movimenti e ricevi" onPress={() => { close(); go('payments'); }} />
        </>
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
