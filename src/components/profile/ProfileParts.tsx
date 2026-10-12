import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { fmtDate } from '@/i18n/format';
import { Text } from '@/components/T';

import { LpTag, UserAvatar, openSheet } from '@/components/network';
import { Body, Btn, Card, Chev, Item, Progress, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatCHF } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { confirmDelete } from '@/lib/confirm';
import { STATUS_LABEL, businessesOnProfile, roleIn, type IdStatus } from '@/lib/profile/identity';
import { ensureDemoVotes, interactionsFor, itemRefLabel, itemVotesFor, lifePointsFor, reputationFor, reviewsFor, skillStatesOf } from '@/lib/profile/actions';
import { HONESTY_NOTICE, SKILL_STATUS_LABEL, isVerified, quota, type SkillState, type SkillStatus } from '@/lib/profile/skills';
import { skillLabel } from '@/data/skillBank';
import { useApp } from '@/store/app';
import { useIdentity } from '@/store/identity';
import { useClub } from '@/store/club';
import { useJobs } from '@/store/jobs';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';
import { t as tl } from '@/i18n/core';

/* ---------- identità ---------- */
export function IdBadge({ status, preview }: { status: IdStatus; preview?: boolean }) {
  const t = useTheme();
  if (status === 'none') return null;
  const ok = status === 'verified';
  const color = ok ? t.positive : status === 'pending' ? t.warn : t.danger;
  const label = STATUS_LABEL[status] + (preview && ok ? ' · Anteprima' : '');
  return (
    <Pressable onPress={() => toast(label)} hitSlop={10} accessibilityRole="button" accessibilityLabel={label} style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="profile" size={21} color={color} stroke={2} />
      <View style={{ position: 'absolute', end: 0, bottom: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={ok ? 'check' : status === 'pending' ? 'clock' : 'x'} size={8} color={t.onText} stroke={3.4} />
      </View>
    </Pressable>
  );
}

/* ---------- barra statistiche alta: Follower · Seguiti · Voto ---------- */
/** Voto complessivo di una persona: UNA sola fonte per la barra del profilo e per la scheda di dettaglio, sempre aggiornata. */
export function useReputation(name: string) {
  const me = useApp((s) => s.account.name);
  const demo = useApp((s) => s.demo);
  useNet((s) => s.votes); useNet((s) => s.posts); useNet((s) => s.communities); useNet((s) => s.savedPosts); useNet((s) => s.receivedDaily);
  useIdentity((s) => s.qaVotes); useIdentity((s) => s.itemVotes);
  useClub((s) => s.ratings); useClub((s) => s.clubs);
  useEffect(() => { if (name === me && demo) ensureDemoVotes(name); }, [name, me, demo]);
  return reputationFor(name);
}

export function StatsBar({ followers, following, onFollowing, name }: { followers: number; following: number; onFollowing?: () => void; name: string }) {
  const t = useTheme();
  const rep = useReputation(name);
  const block = (value: string, label: string, onPress?: () => void, extra?: React.ReactNode, a11y?: string) => (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : 'text'} accessibilityLabel={a11y ?? `${value} ${label}`} style={{ flex: 1, minHeight: 62, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}>
      <Row gap={4} style={{ justifyContent: 'center' }}>{extra}<Text style={{ color: t.text, fontSize: 20, fontWeight: '800' }}>{value}</Text></Row>
      <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 1 }}>{label}</Text>
    </Pressable>
  );
  const sep = <View style={{ width: 1, backgroundColor: t.item, marginVertical: 12 }} />;
  const voteText = rep.score == null ? '–' : rep.score.toFixed(1);
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.card, borderRadius: 20, borderWidth: t.mode === 'light' ? 1 : 0, borderColor: t.border }}>
      {block(String(followers), 'Follower')}
      {sep}
      {block(String(following), 'Seguiti', onFollowing)}
      {sep}
      {block(voteText, rep.votes ? tl('Voto · {0}', rep.votes === 1 ? tl('1 voto') : tl('{0} voti', rep.votes)) : 'Voto', () => openSheet('rating', { name }), <Icon name="award" size={17} color={t.accent} />, rep.score == null ? tl('Voto complessivo: nessun voto') : tl('Voto complessivo {0} su 5, basato su {1} voti', rep.score.toFixed(1), rep.votes))}
    </View>
  );
}

