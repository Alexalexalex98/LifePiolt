import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { UserAvatar } from '@/components/network';
import { Btn } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl, translateText } from '@/i18n/core';
import { clockLabel } from '@/lib/liveRoom';
import { enter, respond, whenLabel } from '@/lib/callActions';
import { canEnter, confirmedList, declinedList, isInvolved, minutesTo, phase } from '@/lib/groupCall';
import { Icon } from '@/lib/icons';
import { useNow } from '@/lib/enroll';
import { go } from '@/lib/nav';
import type { ChatMessage } from '@/store/chat';
import { useChatColors } from './parts';

/** «tra 2 h», «tra 15 min», «ora» */
export function inLabel(min: number): string {
  if (min <= 0) return tl('ora');
  if (min < 60) return tl('tra {0} min', min);
  if (min < 24 * 60) return tl('tra {0} h', Math.round(min / 60));
  const d = Math.round(min / 1440);
  return d === 1 ? tl('domani') : tl('tra {0} giorni', d);
}

/** La call nella chat: chi c'è, conferma o rifiuta, entra quando la stanza è aperta, rivede gli appunti di Theia. */
export function CallCard({ m, me }: { m: ChatMessage; me: string }) {
  const c = useChatColors();
  const t = useTheme();
  const now = useNow(15000);
  const call = m.call!;
  const ph = phase(call, now);
  const going = confirmedList(call), no = declinedList(call);
  const mine = isInvolved(call, me);
  const answer = call.rsvp[me];
  const instant = call.kind === 'instant';
  const tone = ph === 'open' ? t.positive : ph === 'ended' ? c.meta : t.accent;
  const notes = m.callRecord?.notes;
  return (
    <View style={{ minWidth: 250, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: tone + '2a', alignItems: 'center', justifyContent: 'center' }}><Icon name={call.video ? 'video' : 'phone'} size={17} color={tone} stroke={2} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.theirsText, fontSize: 15, fontWeight: '800' }} numberOfLines={2}>{call.title}</Text>
          <Text style={{ color: c.meta, fontSize: 11 }}>{m.from === me ? tl('La tua call') : tl('Call di {0}', m.from)}{m.callRecord?.theia ? ` · ${tl('Theia prende appunti')}` : ''}</Text>
        </View>
      </View>
      {!instant ? <Text style={{ color: c.theirsText, fontSize: 14, fontWeight: '700' }}>{whenLabel(call.startsAt)}{ph === 'upcoming' ? ` · ${inLabel(minutesTo(call, now))}` : ''}</Text> : null}
      {ph === 'ended' ? <Text style={{ color: c.meta, fontSize: 12 }}>{call.endedAt ? `${instant ? tl('Chiamata conclusa') : tl('Call conclusa')} · ${clockLabel(Math.max(0, call.endedAt - call.startsAt))}` : tl('Call conclusa')}</Text>
        : ph === 'open' ? <Text style={{ color: t.positive, fontSize: 12, fontWeight: '700' }}>{call.joined.length ? tl('In corso · {0} nella stanza', call.joined.length) : tl('La stanza è aperta')}</Text> : null}
      {!instant && ph !== 'ended' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <View style={{ flexDirection: 'row' }}>{going.slice(0, 5).map((n, i) => <View key={n} style={{ marginStart: i ? -8 : 0 }}><UserAvatar name={n} size={22} /></View>)}</View>
          <Text style={{ color: c.meta, fontSize: 12 }}>{tl('{0} confermati', going.length)}{no.length ? ` · ${tl('{0} non possono', no.length)}` : ''}</Text>
        </View>
      ) : null}
      {ph !== 'ended' && ph === 'open' && canEnter(call, me, now) ? <Btn small icon={call.video ? 'video' : 'phone'} title={tl('Entra')} onPress={() => enter(m.chatId, m.id, me)} /> : null}
      {ph === 'open' && !mine ? <Text style={{ color: c.meta, fontSize: 12 }}>{tl('Non hai confermato: chiedi a chi è nella stanza di invitarti.')}</Text> : null}
      {ph === 'upcoming' && m.from !== me ? (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {([['yes', 'Ci sono', 'check'], ['no', 'Non posso', 'x']] as const).map(([k, label, ic]) => {
            const on = answer === k;
            const col = k === 'yes' ? t.positive : t.danger;
            return (
              <Pressable key={k} onPress={() => respond(m.chatId, m.id, me, k)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={translateText(label)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, borderColor: on ? col : c.quoteBg, backgroundColor: on ? col + '22' : 'transparent' }}>
                <Icon name={ic} size={15} color={on ? col : c.meta} stroke={2.3} /><Text style={{ color: on ? col : c.theirsText, fontWeight: '800', fontSize: 13 }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {ph === 'upcoming' && m.from === me ? <Text style={{ color: c.meta, fontSize: 12 }}>{tl('Alle {0} si apre la stanza: chi ha confermato potrà entrare.', whenLabel(call.startsAt).split(' · ')[1] ?? '')}</Text> : null}
      {ph === 'ended' && notes ? <Btn small ghost icon="note" title={tl('Appunti di Theia')} onPress={() => go('callNotes', { chat: m.chatId, mid: m.id })} /> : null}
      {ph === 'ended' && !notes && m.callRecord?.theia ? <Text style={{ color: c.meta, fontSize: 12 }}>{tl('Nessun appunto: nessuno ha parlato con la trascrizione attiva.')}</Text> : null}
    </View>
  );
}
