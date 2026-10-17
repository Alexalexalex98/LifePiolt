import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Text } from '@/components/T';
import { Amount, Bar, Delta, Panel, QuickAction, SectionTitle } from '@/components/money/parts';
import { Body, Btn, Input, Pill, Press, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { go } from '@/lib/nav';
import { CATEGORIES, budgetStatus, detectRecurring, goalPct, spendByCategory, splitEqual, type Category } from '@/lib/lpMoney';
import { sendLP } from '@/lib/paymentActions';
import { Icon } from '@/lib/icons';
import { portfolio } from '@/lib/markets/invest';
import { useLpMoney, splitBill } from '@/store/lpMoney';
import { priceLp, useMarkets } from '@/store/markets';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

const parse = (v: string) => { const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) ? n : 0; };

/** Il conto: saldo in LifePoints, spese, budget, obiettivi, abbonamenti. */
export function WalletTab({ onInvest }: { onInvest: () => void }) {
  const t = useTheme();
  const net = useNet();
  const mk = useMarkets();
  const money = useLpMoney();
  const [sheet, setSheet] = useState<null | 'send' | 'request' | 'split' | 'budget' | 'goal' | 'sub' | 'fund'>(null);
  const [who, setWho] = useState<string[]>([]);
  const [amt, setAmt] = useState('');
  const [note, setNote] = useState('');
  const [cat, setCat] = useState<Category>('Seminari e servizi');
  const [name, setName] = useState('');
  const [goalId, setGoalId] = useState<string | null>(null);

  const moves = net.lpMoves ?? [];
  const month = useMemo(() => spendByCategory(moves, Date.now()), [moves]);
  const recurring = useMemo(() => detectRecurring(moves), [moves]);
  const pf = portfolio(Object.values(mk.positions), (s) => priceLp(mk, s));
  const people = net.following.length ? net.following : ['Anna', 'Marco', 'Giulia'];
  const closeSheet = () => { setSheet(null); setWho([]); setAmt(''); setNote(''); setName(''); };
  const toggleWho = (n: string, single: boolean) => setWho((w) => (single ? [n] : w.includes(n) ? w.filter((x) => x !== n) : [...w, n]));

  const recent = moves.slice(-6).reverse();
  const totalDelta = month.totalBefore > 0 ? ((month.total - month.totalBefore) / month.totalBefore) * 100 : null;

  return (
    <View>
      {/* il saldo */}
      <View style={{ paddingTop: 6, paddingBottom: 4 }}>
        <Text style={{ color: t.muted, fontSize: 14, fontWeight: '600' }}>{tl('Il tuo conto')}</Text>
        <Amount n={net.lifePoints} size={46} />
        <Text style={{ color: t.muted, fontSize: 14, marginTop: 4 }}>{tl('Investito')} {pf.value.toLocaleString('de-CH', { maximumFractionDigits: 2 })} LP · {tl('Totale')} {(net.lifePoints + pf.value).toLocaleString('de-CH', { maximumFractionDigits: 2 })} LP</Text>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 18, gap: 4 }}>
        <QuickAction icon="send" label={tl('Invia')} onPress={() => setSheet('send')} />
        <QuickAction icon="arrow-down" label={tl('Richiedi')} onPress={() => setSheet('request')} />
        <QuickAction icon="users" label={tl('Dividi')} onPress={() => setSheet('split')} />
        <QuickAction icon="trend-up" label={tl('Investi')} onPress={onInvest} />
        <QuickAction icon="plus" label={tl('Carica')} onPress={() => go('lifepointsPage')} />
      </View>

      {/* spese del mese */}
      <SectionTitle>{tl('Spese del mese')}</SectionTitle>
      <Panel>
        <Row>
          <Amount n={month.total} size={26} />
          {month.totalBefore > 0 ? <View style={{ alignItems: 'flex-end' }}><Delta pct={totalDelta} /><Text style={{ color: t.muted, fontSize: 12 }}>{tl('rispetto al mese scorso')}</Text></View> : null}
        </Row>
        {month.rows.length === 0 ? <Body small muted style={{ marginTop: 10 }}>Ancora nessuna spesa questo mese.</Body> : month.rows.map((r) => {
          const max = Math.max(...month.rows.map((x) => Math.max(x.now, x.before)), 1);
          return (
            <View key={r.cat} style={{ marginTop: 16 }}>
              <Row><Text style={{ color: t.text, fontWeight: '700', fontSize: 14.5 }}>{tl(r.cat)}</Text><View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><Delta pct={r.delta} /><Amount n={r.now} size={14.5} /></View></Row>
              <View style={{ marginTop: 7 }}><Bar pct={(r.now / max) * 100} /></View>
              {r.before > 0 ? <Text style={{ color: t.muted, fontSize: 12, marginTop: 4 }}>{tl('Mese scorso')}: {r.before} LP</Text> : null}
            </View>
          );
        })}
      </Panel>

      {/* budget */}
      <SectionTitle right={<Press onPress={() => setSheet('budget')} accessibilityLabel={tl('Imposta un budget')}><Text style={{ color: t.accent, fontWeight: '800', fontSize: 14 }}>{tl('Imposta')}</Text></Press>}>{tl('Budget')}</SectionTitle>
      {Object.entries(money.budgets).filter(([, v]) => v).length === 0 ? (
        <Panel><Body small muted>Scegli un limite mensile per una categoria: ti avvisiamo quando ti avvicini.</Body></Panel>
      ) : (
        <Panel>
          {(Object.entries(money.budgets) as [Category, number][]).filter(([, v]) => v).map(([c, limit], i) => {
            const spent = month.rows.find((r) => r.cat === c)?.now ?? 0;
            const st = budgetStatus(spent, limit);
            const col = st.level === 'over' ? t.danger : st.level === 'warn' ? t.warn : t.accent;
            return (
              <View key={c} style={{ marginTop: i ? 16 : 0 }}>
                <Row><Text style={{ color: t.text, fontWeight: '700', fontSize: 14.5 }}>{tl(c)}</Text><Text style={{ color: col, fontWeight: '800', fontSize: 13.5 }}>{spent} / {limit} LP</Text></Row>
                <View style={{ marginTop: 7 }}><Bar pct={st.pct} color={col} /></View>
                <Text style={{ color: t.muted, fontSize: 12, marginTop: 4 }}>{st.level === 'over' ? tl('Hai superato il limite di {0} LP', Math.abs(st.left)) : tl('Ti restano {0} LP', st.left)}</Text>
              </View>
            );
          })}
        </Panel>
      )}

      {/* obiettivi */}
      <SectionTitle right={<Press onPress={() => setSheet('goal')} accessibilityLabel={tl('Nuovo obiettivo')}><Text style={{ color: t.accent, fontWeight: '800', fontSize: 14 }}>{tl('Nuovo')}</Text></Press>}>{tl('Obiettivi')}</SectionTitle>
      {money.goals.length === 0 ? <Panel><Body small muted>Metti da parte LP per qualcosa di preciso: un viaggio, un seminario, una spesa grande. I LP restano nel tuo saldo.</Body></Panel> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
          {money.goals.map((g) => (
            <Press key={g.id} onPress={() => { setGoalId(g.id); setSheet('fund'); }} accessibilityLabel={g.name} style={{ width: 220, backgroundColor: t.card, borderRadius: 24, borderWidth: 1, borderColor: t.border, padding: 18 }}>
              <Text numberOfLines={1} style={{ color: t.text, fontWeight: '800', fontSize: 16 }}>{g.name}</Text>
              <View style={{ marginTop: 10 }}><Amount n={g.saved} size={22} /></View>
              <Text style={{ color: t.muted, fontSize: 12.5, marginVertical: 8 }}>{tl('su {0} LP', g.target)}{money.roundUpGoal === g.id ? ` · ${tl('arrotondamenti attivi')}` : ''}</Text>
              <Bar pct={goalPct(g)} />
            </Press>
          ))}
        </ScrollView>
      )}

      {/* abbonamenti */}
      <SectionTitle right={<Press onPress={() => setSheet('sub')} accessibilityLabel={tl('Aggiungi abbonamento')}><Text style={{ color: t.accent, fontWeight: '800', fontSize: 14 }}>{tl('Aggiungi')}</Text></Press>}>{tl('Abbonamenti e ricorrenze')}</SectionTitle>
      {money.subs.filter((s) => !s.ended).length === 0 && recurring.length === 0 ? <Panel><Body small muted>Qui compaiono i pagamenti che si ripetono, con il giorno del prossimo addebito.</Body></Panel> : (
        <Panel pad={6}>
          {money.subs.filter((s) => !s.ended).map((s) => (
            <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 }}>
              <View style={{ flex: 1 }}><Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>{s.name}</Text><Text style={{ color: t.muted, fontSize: 12.5 }}>{tl('Ogni mese il {0}', s.day)}</Text></View>
              <Amount n={s.amount} size={15} />
              <Btn small ghost title={tl('Disdici')} onPress={() => { money.endSub(s.id); toast('Abbonamento segnato come disdetto'); }} />
            </View>
          ))}
          {recurring.map((r) => (
            <View key={r.label + r.amount} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 }}>
              <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>{r.label}</Text><Text style={{ color: t.muted, fontSize: 12.5 }}>{tl('Prossimo addebito stimato')}: {new Date(r.next).toLocaleDateString('it-CH', { day: 'numeric', month: 'short' })}</Text></View>
              <Amount n={r.amount} size={15} />
            </View>
          ))}
        </Panel>
      )}

      {/* richieste aperte */}
      {money.requests.filter((r) => r.status === 'open').length ? (
        <>
          <SectionTitle>{tl('Richieste in attesa')}</SectionTitle>
          <Panel pad={6}>
            {money.requests.filter((r) => r.status === 'open').slice(0, 6).map((r) => (
              <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 }}>
                <View style={{ flex: 1 }}><Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>{r.who}</Text>{r.note ? <Text numberOfLines={1} style={{ color: t.muted, fontSize: 12.5 }}>{r.note}</Text> : null}</View>
                <Amount n={r.amount} size={15} />
                <Btn small ghost title={tl('Pagata')} onPress={() => money.markPaid(r.id)} />
              </View>
            ))}
          </Panel>
        </>
      ) : null}

      {/* ultime operazioni */}
      <SectionTitle right={<Press onPress={() => go('lpStatement')} accessibilityLabel={tl('Estratto conto')}><Text style={{ color: t.accent, fontWeight: '800', fontSize: 14 }}>{tl('Estratto')}</Text></Press>}>{tl('Ultime operazioni')}</SectionTitle>
      <Panel pad={6}>
        {recent.length === 0 ? <Body small muted style={{ margin: 12 }}>Nessuna operazione per ora.</Body> : recent.map((m) => (
          <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}><Icon name={m.kind === 'spend' ? 'arrow-up' : 'arrow-down'} size={17} color={t.text} /></View>
            <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: t.text, fontWeight: '700', fontSize: 14.5 }}>{m.label}</Text><Text style={{ color: t.muted, fontSize: 12 }}>{new Date(m.ts).toLocaleDateString('it-CH', { day: 'numeric', month: 'short' })}</Text></View>
            <Amount n={m.kind === 'spend' || m.kind === 'withdraw' ? -m.amount : m.amount} size={15} color={m.kind === 'earn' ? t.positive : t.text} sign />
          </View>
        ))}
      </Panel>

      {/* ---- finestre ---- */}
      <Sheet visible={sheet === 'send'} title="Invia LifePoints" onClose={closeSheet}>
        <Body small muted style={{ marginBottom: 8 }}>A chi?</Body>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>{people.slice(0, 20).map((n) => <Pill key={n} label={n} icon="profile" on={who[0] === n} onPress={() => toggleWho(n, true)} />)}</Row>
        <Input keyboardType="decimal-pad" placeholder="Quanti LP?" value={amt} onChangeText={setAmt} style={{ marginTop: 12 }} />
        <Input placeholder="Per cosa (facoltativo)" value={note} onChangeText={setNote} />
        <Btn title="Invia" onPress={() => { const r = who[0] ? sendLP(who[0], parse(amt), { note, via: 'lifepoints' }) : { ok: false, message: 'Scegli a chi inviare' }; toast(r.message); if (r.ok) closeSheet(); }} />
      </Sheet>
      <Sheet visible={sheet === 'request'} title="Richiedi LifePoints" onClose={closeSheet}>
        <Body small muted style={{ marginBottom: 8 }}>A chi li chiedi?</Body>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>{people.slice(0, 20).map((n) => <Pill key={n} label={n} icon="profile" on={who.includes(n)} onPress={() => toggleWho(n, false)} />)}</Row>
        <Input keyboardType="decimal-pad" placeholder="Quanti LP (a ciascuno)?" value={amt} onChangeText={setAmt} style={{ marginTop: 12 }} />
        <Input placeholder="Motivo (facoltativo)" value={note} onChangeText={setNote} />
        <Btn title="Invia la richiesta" onPress={() => { const a = parse(amt); if (!who.length || a <= 0) { toast('Scegli chi e quanto'); return; } money.request(who, [a], note.trim()); toast('Richiesta inviata in chat'); closeSheet(); }} />
      </Sheet>
      <Sheet visible={sheet === 'split'} title="Dividi un conto" onClose={closeSheet}>
        <Body small muted style={{ marginBottom: 8 }}>Con chi lo dividi? Tu sei compreso.</Body>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>{people.slice(0, 20).map((n) => <Pill key={n} label={n} icon="profile" on={who.includes(n)} onPress={() => toggleWho(n, false)} />)}</Row>
        <Input keyboardType="decimal-pad" placeholder="Totale in LP" value={amt} onChangeText={setAmt} style={{ marginTop: 12 }} />
        <Input placeholder="Cosa (es. cena di sabato)" value={note} onChangeText={setNote} />
        {who.length && parse(amt) > 0 ? <Body small muted style={{ marginBottom: 8 }}>{tl('Ognuno paga circa {0} LP', splitEqual(parse(amt), who.length + 1)[0])}</Body> : null}
        <Btn title="Chiedi le quote" onPress={() => { const a = parse(amt); if (!who.length || a <= 0) { toast('Scegli con chi e il totale'); return; } splitBill(a, who, note.trim()); toast('Quote richieste in chat'); closeSheet(); }} />
      </Sheet>
      <Sheet visible={sheet === 'budget'} title="Imposta un budget" onClose={closeSheet}>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>{CATEGORIES.filter((c) => c !== 'Investimenti').map((c) => <Pill key={c} label={c} on={cat === c} onPress={() => setCat(c)} />)}</Row>
        <Input keyboardType="decimal-pad" placeholder="Limite mensile in LP (0 per toglierlo)" value={amt} onChangeText={setAmt} style={{ marginTop: 12 }} />
        <Btn title="Salva" onPress={() => { money.setBudget(cat, parse(amt)); toast('Budget salvato'); closeSheet(); }} />
      </Sheet>
      <Sheet visible={sheet === 'goal'} title="Nuovo obiettivo" onClose={closeSheet}>
        <Input placeholder="Nome (es. Viaggio a Lisbona)" value={name} onChangeText={setName} />
        <Input keyboardType="decimal-pad" placeholder="Quanti LP ti servono?" value={amt} onChangeText={setAmt} />
        <Btn title="Crea" onPress={() => { if (!name.trim() || parse(amt) <= 0) { toast('Scrivi un nome e un importo'); return; } money.addGoal(name, parse(amt)); closeSheet(); }} />
      </Sheet>
      <Sheet visible={sheet === 'fund'} title={money.goals.find((g) => g.id === goalId)?.name ?? 'Obiettivo'} onClose={closeSheet}>
        <Input keyboardType="decimal-pad" placeholder="Quanti LP metti da parte?" value={amt} onChangeText={setAmt} />
        <Row style={{ justifyContent: 'flex-start' }} gap={8}>
          <Btn small title="Metti da parte" onPress={() => { if (goalId && parse(amt) > 0) { if (parse(amt) > net.lifePoints) { toast('Saldo insufficiente'); return; } money.fundGoal(goalId, parse(amt)); closeSheet(); } }} />
          <Btn small ghost title="Togli" onPress={() => { if (goalId && parse(amt) > 0) { money.fundGoal(goalId, -parse(amt)); closeSheet(); } }} />
        </Row>
        <Row style={{ marginTop: 14 }}>
          <Body style={{ flex: 1 }}>Arrotonda le spese e metti la differenza qui</Body>
          <Btn small ghost title={money.roundUpGoal === goalId ? 'Attivo' : 'Attiva'} onPress={() => money.setRoundUp(money.roundUpGoal === goalId ? null : goalId)} />
        </Row>
        <Btn ghost danger title="Elimina l'obiettivo" onPress={() => { if (goalId) money.removeGoal(goalId); closeSheet(); }} />
      </Sheet>
      <Sheet visible={sheet === 'sub'} title="Aggiungi un abbonamento" onClose={closeSheet}>
        <Input placeholder="Nome" value={name} onChangeText={setName} />
        <Input keyboardType="decimal-pad" placeholder="LP al mese" value={amt} onChangeText={setAmt} />
        <Input keyboardType="number-pad" placeholder="Giorno del mese (1-28)" value={note} onChangeText={setNote} />
        <Btn title="Aggiungi" onPress={() => { if (!name.trim() || parse(amt) <= 0) { toast('Scrivi nome e importo'); return; } money.addSub(name, parse(amt), parse(note) || 1); toast('Abbonamento aggiunto'); closeSheet(); }} />
      </Sheet>
    </View>
  );
}
