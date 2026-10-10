import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { LpTag, UserAvatar, openSheet } from '@/components/network';
import { SPONSORED_TEXT, modeLabel, statusOf, useSeminarEnrollment } from '@/components/market';
import { useTheme } from '@/hooks/use-theme';
import { fmtDate } from '@/i18n/format';
import { t as tl, translateText } from '@/i18n/core';
import { seminarFacts, useNow } from '@/lib/enroll';
import { formatCHF } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { rateIdea, scoreColor } from '@/lib/network';
import { fmtHour, pubLabel } from '@/lib/when';
import { useVisible } from '@/lib/moderation';
import { useApp } from '@/store/app';
import { useNet, type Idea, type Seminar } from '@/store/network';
import { contribute } from '@/components/network';
import { dateBadgeParts, raisedPct } from './feedLogic.ts';
import { heroPaletteFor } from './feedColors.ts';
import { ArtShapes, FEED_GUTTER, FEED_RADIUS, PressScale, SoftPill } from './parts';

void SPONSORED_TEXT;

/** Idea / progetto: hero a gradiente (o con la sua immagine), titolo grande, barra di raccolta LifePoints e "Contribuisci". */
export function IdeaHero({ idea, inset = true }: { idea: Idea; inset?: boolean }) {
  const ideas = useNet((s) => s.ideas);
  const visible = useVisible();
  if (!visible('idea', idea.id, idea.author)) return null;
  const p = heroPaletteFor(idea.title);
  const score = rateIdea(idea.desc);
  const pct = raisedPct(idea.raised, idea.target);
  const dup = idea.similarTo ? ideas.find((x) => x.id === idea.similarTo) : null;
  const reward = idea.rewardType === 'fisso'
    ? tl('Contributo fisso: {0} LP', idea.fixedAmount ?? 0) + (idea.rewardDesc ? ' · ' + idea.rewardDesc : '')
    : idea.rewardDesc ? tl('Importo libero · In cambio: {0}', idea.rewardDesc) : tl('Importo libero · nessuna ricompensa specificata');
  return (
    <View style={{ marginHorizontal: inset ? FEED_GUTTER : 0, marginBottom: 26 }}>
      <PressScale onPress={() => go('ideaProfile', { id: String(idea.id) })} to={0.985} label={tl('Apri l\'idea {0}', idea.title)} style={{ borderRadius: FEED_RADIUS, overflow: 'hidden' }}>
        <LinearGradient colors={[p.from, p.to]} start={{ x: 0.05, y: 0 }} end={{ x: 0.95, y: 1 }} style={{ padding: 20, paddingTop: 18 }}>
          {idea.uri ? <Image source={{ uri: idea.uri }} style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }} contentFit="cover" /> : <ArtShapes seed={idea.title} size={420} />}
          {idea.uri ? <LinearGradient colors={['rgba(8,10,20,0.35)', 'rgba(8,10,20,0.88)']} style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }} /> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <SoftPill label="Idea" icon="sparkle" color="#ffffff" bg="rgba(255,255,255,0.18)" />
            <Pressable onPress={() => openSheet('scoreExpl', { id: idea.id })} hitSlop={8} accessibilityRole="button" accessibilityLabel={tl('Punteggio AI {0} su 100: come viene calcolato', score)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.32)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: scoreColor(score) }} />
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{score}/100</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => openSheet('ideaMenu', { author: idea.author, id: idea.id, label: idea.title })} hitSlop={8} accessibilityRole="button" accessibilityLabel={translateText('Altre azioni sull\'idea')} style={{ width: 44, height: 44, marginEnd: -10, marginTop: -8, alignItems: 'center', justifyContent: 'center' }}><Icon name="more-h" size={22} color="#fff" stroke={2.2} /></Pressable>
          </View>
          <Text style={{ color: '#fff', fontSize: 31, lineHeight: 36, fontWeight: '800', letterSpacing: -0.5, marginTop: 34 }}>{idea.title}</Text>
          {idea.ts ? <Text style={{ color: p.sub, fontSize: 12.5, marginTop: 4, opacity: 0.9 }}>{pubLabel(idea.ts, 'Pubblicata')}</Text> : null}
          <Text numberOfLines={3} style={{ color: p.sub, fontSize: 14.5, lineHeight: 21, marginTop: 10 }}>{idea.desc}</Text>
          {dup ? <Text style={{ color: '#ffe0a8', fontSize: 12.5, marginTop: 8 }}>{tl('Simile a "{0}" di {1}, creata prima', dup.title, dup.author)}</Text> : null}

          <View style={{ marginTop: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 }}>
                <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>{formatCHF(idea.raised)}</Text>
                <LpTag size={17} dark={false} />
                <Text style={{ color: p.sub, fontSize: 13, marginStart: 4 }} numberOfLines={1}>{tl('su {0} raccolti', formatCHF(idea.target || 500))}</Text>
              </View>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>{pct}%</Text>
            </View>
            <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }} style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.24)', overflow: 'hidden', marginTop: 10, direction: 'ltr' }}>
              <View style={{ width: `${pct}%`, height: '100%', borderRadius: 4, backgroundColor: '#ffffff' }} />
            </View>
            <Text numberOfLines={2} style={{ color: p.sub, fontSize: 12.5, marginTop: 10, lineHeight: 18 }}>{reward}</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 }}>
            <UserAvatar name={idea.author} size={24} />
            <Text onPress={() => go('userProfile', { name: idea.author })} numberOfLines={1} style={{ color: '#fff', fontSize: 13, flex: 1 }}>Titolare: <Text style={{ fontWeight: '800' }}>{idea.author}</Text></Text>
          </View>
          <Pressable onPress={() => contribute(idea)} accessibilityRole="button" accessibilityLabel={translateText('Contribuisci con LifePoints')} style={({ pressed }) => ({ marginTop: 16, minHeight: 50, borderRadius: 16, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: pressed ? 0.85 : 1 })}>
            <Icon name="coin" size={20} color="#10151d" stroke={1.9} />
            <Text style={{ color: '#10151d', fontSize: 15.5, fontWeight: '800' }}>Contribuisci con LifePoints</Text>
          </Pressable>
        </LinearGradient>
      </PressScale>
    </View>
  );
}

