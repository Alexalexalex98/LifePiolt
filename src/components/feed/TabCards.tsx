import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { LpTag, UserAvatar } from '@/components/network';
import { datedSlots, modeLabel } from '@/components/market';
import { providerInfoFor, describeCommunity } from '@/data/marketSeed';
import { useTheme } from '@/hooks/use-theme';
import { t as tl, translateText } from '@/i18n/core';
import { RatingChip, useItemAvg } from '@/components/ItemReviews';
import { formatCHF } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { fmtDateTime, fmtDuration } from '@/lib/when';
import { useVisible } from '@/lib/moderation';
import { useApp } from '@/store/app';
import { SIGNAL } from '@/lib/relevance';
import type { Product } from '@/lib/shop';
import type { Job } from '@/store/jobs';
import { useNet, type Community, type Provider } from '@/store/network';
import { heroPaletteFor } from './feedColors.ts';
import { ArtShapes, FEED_GUTTER, FEED_RADIUS, PressScale, SoftPill } from './parts';

/** Community: copertina a gradiente, pila di avatar dei membri, iscrizione e anteprima dell'ultimo post. */
export function CommunityCard({ c, joined, onToggle, onPostHere }: { c: Community; joined: boolean; onToggle: () => void; onPostHere: () => void }) {
  const t = useTheme();
  const p = heroPaletteFor(c.name);
  const d = describeCommunity(c);
  const last = c.posts[0];
  const stack = c.members.slice(0, 4);
  return (
    <View style={{ marginHorizontal: FEED_GUTTER, marginBottom: 20 }}>
      <PressScale onPress={() => go('communityProfile', { id: String(c.id) })} to={0.985} label={tl('Apri la community {0}', c.name)} style={{ borderRadius: FEED_RADIUS, overflow: 'hidden', backgroundColor: t.card, borderWidth: t.mode === 'light' ? 1 : 0, borderColor: t.border }}>
        <LinearGradient colors={[p.from, p.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 18, minHeight: 124, justifyContent: 'space-between' }}>
          <ArtShapes seed={c.name} size={360} />
          <SoftPill label={c.topic} icon="compass" color="#ffffff" bg="rgba(255,255,255,0.2)" />
          <Text numberOfLines={2} style={{ color: '#fff', fontSize: 24, lineHeight: 29, fontWeight: '800', letterSpacing: -0.4, marginTop: 18 }}>{c.name}</Text>
        </LinearGradient>
        <View style={{ padding: 16, gap: 12 }}>
          <Text numberOfLines={3} style={{ color: t.muted, fontSize: 14, lineHeight: 20 }}>{d.desc}</Text>
          {last ? (
            <View style={{ backgroundColor: t.cardAlt, borderRadius: 14, padding: 12, gap: 4 }}>
              <Text style={{ color: t.muted, fontSize: 11.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>Ultimo post</Text>
              <Text numberOfLines={2} style={{ color: t.text, fontSize: 14, lineHeight: 20 }}><Text style={{ fontWeight: '800' }}>{last.author} </Text>{last.text}</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {stack.map((m, i) => <View key={m} style={{ marginStart: i ? -9 : 0, borderRadius: 14, borderWidth: 2, borderColor: t.card }}><UserAvatar name={m} size={24} /></View>)}
            </View>
            <Text style={{ color: t.muted, fontSize: 13, flex: 1 }} numberOfLines={2}>{tl(c.members.length === 1 ? '{0} membro' : '{0} membri', c.members.length)}{c.openPosting ? '' : ' · ' + tl('solo il proprietario pubblica')}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={onToggle} accessibilityRole="button" accessibilityLabel={translateText(joined ? 'Iscritto' : 'Iscriviti') + ' ' + c.name} style={({ pressed }) => ({ flex: 1, minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: joined ? t.chip : t.text, opacity: pressed ? 0.8 : 1 })}>
              <Text style={{ color: joined ? t.text : t.onText, fontSize: 15, fontWeight: '800' }}>{joined ? 'Iscritto' : 'Iscriviti'}</Text>
            </Pressable>
            {joined ? (
              <Pressable onPress={onPostHere} accessibilityRole="button" accessibilityLabel={translateText('Pubblica qui')} style={({ pressed }) => ({ flex: 1, minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.border, opacity: pressed ? 0.8 : 1 })}>
                <Text style={{ color: t.text, fontSize: 15, fontWeight: '700' }}>Pubblica qui</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </PressScale>
    </View>
  );
}

/** Banda in alto del servizio: foto scelta da chi lo offre oppure uno sfondo scelto da LifePilot; a destra tipo di sessione e recensioni. */
export function ServiceBanner({ p }: { p: Provider }) {
  const info = providerInfoFor(p);
  const g = heroPaletteFor(p.name + p.role);
  return (
  <LinearGradient colors={[g.from, g.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 18, paddingTop: 46, flexDirection: 'row', alignItems: 'center', gap: 14, overflow: 'hidden' }}>
    {p.cover ? <><Image source={{ uri: p.cover }} pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }} contentFit="cover" /><View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: 'rgba(0,0,0,0.38)' }} /></> : <ArtShapes seed={p.name} size={360} />}
    <View style={{ position: 'absolute', top: 12, end: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ backgroundColor: 'rgba(0,0,0,0.38)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{modeLabel(info.mode)}</Text></View>
      <View style={{ backgroundColor: 'rgba(0,0,0,0.38)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}><RatingChip refKey={`service:${p.name}`} light /></View>
    </View>
    <UserAvatar name={p.name} size={56} />
    <View style={{ flex: 1, gap: 3 }}>
      <Text numberOfLines={1} style={{ color: '#fff', fontSize: 19, fontWeight: '800' }}>{p.name}</Text>
      <Text numberOfLines={2} style={{ color: g.sub, fontSize: 14 }}>{p.role}</Text>
    </View>
  </LinearGradient>
  );
}

/** Servizio di un professionista: intestazione a gradiente con ruolo e voto, prossimo slot, prezzo e prenotazione. */
export function ServiceFeedCard({ p }: { p: Provider }) {
  const t = useTheme();
  const me = useApp((a) => a.account.name);
  const info = providerInfoFor(p);
  const slots = datedSlots(p);
  const enrollments = useNet((s) => s.enrollments);
  const open = enrollments.filter((e) => e.kind === 'service' && e.host === p.name && e.status === 'enrolled').length;
  const visible = useVisible();
  if (!visible('service', p.name, p.name)) return null;
  const own = p.name === me;
  const disabled = !slots.length && !own;
  return (
    <View style={{ marginHorizontal: FEED_GUTTER, marginBottom: 20 }}>
      <PressScale onPress={() => go('servicePage', { name: p.name })} to={0.985} label={tl('Apri il servizio di {0}', p.name)} style={{ borderRadius: FEED_RADIUS, overflow: 'hidden', backgroundColor: t.card, borderWidth: t.mode === 'light' ? 1 : 0, borderColor: t.border }}>
        <ServiceBanner p={p} />
        <View style={{ padding: 16, gap: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="clock" size={15} color={t.muted} /><Text style={{ color: t.text, fontSize: 13.5 }}>{fmtDuration(info.durationMin)}</Text></View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name={info.mode === 'presenza' ? 'location' : 'video'} size={15} color={t.muted} /><Text style={{ color: t.text, fontSize: 13.5 }}>{modeLabel(info.mode)}</Text></View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="calendar" size={15} color={t.muted} />
            <Text style={{ color: slots.length ? t.text : t.muted, fontSize: 13.5, flex: 1 }}>{slots.length ? tl('Prossimo slot: {0}', fmtDateTime(slots[0].ts)) : 'Nessuno slot libero al momento'}</Text>
          </View>
          {open > 0 && <Text style={{ color: t.accent, fontSize: 13.5, fontWeight: '700' }}>{open === 1 ? tl('Hai {0} prenotazione con {1}', open, p.name) : tl('Hai {0} prenotazioni con {1}', open, p.name)}</Text>}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 }}>
              {p.price ? <><Text style={{ color: t.text, fontSize: 19, fontWeight: '800' }}>{formatCHF(p.price)}</Text><LpTag size={15} /><Text style={{ color: t.muted, fontSize: 13 }}> / sessione</Text></> : <Text style={{ color: t.text, fontSize: 17, fontWeight: '800' }}>Gratuito</Text>}
            </View>
            <View style={{ minHeight: 44, borderRadius: 14, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: own || disabled ? t.chip : t.text, opacity: disabled ? 0.6 : 1 }}>
              <Text style={{ color: own || disabled ? t.text : t.onText, fontSize: 14.5, fontWeight: '800' }}>{own ? 'Il tuo servizio' : 'Vedi e prenota'}</Text>
            </View>
          </View>
        </View>
      </PressScale>
    </View>
  );
}

/** Prodotto di un negozio: copertina (foto o colore), nome, negozio e prezzo in LifePoints. */
export function ProductFeedCard({ p }: { p: Product }) {
  const t = useTheme();
  const open = () => { useNet.getState().signal(p.name + ' ' + p.desc, SIGNAL.open); go('shopPage', { name: p.shop }); };
  return (
    <View style={{ marginHorizontal: FEED_GUTTER, marginBottom: 20 }}>
      <PressScale onPress={open} to={0.985} label={tl('{0} nel negozio di {1}', p.name, p.shop)} style={{ borderRadius: FEED_RADIUS, overflow: 'hidden', backgroundColor: t.card, borderWidth: t.mode === 'light' ? 1 : 0, borderColor: t.border }}>
        <View style={{ height: 150, backgroundColor: p.color, alignItems: 'center', justifyContent: 'center' }}>
          {p.images?.[0] ? <Image source={{ uri: p.images[0] }} style={{ width: '100%', height: 150 }} contentFit="cover" /> : <Text style={{ color: '#fff', fontSize: 44, fontWeight: '800' }}>{p.name.trim().charAt(0).toUpperCase()}</Text>}
        </View>
        <View style={{ padding: 16, gap: 6 }}>
          <Text numberOfLines={2} style={{ color: t.text, fontSize: 17, fontWeight: '800' }}>{p.name}</Text>
          <Text style={{ color: t.muted, fontSize: 13.5 }}>{tl('Negozio di {0}', p.shop)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Text style={{ color: t.text, fontSize: 18, fontWeight: '800' }}>{p.price}</Text><LpTag size={15} /></View>
            <Text style={{ color: p.stock > 0 ? t.muted : t.danger, fontSize: 12.5 }}>{p.stock > 0 ? tl('{0} disp.', p.stock) : 'Esaurito'}</Text>
          </View>
        </View>
      </PressScale>
    </View>
  );
}

/** Offerta di lavoro nella Home: ruolo, azienda, luogo e competenze richieste; tocca per aprire il dettaglio. */
export function JobFeedCard({ job }: { job: Job }) {
  const t = useTheme();
  return (
    <View style={{ marginHorizontal: FEED_GUTTER, marginBottom: 20 }}>
      <PressScale onPress={() => go('jobDetail', { id: job.id })} to={0.985} label={tl('Offerta di lavoro: {0}, {1}', job.title, job.company)} style={{ borderRadius: FEED_RADIUS, overflow: 'hidden', backgroundColor: t.card, borderWidth: t.mode === 'light' ? 1 : 0, borderColor: t.border, padding: 16, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="briefcase" size={18} color={t.accent} />
          <Text style={{ color: t.accent, fontSize: 12, fontWeight: '800', letterSpacing: 0.6 }}>{tl('LAVORO')}</Text>
        </View>
        <Text numberOfLines={2} style={{ color: t.text, fontSize: 18, fontWeight: '800' }}>{job.title}</Text>
        <Text style={{ color: t.muted, fontSize: 13.5 }}>{`${job.company} · ${job.location} · ${job.kind}`}</Text>
        {job.pay ? <Text style={{ color: t.text, fontSize: 14, fontWeight: '700' }}>{job.pay}</Text> : null}
      </PressScale>
    </View>
  );
}
