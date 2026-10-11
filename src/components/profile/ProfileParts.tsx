import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { LpTag, openSheet } from '@/components/network';
import { Body, Btn, Card, Chev, Item, Progress, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatCHF } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { confirmDelete } from '@/lib/confirm';
import { STATUS_LABEL, businessesOnProfile, type IdStatus } from '@/lib/profile/identity';
import { lifePointsFor, reputationFor, skillStatesOf } from '@/lib/profile/actions';
import { HONESTY_NOTICE, SKILL_STATUS_LABEL, isVerified, quota, type SkillState, type SkillStatus } from '@/lib/profile/skills';
import { skillLabel } from '@/data/skillBank';
import { useIdentity } from '@/store/identity';
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
  return (
    <View accessibilityLabel={STATUS_LABEL[status]} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Icon name={ok ? 'check' : status === 'pending' ? 'clock' : 'x'} size={13} color={color} stroke={2.6} />
      <Text style={{ color, fontSize: 12.5, fontWeight: '700' }}>{STATUS_LABEL[status]}{preview && ok ? ' · Anteprima' : ''}</Text>
    </View>
  );
}

/* ---------- barra statistiche alta: Follower · Seguiti · Voto ---------- */
export function StatsBar({ followers, following, onFollowing, name }: { followers: number; following: number; onFollowing?: () => void; name: string }) {
  const t = useTheme();
  useNet((s) => s.votes);
  useIdentity((s) => s.qaVotes);
  const rep = reputationFor(name);
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
      {block(voteText, rep.votes ? tl('Voto · {0}', rep.votes === 1 ? tl('1 voto') : tl('{0} voti', rep.votes)) : 'Voto complessivo', () => openSheet('rating', { name }), <Icon name="star" size={17} color={t.warn} fill={t.warn} />, rep.score == null ? tl('Voto complessivo: nessun voto') : tl('Voto complessivo {0} su 5, basato su {1} voti', rep.score.toFixed(1), rep.votes))}
    </View>
  );
}

/* ---------- LifePoints ---------- */
export function LifePointsRow({ name }: { name: string }) {
  const t = useTheme();
  useNet((s) => s.receivedDaily);
  useNet((s) => s.dailyHistory);
  const lp = lifePointsFor(name);
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ flex: 1, backgroundColor: t.card, borderRadius: 18, padding: 14, borderWidth: t.mode === 'light' ? 1 : 0, borderColor: t.border }}>
        <Row gap={4} style={{ justifyContent: 'flex-start' }}><Text style={{ color: t.text, fontSize: 18, fontWeight: '800' }}>{formatCHF(lp.total)}</Text><LpTag size={14} /></Row>
        <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 2 }}>LifePoints ricevuti in tutto</Text>
      </View>
      <View style={{ flex: 1, backgroundColor: t.card, borderRadius: 18, padding: 14, borderWidth: t.mode === 'light' ? 1 : 0, borderColor: t.border }}>
        <Row gap={4} style={{ justifyContent: 'flex-start' }}><Text style={{ color: t.text, fontSize: 18, fontWeight: '800' }}>{lp.today}</Text><LpTag size={14} /></Row>
        <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 2 }}>{lp.donors ? tl('Donati oggi · {0} donatori in tutto', lp.donors) : 'Donati oggi'}</Text>
      </View>
    </View>
  );
}

/* ---------- dettaglio del voto (contenuto della sheet) ---------- */
export function ReputationDetail({ name, onClose }: { name: string; onClose: () => void }) {
  const t = useTheme();
  useNet((s) => s.votes);
  useIdentity((s) => s.qaVotes);
  const rep = reputationFor(name);
  const counts = useNet.getState().votes[name] ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <>
      <Row gap={8} style={{ justifyContent: 'flex-start', alignItems: 'flex-end' }}>
        <Text style={{ color: t.text, fontSize: 38, fontWeight: '800' }}>{rep.score == null ? '–' : rep.score.toFixed(1)}</Text>
        <Text style={{ color: t.muted, fontSize: 16, marginBottom: 7 }}>/ 5</Text>
        <Icon name="star" size={24} color={t.warn} fill={t.warn} />
      </Row>
      <Body small muted>{rep.basedOn} · {rep.confidenceLabel}</Body>
      <Body bold style={{ marginTop: 16, marginBottom: 6 }}>Da cosa è composto</Body>
      {rep.parts.map((p) => (
        <Item key={p.id}>
          <Row><View style={{ flex: 1 }}><Body bold>{p.label}</Body><Body small muted>{p.note}</Body></View><View style={{ alignItems: 'flex-end' }}><Body bold>{p.avg == null ? '–' : p.avg.toFixed(1)}</Body><Body small muted>{p.id === 'interazioni' ? tl('{0} punti', p.n) : p.n === 1 ? tl('1 voto') : tl('{0} voti', p.n)}</Body></View></Row>
        </Item>
      ))}
      {total > 0 && (
        <>
          <Body bold style={{ marginTop: 14, marginBottom: 6 }}>Voti al profilo</Body>
          {[5, 4, 3, 2, 1].map((s) => { const n = counts[s] || 0; return <Item key={s}><Row><Body>{s === 1 ? '1 stella' : tl('{0} stelle', s)}</Body><Body small muted>{n}</Body></Row><Progress value={Math.round((n / total) * 100)} /></Item>; })}
        </>
      )}
      <Body small muted style={{ marginTop: 12 }}>Con pochi voti il valore resta vicino a 3,5 e si assesta man mano che arrivano. Votano il profilo solo le persone iscritte almeno una volta a un seminario, servizio o LifeClub; le risposte le vota chi aveva fatto la domanda. Mi piace, salvataggi e LifePoint contano poco e hanno un tetto.</Body>
      <Btn ghost style={{ marginTop: 12 }} title="Ho capito" onPress={onClose} />
    </>
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
                <View style={{ flex: 1 }}><Body bold>{b.name}</Body><Body small muted>{b.hiddenOnProfile ? 'Non visibile sul tuo profilo' : b.kind === 'azienda' ? 'Azienda' : b.kind === 'associazione' ? 'Associazione' : b.kind === 'scuola' ? 'Scuola' : b.kind === 'attivita' ? 'Attività' : 'Altro'}</Body></View>
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