/* ---------- LifePoints ---------- */
export function LifePointsRow({ name, isMe = false }: { name: string; isMe?: boolean }) {
  const t = useTheme();
  useNet((s) => s.receivedDaily);
  useNet((s) => s.dailyHistory);
  const lp = lifePointsFor(name);
  const tile = (value: number, label: string, kind: 'lpTotal' | 'lpDaily') => {
    const inner = (
      <>
        <Row gap={4} style={{ justifyContent: 'flex-start' }}><Text style={{ color: t.text, fontSize: 18, fontWeight: '800' }}>{formatCHF(value)}</Text><LpTag size={14} /></Row>
        <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 2 }}>{label}</Text>
      </>
    );
    const st = { flex: 1, backgroundColor: t.card, borderRadius: 18, padding: 14, borderWidth: t.mode === 'light' ? 1 : 0, borderColor: t.border } as const;
    // solo il proprietario del profilo può aprire il dettaglio
    return isMe ? <Pressable onPress={() => openSheet(kind)} accessibilityRole="button" accessibilityLabel={`${label}: ${formatCHF(value)}`} style={st}>{inner}</Pressable> : <View style={st}>{inner}</View>;
  };
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {tile(lp.total, 'LifePoints complessivi ricevuti', 'lpTotal')}
      {tile(lp.donors, 'LifePoints Giornalieri ricevuti', 'lpDaily')}
    </View>
  );
}

/* ---------- dettaglio del voto (contenuto della sheet) ---------- */
export function ReputationDetail({ name, onClose }: { name: string; onClose: () => void }) {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const demo = useApp((s) => s.demo);
  const isMe = name === me;
  useNet((s) => s.votes);
  useIdentity((s) => s.qaVotes);
  useIdentity((s) => s.reviews);
  const rep = useReputation(name);
  const [openPart, setOpenPart] = useState<string | null>(null);
  const counts = useNet.getState().votes[name] ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const reviews = reviewsFor(name, demo);
  const inter = interactionsFor(name);
  const qaGiven = (useIdentity.getState().qaVotes ?? []).filter((v) => v.to === name).length;
  return (
    <>
      <Row gap={10} style={{ justifyContent: 'flex-start', marginBottom: 8 }}><UserAvatar name={name} size={30} /><Text numberOfLines={1} style={{ color: t.muted, fontSize: 15, fontWeight: '600', flex: 1 }}>{isMe ? `${name} (tu)` : name}</Text></Row>
      <Row gap={8} style={{ justifyContent: 'flex-start', alignItems: 'flex-end' }}>
        <Text style={{ color: t.text, fontSize: 38, fontWeight: '800' }}>{rep.score == null ? '–' : rep.score.toFixed(1)}</Text>
        <Text style={{ color: t.muted, fontSize: 16, marginBottom: 7 }}>/ 5</Text>
        <Icon name="award" size={24} color={t.accent} />
      </Row>
      <Body small muted>{rep.basedOn}{isMe ? ` · ${rep.confidenceLabel}` : ''}</Body>
      {isMe && (
        <>
          <Body bold style={{ marginTop: 16, marginBottom: 6 }}>Da cosa è composto</Body>
          {rep.parts.map((p) => (
            <View key={p.id}>
              <Pressable onPress={() => setOpenPart(openPart === p.id ? null : p.id)} accessibilityRole="button" accessibilityState={{ expanded: openPart === p.id }} accessibilityLabel={`${p.label}: dettaglio`} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.item }}>
                <Row><View style={{ flex: 1 }}><Body bold>{p.label}</Body><Body small muted>{p.note}</Body></View><View style={{ alignItems: 'flex-end' }}><Body bold>{p.avg == null ? '–' : p.avg.toFixed(1)}</Body><Body small muted>{p.id === 'interazioni' ? tl('{0} punti', p.n) : p.n === 1 ? tl('1 voto') : tl('{0} voti', p.n)}</Body></View><Icon name={openPart === p.id ? 'arrow-up' : 'arrow-down'} size={15} color={t.muted} /></Row>
              </Pressable>
              {openPart === p.id && <PartDetail id={p.id} name={name} reviews={reviews} inter={inter} qaGiven={qaGiven} counts={counts} />}
            </View>
          ))}
        </>
      )}
      {total > 0 && (
        <>
          <Body bold style={{ marginTop: 14, marginBottom: 6 }}>Voti al profilo</Body>
          {[5, 4, 3, 2, 1].map((s) => { const n = counts[s] || 0; return <Item key={s}><Row><Body>{s === 1 ? '1 voto' : tl('{0} voti', s)}</Body><Body small muted>{n}</Body></Row><Progress value={Math.round((n / total) * 100)} /></Item>; })}
        </>
      )}
      {isMe && (
        <>
          <Body bold style={{ marginTop: 14, marginBottom: 6 }}>I tuoi numeri</Body>
          <Item><Row><Body>Mi piace ricevuti</Body><Body bold>{inter.likes}</Body></Row></Item>
          <Item><Row><Body>Salvataggi dei tuoi post</Body><Body bold>{inter.saves}</Body></Row></Item>
          <Item><Row><Body>Persone che ti hanno donato un LifePoint giornaliero</Body><Body bold>{inter.lpDonors}</Body></Row></Item>
          <Item last><Row><Body>Risposte votate</Body><Body bold>{qaGiven}</Body></Row></Item>
        </>
      )}
      <Body bold style={{ marginTop: 14, marginBottom: 6 }}>{isMe ? tl('Le tue recensioni ({0})', reviews.length) : 'Recensioni'}</Body>
      {reviews.length === 0 ? <Body small muted>Ancora nessuna recensione.</Body> : reviews.map((r, i) => (
        <Item key={i} last={i === reviews.length - 1}>
          <Row><Body bold style={{ flex: 1 }}>{r.from}</Body><Row gap={2}>{[1, 2, 3, 4, 5].map((n) => <Icon key={n} name="award" size={13} color={n <= r.stars ? t.accent : t.border} fill={n <= r.stars ? t.accent : 'none'} />)}</Row></Row>
          {r.text ? <Body small style={{ marginTop: 4 }}>{r.text}</Body> : null}
          {isMe ? <Body small muted style={{ marginTop: 2 }}>{fmtDate(new Date(r.ts), { day: 'numeric', month: 'long', year: 'numeric' })}</Body> : null}
        </Item>
      ))}
      {isMe && <Body small muted style={{ marginTop: 12 }}>Con pochi voti il valore resta vicino a 3,5 e si assesta man mano che arrivano. Votano il profilo le persone che hanno avuto una conversazione vera con te o che si sono iscritte a un tuo seminario, servizio o LifeClub; le risposte le vota chi aveva fatto la domanda. Chi ha partecipato a un tuo seminario o a una tua seduta può anche valutarlo: quella valutazione pesa un terzo di un voto al profilo. Mi piace, salvataggi e LifePoint contano poco e hanno un tetto. Gli altri vedono solo i voti e le recensioni.</Body>}
      <Btn ghost style={{ marginTop: 12 }} title="Ho capito" onPress={onClose} />
    </>
  );
}

