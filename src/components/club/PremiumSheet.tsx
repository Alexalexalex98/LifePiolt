import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Btn, Press, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { hasYearly, yearlyPerMonth, yearlyPrice, type BillingPlan, type Club } from '@/lib/club';
import { Icon } from '@/lib/icons';
import { joinPremiumClub } from '@/store/clubFlow';
import { money, perMonth } from './format';
import { PreviewNote } from './parts';

/** Conferma onesta del passaggio a Premium: nessun addebito reale, spiega prova, rinnovo, annullamento e recesso. */
export function PremiumSheet({ club, visible, onClose }: { club: Club; visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const p = club.pricing;
  const [plan, setPlan] = useState<BillingPlan>('mensile');
  const yearly = hasYearly(p);
  const eff: BillingPlan = yearly ? plan : 'mensile';
  const price = eff === 'annuale' ? yearlyPrice(p) : p.monthly;
  return (
    <Sheet visible={visible} title={`Passa a Premium · ${club.name}`} onClose={onClose}>
      <PreviewNote text="Anteprima: nessun addebito reale. I pagamenti veri si attivano col server, con un provider di pagamento (carta, Apple Pay, Google Pay)." />
      {yearly && (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {([['mensile', `${perMonth(p)} / mese`, ''], ['annuale', `${money(yearlyPrice(p), p.currency)} / anno`, `-${p.yearlyDiscountPct}%`]] as const).map(([k, label, tag]) => (
            <Press key={k} onPress={() => setPlan(k)} selected={eff === k} accessibilityLabel={label} style={{ flex: 1, padding: 12, borderRadius: 14, borderWidth: 2, borderColor: eff === k ? t.accent : t.border, backgroundColor: t.card }}>
              <Text style={{ color: t.text, fontWeight: '800', fontSize: 14 }}>{k === 'mensile' ? 'Mensile' : 'Annuale'}</Text>
              <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>{label}</Text>
              {tag ? <Text style={{ color: t.positive, fontSize: 12, fontWeight: '700', marginTop: 2 }}>{`${tag} · ${money(yearlyPerMonth(p), p.currency)} / mese`}</Text> : null}
            </Press>
          ))}
        </View>
      )}
      <View style={{ gap: 8, marginBottom: 14 }}>
        {[
          p.trialDays > 0 ? `${p.trialDays} giorni di prova gratuita: il primo addebito sarebbe a fine prova.` : 'Nessun periodo di prova.',
          eff === 'annuale' ? 'Si rinnova ogni anno finché non annulli.' : 'Si rinnova ogni mese finché non annulli.',
          'Puoi annullare quando vuoi: l\'accesso Premium resta fino alla fine del periodo già pagato.',
          'Sblocca tutte le lezioni Premium, i contenuti riservati e la chat dove il creatore ti risponde.',
        ].map((l) => <View key={l} style={{ flexDirection: 'row', gap: 8 }}><Icon name="check" size={16} color={t.positive} stroke={2.4} /><Body small style={{ flex: 1 }}>{l}</Body></View>)}
      </View>
      <View style={{ padding: 12, borderRadius: 14, backgroundColor: t.chip, marginBottom: 12 }}>
        <Text style={{ color: t.muted, fontSize: 12 }}>{p.trialDays > 0 ? 'Oggi paghi' : 'Pagheresti oggi'}</Text>
        <Text style={{ color: t.text, fontSize: 22, fontWeight: '800' }}>{p.trialDays > 0 ? money(0, p.currency) : money(price, p.currency)}</Text>
        {p.trialDays > 0 ? <Body small muted>{`Poi ${money(price, p.currency)} ${eff === 'annuale' ? 'all\'anno' : 'al mese'} dopo ${p.trialDays} giorni`}</Body> : null}
      </View>
      <Btn title={p.trialDays > 0 ? 'Inizia la prova (demo)' : 'Conferma Premium (demo)'} onPress={() => { joinPremiumClub(club, eff); onClose(); }} />
      <Body small muted style={{ marginTop: 8 }}>Per legge, i contenuti digitali a pagamento prevedono informazioni chiare su prezzo, rinnovo e diritto di recesso: col server saranno mostrate anche IVA e condizioni complete.</Body>
    </Sheet>
  );
}