/** Seminario (anche sponsorizzato): badge data grande, titolo, ora, posti liberi, Online/In presenza e pulsante chiaro. */
export function SeminarFeedCard({ s, inset = true }: { s: Seminar; inset?: boolean }) {
  const t = useTheme();
  const me = useApp((a) => a.account.name);
  const now = useNow(30000);
  const f = seminarFacts(s);
  const enr = useSeminarEnrollment(s.id);
  const st = statusOf(enr, now);
  const visible = useVisible();
  if (!visible('seminar', s.id, s.host)) return null;
  const p = heroPaletteFor(s.title + s.host);
  const parts = f.startsAt ? dateBadgeParts(f.startsAt) : null;
  const month = f.startsAt ? fmtDate(f.startsAt, { month: 'short' }).replace('.', '').toUpperCase() : '';
  const full = f.seatsLeft === 0;
  const isOwn = s.host === me;
  const cta = isOwn && !s.promoted ? null : st ? st.label : full ? 'Posti esauriti' : 'Iscriviti';
  const timeLine = f.startsAt ? `${fmtHour(f.startsAt)} - ${fmtHour(f.startsAt + f.durationMin * 60000)}` : 'Data da definire';
  return (
    <View style={{ marginHorizontal: inset ? FEED_GUTTER : 0, marginBottom: 26 }}>
      <PressScale onPress={() => go('seminarPage', { id: String(s.id) })} to={0.985} label={tl('Apri il seminario {0}', s.title)} style={{ borderRadius: FEED_RADIUS, overflow: 'hidden', backgroundColor: t.card, borderWidth: t.mode === 'light' ? 1 : 0, borderColor: t.border }}>
        <LinearGradient colors={[p.from, p.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 118, padding: 16, justifyContent: 'space-between' }}>
          <ArtShapes seed={s.title} size={360} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <View style={{ backgroundColor: '#ffffff', borderRadius: 16, minWidth: 62, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center' }}>
              {parts ? (
                <>
                  <Text style={{ color: '#10151d', fontSize: 27, lineHeight: 30, fontWeight: '800' }}>{parts.day}</Text>
                  <Text style={{ color: '#3b3f9e', fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>{month}</Text>
                </>
              ) : <View style={{ paddingVertical: 6 }}><Icon name="calendar" size={26} color="#10151d" /></View>}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              {s.promoted ? (
                <Pressable onPress={() => openSheet('sponsoredInfo')} hitSlop={8} accessibilityRole="button" accessibilityLabel={translateText('Sponsorizzato: cosa significa')} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.38)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Sponsorizzato</Text>
                  <Icon name="info" size={12} color="#fff" stroke={2.2} />
                </Pressable>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Icon name={s.mode === 'presenza' ? 'location' : 'video'} size={12} color="#fff" stroke={2.2} />
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{modeLabel(s.mode)}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
        <View style={{ padding: 18, gap: 10 }}>
          <Text style={{ color: t.text, fontSize: 21, lineHeight: 26, fontWeight: '800', letterSpacing: -0.3 }}>{s.title}</Text>
          <Pressable onPress={() => go('userProfile', { name: s.host })} accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 }}>
            <UserAvatar name={s.host} size={24} />
            <Text style={{ color: t.muted, fontSize: 13.5 }}>di <Text style={{ color: t.text, fontWeight: '700' }}>{s.host}</Text></Text>
          </Pressable>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 6, marginTop: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="clock" size={15} color={t.muted} /><Text style={{ color: t.text, fontSize: 13.5 }}>{timeLine}</Text></View>
            {f.seatsLeft !== null && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="users" size={15} color={full ? t.danger : t.muted} /><Text style={{ color: full ? t.danger : t.text, fontSize: 13.5 }}>{full ? 'Posti esauriti' : tl('{0} posti liberi su {1}', f.seatsLeft, f.seats)}</Text></View>}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8 }}>
            {s.price ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Text style={{ color: t.text, fontSize: 19, fontWeight: '800' }}>{formatCHF(s.price)}</Text><LpTag size={15} /></View>
            ) : <Text style={{ color: t.text, fontSize: 17, fontWeight: '800' }}>Gratuito</Text>}
            {cta ? (
              <View style={{ minHeight: 44, borderRadius: 14, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: st ? t.chip : full ? t.chip : t.text }}>
                <Text style={{ color: st || full ? t.text : t.onText, fontSize: 14.5, fontWeight: '800' }}>{cta}</Text>
              </View>
            ) : (
              <Pressable onPress={() => openSheet('promoteSeminar', { id: s.id })} accessibilityRole="button" accessibilityLabel={translateText('Promuovi con LifePoints')} style={{ minHeight: 44, borderRadius: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.border }}>
                <Text style={{ color: t.text, fontSize: 14, fontWeight: '700' }}>Promuovi con LifePoints</Text>
              </Pressable>
            )}
          </View>
        </View>
      </PressScale>
    </View>
  );
}

/** Citazione LifePilot: carta sobria, senza gradiente. */
export function QuoteCard({ text, author }: { text: string; author: string }) {
  const t = useTheme();
  return (
    <View style={{ marginHorizontal: FEED_GUTTER, marginBottom: 26, borderRadius: FEED_RADIUS, backgroundColor: t.cardAlt, borderWidth: 1, borderColor: t.border, paddingVertical: 22, paddingHorizontal: 22, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', top: 22, bottom: 22, start: 0, width: 3, backgroundColor: t.accent, borderRadius: 2 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <Icon name="sparkle" size={15} color={t.accent} stroke={2} />
        <Text style={{ color: t.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>{author}</Text>
      </View>
      <Text style={{ color: t.text, fontSize: 19, lineHeight: 27, fontWeight: '600', letterSpacing: -0.2 }}>{text}</Text>
    </View>
  );
}