/** Dettaglio di una parte del voto: chi ha dato cosa, con nomi chiari e da dove arriva (profilo, risposte, corsi e sedute, interazioni). */
function PartDetail({ id, name, reviews, inter, qaGiven, counts }: { id: string; name: string; reviews: { from: string; stars: number; text?: string; ts: number }[]; inter: { likes: number; saves: number; lpDonors: number }; qaGiven: number; counts: Record<number, number> }) {
  const t = useTheme();
  const stars = (n: number) => <Row gap={2}>{[1, 2, 3, 4, 5].map((k) => <Icon key={k} name="award" size={12} color={k <= n ? t.accent : t.border} fill={k <= n ? t.accent : 'none'} />)}</Row>;
  const box = { backgroundColor: t.tile, borderRadius: 14, padding: 12, marginVertical: 8 } as const;
  if (id === 'profilo') {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return (
      <View style={box}>
        <Body small muted style={{ marginBottom: 6 }}>Arrivano dal profilo: chi si è iscritto a un tuo seminario, servizio o LifeClub e chi ha parlato con te in chat.</Body>
        {total === 0 ? <Body small muted>Ancora nessun voto al profilo.</Body> : [5, 4, 3, 2, 1].map((s) => (counts[s] ? <Row key={s} style={{ paddingVertical: 3 }}>{stars(s)}<Body small>{counts[s]} {counts[s] === 1 ? 'voto' : 'voti'}</Body></Row> : null))}
        {reviews.length > 0 && <Body small bold style={{ marginTop: 8, marginBottom: 2 }}>Con motivazione</Body>}
        {reviews.slice(0, 6).map((r, i) => <View key={i} style={{ paddingVertical: 5 }}><Row><Body small bold style={{ flex: 1 }} numberOfLines={1}>{r.from}</Body>{stars(r.stars)}</Row>{r.text ? <Body small muted>{r.text}</Body> : null}</View>)}
      </View>
    );
  }
  if (id === 'corsi') {
    const votes = itemVotesFor(name);
    const refs = [...new Set(votes.map((v) => v.ref))];
    return (
      <View style={box}>
        <Body small muted style={{ marginBottom: 6 }}>Arrivano dai singoli seminari, sedute e LifeClub: ognuno ha la sua valutazione e pesa un terzo di un voto al profilo.</Body>
        {refs.length === 0 ? <Body small muted>Ancora nessuna valutazione a corsi o sedute.</Body> : refs.map((ref) => {
          const list = votes.filter((v) => v.ref === ref);
          const avg = list.reduce((a, v) => a + v.stars, 0) / list.length;
          return (
            <View key={ref} style={{ paddingVertical: 6 }}>
              <Row><Body small bold style={{ flex: 1 }} numberOfLines={2}>{itemRefLabel(ref)}</Body><Body small bold>{avg.toFixed(1)}</Body></Row>
              {list.map((v, i) => <Row key={i} style={{ paddingVertical: 2 }}><Body small muted style={{ flex: 1 }} numberOfLines={1}>{v.from}</Body>{stars(v.stars)}</Row>)}
            </View>
          );
        })}
      </View>
    );
  }
  if (id === 'risposte') return <View style={box}><Body small muted>Voti dati alle tue risposte da chi aveva fatto la domanda: {qaGiven}.</Body></View>;
  return (
    <View style={box}>
      <Body small muted style={{ marginBottom: 6 }}>Contano poco e hanno un tetto: servono a far emergere i profili attivi.</Body>
      <Row><Body small>Mi piace ricevuti</Body><Body small bold>{inter.likes}</Body></Row>
      <Row><Body small>Salvataggi dei tuoi post</Body><Body small bold>{inter.saves}</Body></Row>
      <Row><Body small>Persone che ti hanno donato un LifePoint</Body><Body small bold>{inter.lpDonors}</Body></Row>
    </View>
  );
}

