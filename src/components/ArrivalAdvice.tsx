import { useState } from 'react';
import { Linking, View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Btn, Pill } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { adviceText, arrivalPlan, BUFFER, pickKinds, type Interest } from '@/lib/arrival';
import { geocode, mapsUrl, nearby, routeMinutes, type Poi } from '@/lib/nearby';
import { travelMinutes } from '@/lib/places';
import { INTEREST_CATALOG, useInterests } from '@/store/interests';

/** Tragitto verso il luogo dell'impegno + cosa fare se si arriva molto prima, in base agli interessi. */
export function ArrivalAdvice({ place, time, from, today = true }: { place: string; time: string; from?: string; today?: boolean }) {
  const t = useTheme();
  const { selected, homeCity } = useInterests();
  const origin = from || homeCity;
  const [minutes, setMinutes] = useState<number | null>(origin ? travelMinutes(origin, place) || null : null);
  const [pois, setPois] = useState<Poi[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  if (!place.trim()) return null;

  const now = new Date();
  const [hh, mm] = time.split(':').map(Number);
  const nowMin = today ? now.getHours() * 60 + now.getMinutes() : hh * 60 + mm - (minutes ?? 0) - BUFFER;
  const a = minutes != null ? arrivalPlan(time, minutes, nowMin) : null;
  const kinds = a ? pickKinds(selected as Interest[], a.wait) : [];
  const tags = INTEREST_CATALOG.filter((i) => selected.includes(i.id)).flatMap((i) => i.osm);

  const online = async () => {
    setBusy(true); setNote('');
    try {
      const dest = await geocode(place);
      if (!dest) { setNote('Luogo non trovato: controlla il nome o connettiti a internet.'); return; }
      const src = origin ? await geocode(origin) : null;
      if (src) { const m = await routeMinutes(src, dest); if (m != null) setMinutes(m); }
      const useTags = tags.length ? tags : ['amenity=cafe'];
      setPois(await nearby(dest, useTags));
      if (!src) setNote('Imposta la tua città in Profilo > Interessi per calcolare il tragitto.');
    } finally { setBusy(false); }
  };

  return (
    <View style={{ marginTop: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: t.border, backgroundColor: t.card }}>
      <Text style={{ color: t.text, fontWeight: '800', fontSize: 14 }}>Arrivo a {place}</Text>
      {a ? adviceText(place, a, kinds).map((l) => <Body key={l} small muted style={{ marginTop: 4 }}>{l}</Body>)
        : <Body small muted style={{ marginTop: 4 }}>{origin ? 'Tragitto non stimabile offline: calcolalo con la mappa.' : 'Imposta la tua città (Profilo > Interessi) per stimare il tragitto.'}</Body>}
      {pois.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <Text style={{ color: t.muted, fontSize: 12, fontWeight: '700' }}>Vicino a {place}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {pois.map((p) => <Pill key={p.name} icon="location" label={`${p.name} · ${p.meters} m`} onPress={() => void Linking.openURL(mapsUrl(p))} />)}
          </View>
        </View>
      )}
      {note ? <Body small muted style={{ marginTop: 6 }}>{note}</Body> : null}
      <Btn small ghost title={busy ? 'Calcolo…' : 'Calcola con la mappa e cerca nei dintorni'} icon="compass" disabled={busy} style={{ marginTop: 8 }} onPress={() => void online()} />
    </View>
  );
}
