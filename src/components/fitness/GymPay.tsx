import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/T';

import { LpTag } from '@/components/network';
import { QrScanner } from '@/components/QrScanner';
import { Body, Btn, Input, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { PARTNER_GYMS } from '@/lib/fitness/data';
import { creditsLeft, resolveGymLink, type PriceItem } from '@/lib/fitness/gymPay';
import { useFitness } from '@/store/fitness';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

const lp = (n: number) => <Row gap={2}><Text style={{ fontWeight: '800', fontSize: 15 }}>{n}</Text><LpTag size={13} /></Row>;

/** Scansiona il QR di un centro (su web si incolla il codice). */
export function GymScan({ visible, onClose, onCode }: { visible: boolean; onClose: () => void; onCode: (text: string) => void }) {
  const [code, setCode] = useState('');
  return (
    <Sheet visible={visible} title="Paga con il QR" onClose={onClose}>
      <Body small muted style={{ marginBottom: 8 }}>Inquadra il QR che trovi alla cassa del centro: vedrai cosa paghi e il prezzo, in LifePoints, prima di confermare.</Body>
      {visible ? <QrScanner onCode={(c) => { onCode(c); }} onClose={onClose} /> : null}
      <Input autoCapitalize="none" placeholder="Oppure incolla il codice (lp://gym/…)" value={code} onChangeText={(v) => { setCode(v); if (v.startsWith('lp://gym/')) { onCode(v); setCode(''); } }} />
    </Sheet>
  );
}

/** Conferma e pagamento in LifePoints di una voce del listino di un centro. */
export function GymPaySheet({ link, onClose }: { link: string | null; onClose: () => void }) {
  const t = useTheme();
  const fit = useFitness();
  const balance = useNet((s) => s.lifePoints);
  const [pick, setPick] = useState<PriceItem | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const r = link ? resolveGymLink(link, [...PARTNER_GYMS, ...fit.approved]) : null;
  useEffect(() => { setPick(null); setDone(null); }, [link]);
  const item = pick ?? (r && r.ok ? r.item ?? null : null);

  const pay = () => {
    if (!r || !r.ok || !item) return;
    const res = fit.payGym(r.gym, item.id);
    toast(res.message);
    if (res.ok) setDone(res.message);
  };
  const enter = () => { if (!r || !r.ok) return; const e = fit.enter(r.gym.id); toast(e.message); if (e.ok) onClose(); };

  return (
    <Sheet visible={!!link} title={r && r.ok ? r.gym.name : 'Pagamento'} onClose={onClose}>
      {!r || !r.ok ? (
        <View><Body color={t.warn} bold>Non posso procedere</Body><Body small style={{ marginTop: 4 }}>{r && !r.ok ? r.reason : ''}</Body><Btn style={{ marginTop: 12 }} ghost title="Chiudi" onPress={onClose} /></View>
      ) : done ? (
        <View>
          <Body bold color={t.positive}>{done}</Body>
          <Body small muted style={{ marginTop: 4 }}>{tl('Ingressi validi in questo centro: {0}', creditsLeft(fit.purchases, r.gym.id, Date.now()))}</Body>
          <Btn style={{ marginTop: 12 }} title="Entra adesso" onPress={enter} />
          <Btn style={{ marginTop: 6 }} ghost title="Più tardi" onPress={onClose} />
        </View>
      ) : !item ? (
        <View>
          <Body small muted>Scegli cosa pagare:</Body>
          {r.items.map((i) => (
            <Row key={i.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.border }} gap={8}>
              <View style={{ flex: 1 }}><Body bold>{i.label}</Body><Body small muted>{i.entries > 1 ? tl('{0} ingressi, validi {1} giorni', i.entries, i.validDays) : tl('Valido {0} giorni', i.validDays)}</Body></View>
              {lp(i.lp)}
              <Btn small title="Scegli" onPress={() => setPick(i)} />
            </Row>
          ))}
        </View>
      ) : (
        <View>
          <Body small muted>{r.gym.address}, {r.gym.city}</Body>
          <View style={{ marginTop: 10, borderRadius: 16, padding: 14, backgroundColor: t.chip }}>
            <Body bold>{item.label}</Body>
            <Row style={{ marginTop: 6 }}><Body muted>Prezzo</Body>{lp(item.lp)}</Row>
            <Row><Body muted>Il tuo saldo</Body>{lp(balance)}</Row>
            <Row><Body muted>Dopo il pagamento</Body>{lp(Math.max(0, balance - item.lp))}</Row>
          </View>
          <Body small muted style={{ marginTop: 8 }}>Il prezzo è quello del listino del centro: se il QR ne indicasse un altro, non pagheresti.</Body>
          <Btn style={{ marginTop: 12 }} disabled={balance < item.lp} title={balance < item.lp ? 'LifePoints insufficienti' : tl('Paga {0} LP', item.lp)} onPress={pay} />
          {!(r.item) ? <Btn style={{ marginTop: 6 }} ghost title="Scegli altro" onPress={() => setPick(null)} /> : null}
        </View>
      )}
    </Sheet>
  );
}
