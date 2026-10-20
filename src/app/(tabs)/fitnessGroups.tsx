import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/T';

import { FIT, FitHero } from '@/components/fitness/kit';
import { FormHead, Preview, Segments, Stepper } from '@/components/formKit';
import { Body, Btn, Card, IconSeg, Input, Page, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { PARTNER_GYMS } from '@/lib/fitness/data';
import { MAX_GROUP, MAX_PRICE_LP, SMALL_GROUP, WEEKDAYS, allowedStarts, groupState, gymSlots, hourLabel, scheduleLabel, slotLabel, validateGroup, type GroupLevel } from '@/lib/fitness/groups';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { useFitGroups } from '@/store/fitGroups';
import { useFitness } from '@/store/fitness';
import { toast } from '@/store/toast';

type Tab = 'tutti' | 'free' | 'paid' | 'mine';
const LEVEL: Record<GroupLevel, string> = { tutti: 'Tutti i livelli', principiante: 'Principianti', intermedio: 'Intermedi', avanzato: 'Avanzati' };

/** Allenarsi in gruppo: gruppi gratuiti (ci si aggrega, chi organizza accetta o no) e a pagamento in LifePoints. Ogni gruppo ha la sua community. */
export default function FitnessGroups() {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const demo = useApp((s) => s.demo);
  const fg = useFitGroups();
  const fit = useFitness();
  const [tab, setTab] = useState<Tab>('tutti');
  const [creating, setCreating] = useState(false);
  useEffect(() => { if (demo) fg.seedDemo(); }, [demo]); // eslint-disable-line react-hooks/exhaustive-deps
  const gyms = useMemo(() => [...PARTNER_GYMS, ...fit.approved], [fit.approved]);
  const list = fg.groups.filter((g) => (g.demo ? demo : true) && (tab === 'tutti' || (tab === 'free' && g.kind === 'free') || (tab === 'paid' && g.kind === 'paid') || (tab === 'mine' && (g.owner === me || g.members.includes(me) || g.requests.some((r) => r.name === me)))));
  const pending = fg.groups.filter((g) => g.owner === me).reduce((a, g) => a + g.requests.length, 0);

  return (
    <Page id="fitnessGroups" back title="Allenati in gruppo">
      <FitHero eyebrow="Gruppi" title="Meglio insieme" sub="Gruppi gratuiti per aggregarsi e gruppi a pagamento. Ognuno ha la sua community.">
        <Btn icon="plus" title="Crea un gruppo" onPress={() => setCreating(true)} />
      </FitHero>
      {pending ? <Card accent={FIT}><Row gap={8}><Icon name="users" size={20} color={FIT} /><Body bold style={{ flex: 1 }}>{tl('{0} richieste da valutare nei tuoi gruppi', pending)}</Body><Btn small ghost title="Vedi" onPress={() => setTab('mine')} /></Row></Card> : null}
      <IconSeg value={tab} onChange={(v) => setTab(v as Tab)} options={[{ id: 'tutti', icon: 'grid', label: 'Tutti' }, { id: 'free', icon: 'unlock', label: 'Gratuiti' }, { id: 'paid', icon: 'coin', label: 'A pagamento' }, { id: 'mine', icon: 'profile', label: 'I miei' }]} />
      {list.length === 0 ? <Card><Body muted>{tab === 'mine' ? 'Non sei ancora in nessun gruppo.' : 'Nessun gruppo qui. Crea il primo: scegli se è gratuito o a pagamento.'}</Body></Card> : null}
      {list.map((g) => {
        const st = groupState(g, me);
        const gym = gyms.find((x) => x.id === g.gymId);
        const badge = st === 'owner' ? 'Organizzi tu' : st === 'member' ? 'Sei dentro' : st === 'expired' ? 'Scaduto' : st === 'pending' ? 'Richiesta inviata' : st === 'declined' ? 'Non accettato' : st === 'full' ? 'Al completo' : '';
        return (
          <Card key={g.id} accent={g.kind === 'paid' ? FIT : undefined} onPress={() => go('fitnessGroup', { id: g.id })}>
            <Row><Body bold style={{ flex: 1 }}>{g.name}</Body>{g.kind === 'paid' ? <Body bold color={FIT}>{g.priceLP} LP {tl('al mese')}</Body> : <Body bold color={t.positive}>Gratis</Body>}</Row>
            <Body small muted>{LEVEL[g.level]} · {scheduleLabel(g)}{gym ? ` · ${gym.name}` : g.city ? ` · ${g.city}` : ''}</Body>
            <Row style={{ marginTop: 6 }}><Body small muted>{tl('{0} di {1} persone', g.members.length, g.max)} · {tl('di {0}', g.owner)}{g.demo ? ' · esempio' : ''}</Body>{badge ? <Pill label={badge} off /> : null}</Row>
          </Card>
        );
      })}
      <Card><Body small muted>I gruppi grandi (sopra le {SMALL_GROUP} persone, fino a {MAX_GROUP}) entrano in un centro convenzionato solo nelle fasce che il centro riserva ai gruppi, così la palestra non si satura. Ognuno entra con il proprio LifePass.</Body></Card>
      <CreateSheet visible={creating} onClose={() => setCreating(false)} gyms={gyms} me={me} />
    </Page>
  );
}

function CreateSheet({ visible, onClose, gyms, me }: { visible: boolean; onClose: () => void; gyms: ReturnType<typeof useFitness.getState>['approved']; me: string }) {
  const t = useTheme();
  const fg = useFitGroups();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'free' | 'paid'>('free');
  const [price, setPrice] = useState(20);
  const [max, setMax] = useState(8);
  const [level, setLevel] = useState<GroupLevel>('tutti');
  const [city, setCity] = useState('');
  const [desc, setDesc] = useState('');
  const [gymId, setGymId] = useState<string>('');
  const [slot, setSlot] = useState<{ day: number; hour: number } | null>(null);
  const gym = gyms.find((g) => g.id === gymId) ?? null;
  const starts = gym ? allowedStarts(gym) : [];
  const [day, setDay] = useState(0);
  const input = { name, kind, priceLP: price, max, gym, ...(slot ? { day: slot.day, hour: slot.hour } : {}) };
  const reasons = validateGroup(input, fg.groups);
  const big = max > SMALL_GROUP;
  const submit = () => {
    const r = fg.create({ ...input, desc, city, level, owner: me });
    toast(r.message);
    if (r.ok) { onClose(); setName(''); setDesc(''); setSlot(null); setGymId(''); if (r.id) go('fitnessGroup', { id: r.id }); }
  };
  const days = [...new Set(starts.map((s) => s.day))];
  return (
    <Sheet visible={visible} title="Crea un gruppo" onClose={onClose}>
      <FormHead icon="users" title="Il tuo gruppo" text="Crei tu il gruppo e decidi chi entra. Si apre da solo una community." />
      <Input placeholder="Nome del gruppo (es. Corsa del sabato)" value={name} onChangeText={setName} maxLength={50} />
      <Segments label="Com'è" value={kind} onChange={setKind} options={[{ v: 'free', label: 'Gratuito' }, { v: 'paid', label: 'A pagamento' }]} />
      <Body small muted style={{ marginBottom: 8 }}>{kind === 'free' ? 'Persone che si aggregano per allenarsi insieme: chi chiede di entrare lo accetti o no tu.' : `Si paga in LifePoints per 30 giorni. Prezzo da 1 a ${MAX_PRICE_LP} LP.`}</Body>
      <Row gap={8}>
        <Stepper label="Persone (max)" value={max} onChange={setMax} min={2} max={MAX_GROUP} />
        {kind === 'paid' ? <Stepper label="LP per 30 giorni" value={price} onChange={setPrice} min={1} max={MAX_PRICE_LP} /> : null}
      </Row>
      <Segments label="Livello" value={level} onChange={setLevel} options={(Object.keys(LEVEL) as GroupLevel[]).map((k) => ({ v: k, label: LEVEL[k] }))} />
      <Body bold style={{ marginTop: 4, marginBottom: 4 }}>Dove</Body>
      <Segments value={gymId || 'libero'} onChange={(v) => { setGymId(v === 'libero' ? '' : String(v)); setSlot(null); }} options={[{ v: 'libero', label: 'All’aperto o altrove' }, ...gyms.map((g) => ({ v: g.id, label: g.name }))]} />
      {!gym ? <Input placeholder="Città o luogo (facoltativo)" value={city} onChangeText={setCity} maxLength={40} /> : (
        <View style={{ backgroundColor: t.item, borderRadius: 16, padding: 12, marginBottom: 8 }}>
          <Body bold>{gym.name}</Body>
          <Body small muted>{big ? `Gruppi sopra le ${SMALL_GROUP} persone: ${gymSlots(gym).map(slotLabel).join(' · ')}.` : `Fino a ${SMALL_GROUP} persone puoi scegliere qualsiasi orario di apertura.`}</Body>
          <Body bold style={{ marginTop: 8, marginBottom: 6 }}>Giorno</Body>
          <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={6}>{(big ? days : [0, 1, 2, 3, 4, 5, 6]).map((d) => <Pill key={d} label={WEEKDAYS[d].slice(0, 3)} on={day === d} onPress={() => { setDay(d); setSlot(null); }} />)}</Row>
          <Body bold style={{ marginTop: 8, marginBottom: 6 }}>Ora d’inizio (dura un’ora)</Body>
          <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={6}>{(big ? starts.filter((s) => s.day === day).map((s) => s.hour) : Array.from({ length: 15 }, (_, i) => 7 + i)).map((h) => <Pill key={h} label={hourLabel(h)} on={slot?.day === day && slot.hour === h} onPress={() => setSlot({ day, hour: h })} />)}</Row>
        </View>
      )}
      <Input placeholder="Di cosa si tratta (facoltativo)" value={desc} onChangeText={setDesc} maxLength={200} multiline maxLines={4} />
      <Preview label="Il gruppo" value={name.trim() || 'Senza nome'}>
        <Body small muted style={{ marginTop: 2 }}>{kind === 'paid' ? `${price} LP · ` : 'Gratis · '}{max} persone{slot ? ` · ${WEEKDAYS[slot.day]} ${hourLabel(slot.hour)}` : ''}</Body>
      </Preview>
      {reasons.length && (name.trim() || slot) ? <Body small color={t.warn} style={{ marginTop: 6 }}>{reasons[0]}</Body> : null}
      <Btn style={{ marginTop: 10 }} title="Crea il gruppo" disabled={reasons.length > 0} onPress={submit} />
    </Sheet>
  );
}
