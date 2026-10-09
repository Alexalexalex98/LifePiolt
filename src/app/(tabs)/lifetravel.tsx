import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Btn, Card, H, Item, Link, Page, Pill, Row, Sheet, Toggle, XBtn, Chev } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { areaColors, Icon } from '@/lib/icons';
import { activitiesByStyle, destinations, genFlight, hotelPool, hotelScore, monthLabel, monthNumFromOffset, seasonMultiplier, styleLabel, topicToCity, travelStyles, yearLabel } from '@/lib/travel';
import { useLife } from '@/store/life';
import { useTravel } from '@/store/travel';
import { showUndoToast, toast } from '@/store/toast';
import { formatMoney, localizeMonths, monthName } from '@/i18n/format';
import { t as tl } from '@/i18n/core';

type View_ = null | 'city' | 'date' | 'guests' | 'itinerary';

export default function LifeTravel() {
  const t = useTheme();
  const tv = useTravel();
  const { vacRange, chat, addVacation } = useLife();
  const [view, setView] = useState<View_>(null);
  const [itin, setItin] = useState<null | { cityName: string; month: string; hotel: string; price: number; days: number; flight: number; tripTotal: number; text: string; acts: string[] }>(null);

  const city = destinations.find((c) => c.id === tv.city)!;
  const mult = seasonMultiplier(city.type, monthNumFromOffset(tv.monthOffset));
  const days = vacRange?.end ? Number(vacRange.end.slice(8)) - Number(vacRange.start.slice(8)) + 1 : 3;
  const vacText = vacRange?.end ? tl('{0}–{1} {2} ({3} giorni)', vacRange.start.slice(8), vacRange.end.slice(8), monthName(Number(vacRange.start.slice(5, 7)) - 1), days) : '';
  const g = tv.guests;
  const sorted = hotelPool.map((h, i) => ({ h, i, score: hotelScore(h, tv.style) })).sort((a, b) => b.score - a.score);

  // suggerimenti AI
  const counts: Record<string, number> = {};
  Object.keys(chat).forEach((k) => { counts[k] = (chat[k] || []).filter((m) => m.who === 'me').length; });
  const picks: { cityId: string; reason: string }[] = [];
  const used = new Set<string>();
  Object.keys(counts).filter((k) => counts[k] > 0).sort((a, b) => counts[b] - counts[a]).forEach((k) => {
    const cid = topicToCity[k];
    if (cid && !used.has(cid) && picks.length < 2) { picks.push({ cityId: cid, reason: `In base alle tue conversazioni su ${k}` }); used.add(cid); }
  });
  destinations.forEach((c) => { if (picks.length < 3 && !used.has(c.id) && seasonMultiplier(c.type, monthNumFromOffset(tv.monthOffset)) >= 1.2) { picks.push({ cityId: c.id, reason: `${c.name} è in alta stagione a ${monthLabel(tv.monthOffset)}` }); used.add(c.id); } });
  destinations.forEach((c) => { if (picks.length < 3 && !used.has(c.id)) { picks.push({ cityId: c.id, reason: 'In base al tuo profilo di viaggio' }); used.add(c.id); } });

  function generate(cityId = tv.city, hotelIdx = tv.hotelIdx) {
    if (hotelIdx == null) { toast('Seleziona prima un hotel dalla lista'); return; }
    const h = hotelPool[hotelIdx];
    const c = destinations.find((x) => x.id === cityId)!;
    const price = Math.round(h.price * seasonMultiplier(c.type, monthNumFromOffset(tv.monthOffset)));
    const flight = genFlight(c.id, tv.monthOffset);
    const stay = price * days, total = stay + flight.price * 2;
    const dateNote = vacRange?.end ? tl(', per il {0} (dalle tue vacanze in Plan)', vacText) : tl(', per {0}', localizeMonths(monthLabel(tv.monthOffset)));
    setItin({
      cityName: c.name, month: monthLabel(tv.monthOffset), hotel: h.name, price, days, flight: flight.price, tripTotal: total, acts: activitiesByStyle[tv.style],
      text: `Basato sul tuo profilo "${styleLabel(tv.style)}", su ${h.name} a ${c.name}${dateNote}. Andata · partenza ${String(flight.outDep).padStart(2, '0')}:00 (${flight.duration} min).`,
    });
    setView('itinerary');
  }

  const bestHotel = () => sorted[0].i;

  return (
    <Page id="lifetravel" title="LifeTravel" back>
      <Card>
        <H>Itinerari salvati</H>
        {tv.saved.length === 0 ? <Body small muted>Nessun itinerario salvato ancora.</Body> : tv.saved.map((it, i) => (
          <Item key={it.id} last={i === tv.saved.length - 1}>
            <Row><View style={{ flex: 1 }}><Body bold>{it.city}</Body><Body small muted>{it.hotel} · {it.days} notti · {it.month}</Body></View><Body bold>{formatMoney(it.tripTotal)}</Body>
              <XBtn onPress={() => { const rem = tv.del(it.id); if (rem) showUndoToast('Itinerario rimosso', () => tv.restore(rem)); }} /></Row>
          </Item>
        ))}
      </Card>

      <Card>
        <Body small muted style={{ marginBottom: 8 }}>Destinazione</Body>
        <Pressable onPress={() => setView('city')} style={{ backgroundColor: t.input, borderColor: t.inputBorder, borderWidth: 1, borderRadius: 14, padding: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: t.text, fontSize: 16 }}>{city.name}</Text><Icon name="chevron" size={16} color={t.muted} stroke={2} />
        </Pressable>
        <Row style={{ marginTop: 12 }} gap={8}>
          <Pressable onPress={() => setView('date')} style={{ flex: 1, backgroundColor: t.input, borderColor: t.inputBorder, borderWidth: 1, borderRadius: 14, padding: 13 }}><Text style={{ color: t.text }}>{monthLabel(tv.monthOffset)} {yearLabel(tv.monthOffset)}</Text></Pressable>
          <Pressable onPress={() => setView('guests')} style={{ flex: 1, backgroundColor: t.input, borderColor: t.inputBorder, borderWidth: 1, borderRadius: 14, padding: 13 }}><Text style={{ color: t.text }} numberOfLines={2}>{g.adults} adulti{g.children ? `, ${g.children} bambini` : ''} · {g.rooms} camera{g.rooms > 1 ? 'e' : ''}{g.pets ? ' · con animali' : ''}</Text></Pressable>
        </Row>
        <Btn style={{ marginTop: 10 }} title="Cerca" onPress={() => toast('Risultati aggiornati per ' + city.name)} />
      </Card>

      <Body small muted style={{ marginTop: 14, marginHorizontal: 2, marginBottom: 4 }}>Scelto dall'AI per te</Body>
      {vacText ? <Body small color="#ffc78a" style={{ marginBottom: 8 }}>In base alle tue vacanze in Plan: {vacText}</Body> : null}
      <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
        {picks.slice(0, 3).map((p) => {
          const c = destinations.find((x) => x.id === p.cityId)!;
          const rep = sorted[0].h;
          const price = Math.round(rep.price * seasonMultiplier(c.type, monthNumFromOffset(tv.monthOffset)));
          return (
            <Pressable key={c.id} onPress={() => { tv.set({ city: c.id, hotelIdx: bestHotel() }); generate(c.id, bestHotel()); }} style={{ width: 195 }}>
              <LinearGradient colors={['#201638', '#0e1219']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, borderWidth: 1, borderColor: '#3a2a5c', padding: 17 }}>
                <View style={{ alignSelf: 'flex-start', backgroundColor: '#2a1f45', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ color: '#c9b6ff', fontSize: 10, fontWeight: '700' }}>AI</Text></View>
                <Text style={{ color: '#f4f6f8', fontSize: 17, fontWeight: '700', marginTop: 10 }}>{c.name}</Text>
                <Text style={{ color: '#8e98a8', fontSize: 13, marginVertical: 2, marginBottom: 10 }}>{p.reason}</Text>
                <Text style={{ color: '#f4f6f8', fontSize: 16, fontWeight: '700' }}>da {formatMoney(price)}<Text style={{ color: '#8e98a8', fontSize: 13, fontWeight: '400' }}> / notte</Text></Text>
              </LinearGradient>
            </Pressable>
          );
        })}
      </ScrollView>

      <Body small muted style={{ marginTop: 14, marginHorizontal: 2, marginBottom: 6 }}>Che tipo di viaggiatore sei per questo viaggio?</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{travelStyles.map((s) => <Pill key={s.id} label={s.label} on={tv.style === s.id} onPress={() => tv.set({ style: s.id })} />)}</View>
      <Btn small ghost style={{ marginVertical: 14 }} title="Genera itinerario con AI" onPress={() => generate()} />

      {sorted.map((o, rank) => {
        const h = o.h;
        const tierLabel = h.tier === 'comfort' ? 'Comfort' : h.tier === 'budget' ? 'Risparmio' : 'Centrale';
        const tierColor = h.tier === 'comfort' ? '#b96bff' : h.tier === 'budget' ? '#4fd18b' : '#4fc7e0';
        const sel = tv.hotelIdx === o.i;
        const price = Math.round(h.price * mult);
        const sc = o.score, scColor = sc >= 80 ? t.positive : sc >= 55 ? t.warn : t.muted;
        return (
          <Card key={h.name} onPress={() => { tv.set({ hotelIdx: o.i }); toast('Hotel selezionato: ' + h.name); }} style={sel ? { borderColor: t.text } : undefined}>
            {rank === 0 && <View style={{ position: 'absolute', top: 14, start: 14, zIndex: 1, backgroundColor: t.text, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ color: t.bg, fontSize: 10, fontWeight: '700' }}>Top scelta per te</Text></View>}
            <LinearGradient colors={[tierColor + '40', '#11161f']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 88, borderRadius: 14 }} />
            <Row style={{ marginTop: 10 }}><Body bold>{h.name}</Body><View style={{ backgroundColor: tierColor + '22', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}><Text style={{ color: tierColor, fontSize: 12 }}>{tierLabel}</Text></View></Row>
            <Body small muted style={{ marginVertical: 4 }}>{h.rating}/5 ({h.reviews} recensioni) · {h.distance} km dal centro</Body>
            <View style={{ alignSelf: 'flex-start', backgroundColor: scColor + '22', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ color: scColor, fontSize: 10, fontWeight: '700' }}>{sc}% in linea col tuo viaggio</Text></View>
            <Row style={{ marginTop: 8 }}><Body bold>{formatMoney(price)} <Text style={{ color: t.muted, fontSize: 13, fontWeight: '400' }}>/ notte</Text></Body><Btn small ghost={!sel} title={sel ? 'Selezionato' : 'Seleziona'} onPress={() => { tv.set({ hotelIdx: o.i }); toast('Hotel selezionato: ' + h.name); }} /></Row>
          </Card>
        );
      })}
      <Body small muted style={{ marginVertical: 12 }}>LifePilot adatta hotel e attività al tuo profilo di viaggio, alla stagione e ai tuoi interessi, invece di mostrarti solo un elenco filtrabile a mano. Hotel, prezzi e voli sono simulati.</Body>

      <Sheet visible={view === 'city'} title="Scegli la destinazione" onClose={() => setView(null)}>
        {destinations.map((c, i) => <Item key={c.id} last={i === destinations.length - 1} onPress={() => { tv.set({ city: c.id }); setView(null); }}><Row><Body>{c.name}</Body>{c.id === tv.city ? <Body small color={t.positive}>Selezionata</Body> : <Chev />}</Row></Item>)}
      </Sheet>
      <Sheet visible={view === 'date'} title="Quando vuoi partire?" onClose={() => setView(null)}>
        {Array.from({ length: 12 }, (_, off) => {
          const m = seasonMultiplier(city.type, monthNumFromOffset(off));
          const tag = m >= 1.2 ? 'Alta stagione' : m <= 0.85 ? 'Bassa stagione' : 'Media stagione';
          const col = m >= 1.2 ? t.danger : m <= 0.85 ? t.positive : t.warn;
          return <Item key={off} last={off === 11} onPress={() => { tv.set({ monthOffset: off }); setView(null); toast('Periodo impostato: ' + monthLabel(off)); }}><Row><Body>{monthLabel(off)}</Body><Body small color={col}>{tag}</Body></Row></Item>;
        })}
      </Sheet>
      <Sheet visible={view === 'guests'} title="Ospiti e camere" onClose={() => setView(null)}>
        {(['adults', 'children', 'rooms'] as const).map((k) => (
          <Item key={k}><Row><Body>{k === 'adults' ? 'Adulti' : k === 'children' ? 'Bambini' : 'Camere'}</Body>
            <Row gap={14}><Btn small ghost title="−" onPress={() => tv.set({ guests: { ...g, [k]: Math.max(k === 'rooms' ? 1 : 0, g[k] - 1) } })} /><Body bold>{g[k]}</Body><Btn small ghost title="+" onPress={() => tv.set({ guests: { ...g, [k]: g[k] + 1 } })} /></Row></Row></Item>
        ))}
        <Toggle label="Animali al seguito" value={g.pets} onChange={(v) => tv.set({ guests: { ...g, pets: v } })} />
        <Btn style={{ marginTop: 14 }} title="Fatto" onPress={() => setView(null)} />
      </Sheet>
      <Sheet visible={view === 'itinerary' && !!itin} title={`Itinerario · ${itin?.cityName ?? ''}`} onClose={() => setView(null)}>
        {itin && (
          <>
            <Body small muted>{itin.text}</Body>
            <Body small muted style={{ marginTop: 12, marginBottom: 4 }}>Alloggio</Body>
            <Item><Row><Body>{itin.hotel}</Body><Body bold>{formatMoney(itin.price)}/notte</Body></Row></Item>
            {Array.from({ length: itin.days }, (_, d) => <Item key={d}><Body bold>Giorno {d + 1}</Body><Body small muted style={{ marginTop: 4 }}>{itin.acts.join(' · ')}</Body></Item>)}
            <Item style={{ marginTop: 8 }}><Row><Body muted>Soggiorno ({itin.days} notti)</Body><Body bold>{formatMoney(itin.price * itin.days)}</Body></Row></Item>
            <Item><Row><Body muted>Trasporto (a/r)</Body><Body bold>{formatMoney(itin.flight * 2)}</Body></Row></Item>
            <Item last><Row><Body muted>Totale stimato viaggio</Body><Body bold>{formatMoney(itin.tripTotal)}</Body></Row></Item>
            <Body small muted style={{ marginTop: 12 }}>Itinerario simulato: voli/treni, attività e meteo reali richiederebbero l'integrazione con provider veri.</Body>
            <Btn style={{ marginTop: 12 }} title="Aggiungi al Plan" onPress={() => { addVacation({ dest: itin.cityName, month: itin.month, hotel: itin.hotel, price: itin.price, days: itin.days, flight: itin.flight }); setView(null); toast('Vacanza aggiunta al Plan'); }} />
            <Btn small ghost style={{ marginTop: 8 }} title="Salva itinerario" onPress={() => { tv.save({ city: itin.cityName, hotel: itin.hotel, price: itin.price, days: itin.days, tripTotal: itin.tripTotal, month: itin.month }); toast('Itinerario salvato'); }} />
          </>
        )}
      </Sheet>
      <View style={{ height: 1 }}><Text style={{ color: areaColors.lifetravel, fontSize: 1 }}>{' '}</Text></View>
    </Page>
  );
}