/* ---------- competenze ---------- */
const STATUS_ICON: Record<SkillStatus, string> = { declared: 'dot', in_verification: 'clock', verified_test: 'check', verified_live: 'check', unconfirmed: 'info' };
export function SkillChip({ s }: { s: SkillState }) {
  const t = useTheme();
  const color = isVerified(s.status) ? t.positive : s.status === 'unconfirmed' ? t.danger : s.status === 'in_verification' ? t.warn : t.muted;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: t.chip }}>
      <Icon name={STATUS_ICON[s.status]} size={11} color={color} stroke={2.6} />
      <Text style={{ color, fontSize: 11.5, fontWeight: '700' }}>{SKILL_STATUS_LABEL[s.status]}</Text>
    </View>
  );
}

export function SkillsSection({ name, me }: { name: string; me: string }) {
  const t = useTheme();
  const isMe = name === me;
  useIdentity((s) => s.declared);
  useIdentity((s) => s.requests);
  useJobs((s) => s.practice);
  useJobs((s) => s.applications);
  const states = skillStatesOf(name, me);
  const q = quota(states);
  const incoming = useIdentity((s) => s.requests).filter((r) => r.to === me && r.status === 'requested').length;
  const requestVerify = (s: SkillState) => {
    const r = useIdentity.getState().requestVerification(me, name, s.id);
    if (!r.ok) { toast(r.why ?? 'Richiesta non inviata'); return; }
    toast(tl('Richiesta di verifica inviata a {0}', name));
  };
  return (
    <View>
      <Row style={{ marginBottom: 8 }}>
        <View style={{ flex: 1 }}><Text accessibilityRole="header" style={{ color: t.text, fontSize: 17, fontWeight: '800' }}>Competenze</Text>
          <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 1 }}>{q.total ? tl('{0} su {1} competenze verificate', q.verified, q.total) : 'Nessuna competenza dichiarata'}</Text></View>
        {isMe && <Btn small ghost icon="plus" title="Gestisci" onPress={() => go('skillVerify')} />}
      </Row>
      {q.total > 0 && <Progress value={Math.round((q.verified / q.total) * 100)} />}
      <Card style={{ marginTop: 10 }}>
        {states.length === 0 ? <Body small muted>{isMe ? 'Dichiara le competenze che hai: niente curriculum, contano quelle che puoi dimostrare.' : 'Nessuna competenza visibile.'}</Body> : states.map((s, i) => (
          <Item key={s.id} last={i === states.length - 1}>
            <Row>
              <View style={{ flex: 1, gap: 4 }}>
                <Body bold>{s.label}</Body>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <SkillChip s={s} />
                  {s.score != null && <Body small muted>{tl('{0}/100', s.score)}{s.ts ? ` · ${new Date(s.ts).toLocaleDateString()}` : ''}</Body>}
                </View>
                {s.status === 'unconfirmed' && s.declinedBy ? <Body small muted>{tl('{0} ha chiesto una verifica: non è stata effettuata', s.declinedBy)}</Body> : null}
              </View>
              {!isMe && !isVerified(s.status) && s.status !== 'in_verification' ? <Btn small ghost title="Richiedi verifica" onPress={() => requestVerify(s)} /> : null}
              {isMe && !isVerified(s.status) && s.status !== 'in_verification' && !s.id.startsWith('custom:') ? <Btn small ghost title="Verifica" onPress={() => go('jobTest', { skill: s.id })} /> : null}
            </Row>
          </Item>
        ))}
      </Card>
      {isMe && (
      <Row style={{ justifyContent: 'flex-start', marginTop: 8, alignItems: 'flex-start' }} gap={6}>
          <Icon name="info" size={15} color={t.muted} />
          <Body small muted style={{ flex: 1 }}>{HONESTY_NOTICE}</Body>
        </Row>
        )}
      {isMe && incoming > 0 && <Btn small style={{ marginTop: 10 }} title={incoming === 1 ? '1 richiesta di verifica da rivedere' : tl('{0} richieste di verifica da rivedere', incoming)} onPress={() => go('skillVerify')} />}
    </View>
  );
}

