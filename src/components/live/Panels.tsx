import { View } from 'react-native';
import { Text } from '@/components/T';

import { UserAvatar } from '@/components/network';
import { Body, Btn, Card, Empty, Item, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from '@/lib/icons';
import { clockLabel, type LiveComment, type LiveSummary, type NetAdvice, type Participant } from '@/lib/liveRoom';
import { NoticeChip } from './Overlay';

export const PREVIEW_NOTE = 'Anteprima: la diretta tra telefoni si attiva collegando il servizio di streaming';

/** Sala d'attesa / pronto a iniziare, sopra al video. */
export function Lobby({ title, subtitle, hint, advice, primary, secondary, children }: {
  title: string; subtitle: string; hint?: string | null; advice: NetAdvice | null; primary?: { label: string; icon?: string; onPress: () => void; disabled?: boolean }; secondary?: { label: string; onPress: () => void }; children?: React.ReactNode;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }} pointerEvents="box-none">
      <View style={{ backgroundColor: 'rgba(8,10,16,0.92)', borderRadius: 22, padding: 18, gap: 10, width: '100%', maxWidth: 420, alignItems: 'center' }}>
        <Text accessibilityRole="header" style={{ color: '#fff', fontSize: 19, fontWeight: '800', textAlign: 'center' }}>{title}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>{subtitle}</Text>
        {hint ? <NoticeChip icon="clock" text={hint} /> : null}
        {children}
        {advice ? <NoticeChip icon={advice.level === 'ok' ? 'info' : 'alert'} tone={advice.level === 'bad' ? 'bad' : advice.level === 'warn' ? 'warn' : 'info'} text={advice.text} /> : null}
        {primary ? <Btn title={primary.label} icon={primary.icon} onPress={primary.onPress} disabled={primary.disabled} style={{ alignSelf: 'stretch' }} /> : null}
        {secondary ? <Btn ghost title={secondary.label} onPress={secondary.onPress} style={{ alignSelf: 'stretch', borderColor: 'rgba(255,255,255,0.4)' }} /> : null}
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11.5, textAlign: 'center', lineHeight: 16 }}>{PREVIEW_NOTE}</Text>
      </View>
    </View>
  );
}

/** Riepilogo a fine diretta. */
export function SummaryCard({ s, onClose }: { s: LiveSummary; onClose: () => void }) {
  const t = useTheme();
  const rows: [string, string][] = [
    ['Durata', clockLabel(s.durationMs)],
    ['Spettatori (massimo)', String(s.peakViewers)],
    ['Commenti', String(s.comments)],
    ['Domande', String(s.questions)],
  ];
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(5,7,12,0.82)' }}>
      <View style={{ backgroundColor: t.card, borderRadius: 22, padding: 18, width: '100%', maxWidth: 420, gap: 10 }}>
        <Row style={{ justifyContent: 'flex-start' }} gap={8}><Icon name="check" size={20} color={t.positive} stroke={2.4} /><Text accessibilityRole="header" style={{ color: t.text, fontSize: 18, fontWeight: '800' }}>Diretta conclusa</Text></Row>
        <Body small muted>{s.title}</Body>
        {rows.map(([k, v]) => <Row key={k}><Body small>{k}</Body><Body bold>{v}</Body></Row>)}
        {s.demo ? <Body small muted>I numeri di spettatori, commenti e domande dei partecipanti vengono dalla simulazione: sono un&apos;anteprima, non persone reali.</Body> : null}
        <Body small muted>Il riepilogo è salvato sul tuo telefono, nella pagina del {s.kind === 'seminar' ? 'seminario' : 'servizio'}.</Body>
        <Btn title="Chiudi" onPress={onClose} />
      </View>
    </View>
  );
}

/** Riga di riepilogo salvato (pagine seminario/servizio). */
export function SummaryRow({ s, onDelete, last }: { s: LiveSummary; onDelete: () => void; last?: boolean }) {
  return (
    <Item last={last}>
      <Row>
        <View style={{ flex: 1 }}>
          <Body bold>{clockLabel(s.durationMs)} · {s.peakViewers} spettatori</Body>
          <Body small muted>{s.comments} commenti · {s.questions} domande{s.demo ? ' · simulazione' : ''}</Body>
        </View>
        <Btn small ghost icon="trash" title="" label="Elimina il riepilogo" onPress={onDelete} />
      </Row>
    </Item>
  );
}

/** Relatore: elenco partecipanti, silenzia / rimuovi. */
export function PeopleSheet({ visible, onClose, people, onMute, onRemove }: { visible: boolean; onClose: () => void; people: Participant[]; onMute: (p: Participant) => void; onRemove: (p: Participant) => void }) {
  return (
    <Sheet visible={visible} title="Partecipanti" onClose={onClose}>
      {people.length === 0 ? <Empty text="Nessun partecipante collegato." /> : people.map((p, i) => (
        <Item key={p.id} last={i === people.length - 1}>
          <Row>
            <Row style={{ justifyContent: 'flex-start', flex: 1 }} gap={10}>
              <UserAvatar name={p.name} size={34} />
              <View style={{ flex: 1 }}><Body bold>{p.name}</Body><Body small muted>{p.muted ? 'Silenziato' : 'Può commentare'}{p.demo ? ' · demo' : ''}</Body></View>
            </Row>
            <Btn small ghost title={p.muted ? 'Riattiva' : 'Silenzia'} onPress={() => onMute(p)} />
            <Btn small danger title="Rimuovi" onPress={() => onRemove(p)} />
          </Row>
        </Item>
      ))}
    </Sheet>
  );
}

/** Relatore: domande ricevute, si possono fissare. */
export function QuestionsSheet({ visible, onClose, questions, onPin, pinnedId }: { visible: boolean; onClose: () => void; questions: LiveComment[]; onPin: (c: LiveComment) => void; pinnedId: string | null }) {
  return (
    <Sheet visible={visible} title="Domande dei partecipanti" onClose={onClose}>
      {questions.length === 0 ? <Empty text="Ancora nessuna domanda." /> : [...questions].reverse().map((c, i) => (
        <Item key={c.id} last={i === questions.length - 1}>
          <Row>
            <View style={{ flex: 1 }}><Body bold>{c.author}</Body><Body small>{c.text}</Body></View>
            <Btn small ghost icon="pin" title={pinnedId === c.id ? 'Togli' : 'Fissa'} onPress={() => onPin(c)} />
          </Row>
        </Item>
      ))}
    </Sheet>
  );
}

/** Relatore: azioni su un commento toccato. */
export function CommentActionsSheet({ comment, pinned, onClose, onPin, onMute, onRemove }: { comment: LiveComment | null; pinned: boolean; onClose: () => void; onPin: () => void; onMute: () => void; onRemove: () => void }) {
  return (
    <Sheet visible={!!comment} title={comment ? comment.author : ''} onClose={onClose}>
      {comment ? (
        <Card>
          <Body small>{comment.text}</Body>
          <View style={{ gap: 8, marginTop: 12 }}>
            <Btn small icon="pin" title={pinned ? 'Togli dal fissato' : 'Fissa il commento'} onPress={onPin} />
            {!comment.mine ? <Btn small ghost title="Silenzia il partecipante" onPress={onMute} /> : null}
            {!comment.mine ? <Btn small danger title="Rimuovi dalla diretta" onPress={onRemove} /> : null}
          </View>
        </Card>
      ) : null}
    </Sheet>
  );
}