/* ---------- attività ---------- */
export function BusinessSection({ name, me }: { name: string; me: string }) {
  const t = useTheme();
  const isMe = name === me;
  const all = useIdentity((s) => s.businesses);
  const list = businessesOnProfile(all, name, isMe);
  if (!list.length && !isMe) return null;
  return (
    <View>
      <Row style={{ marginBottom: 8 }}>
        <Text accessibilityRole="header" style={{ color: t.text, fontSize: 17, fontWeight: '800', flex: 1 }}>{list.length > 1 ? 'Attività' : 'Attività collegata'}</Text>
        {isMe && <Btn small ghost icon="plus" title="Crea" onPress={() => go('businessCreate')} />}
      </Row>
      {list.length === 0 ? <Card><Body small muted>Puoi creare un’attività, un’associazione o un’azienda: sulla sua pagina ci sarà sempre scritto il tuo nome come titolare.</Body></Card> : (
        <Card>
          {list.map((b, i) => (
            <Item key={b.id} last={i === list.length - 1} onPress={() => go('businessPage', { id: b.id })}>
              <Row>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: b.color, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{b.name.trim().charAt(0).toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}><Body bold>{b.name}</Body><Body small muted>{b.hiddenOnProfile ? 'Non visibile sul tuo profilo' : `${roleIn(b, name) ?? ''} · ${b.kind === 'azienda' ? 'Azienda' : b.kind === 'associazione' ? 'Associazione' : b.kind === 'scuola' ? 'Scuola' : b.kind === 'attivita' ? 'Attività' : 'Altro'}`}</Body></View>
                <Chev />
              </Row>
            </Item>
          ))}
        </Card>
      )}
    </View>
  );
}

export function removeBusinessFlow(id: string, after?: () => void) {
  const b = useIdentity.getState().businesses.find((x) => x.id === id);
  if (!b) return;
  confirmDelete(tl('l’attività «{0}»', b.name), () => { useIdentity.getState().removeBusiness(id); after?.(); }, () => useIdentity.getState().restoreBusiness(b), { undoMessage: tl('Attività eliminata') });
}
export { skillLabel };
