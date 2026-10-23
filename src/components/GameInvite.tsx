import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Mascot } from '@/components/mascot/Mascot';
import { Body, Btn, Card, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { dayKey } from '@/lib/format';
import { EXERCISES } from '@/lib/mindExercises';
import { go } from '@/lib/nav';
import { nextInvite, signalsOf, suggestHuman } from '@/lib/wellbeing';
import { wellbeingInput } from '@/lib/wellbeingData';
import { useMindSpace } from '@/store/mindSpace';
import { usePet } from '@/store/pet';

/**
 * L'app non parte come autoaiuto: solo se nei dati compare un cambiamento, Theia propone con garbo di giocare o di fare insieme un'attività.
 * Per chi non ha mai giocato l'invito è al GIOCO («provalo, c'è una creatura da accudire»), uguale per tutti e senza etichette; chi gioca già riceve un'attività.
 * Sempre: «Non adesso», «Non mostrarmelo più», «Perché lo vedi?».
 */
export function GameInvite() {
  const th = useTheme();
  const inv = useMindSpace((s) => s.inv);
  const { patchInv, shown } = useMindSpace.getState();
  const played = usePet((s) => s.pet.xp > 0 || s.pet.spent.day !== '');
  const [why, setWhy] = useState(false);
  const [hide, setHide] = useState(false);
  const { sig, pick, human } = useMemo(() => {
    try {
      const sig = signalsOf(wellbeingInput());
      return { sig, pick: nextInvite(sig, inv, Date.now()), human: suggestHuman(sig, inv, dayKey()) };
    } catch { return { sig: [], pick: null, human: false }; }
  }, [inv.on, inv.lastAny, inv.muted.length]);
  useEffect(() => { if (pick) shown(pick.id, Date.now(), dayKey()); }, [pick?.id]);
  if (!pick || hide) return null;
  const ex = EXERCISES.find((e) => e.id === pick.exercises[0]);
  return (
    <Card accent={th.accent}>
      <Row gap={12}>
        <Mascot size={56} color={th.accent} expression="curious" animated={false} />
        <View style={{ flex: 1 }}>
          <Body bold>{played ? tl('Ti va di fare qualcosa insieme a Theia?') : tl('Ti va di provare un piccolo gioco?')}</Body>
          <Body small muted>{played ? tl('Ho notato un cambiamento: se ti va, c\'è un\'attività breve da fare insieme. Decidi tu.') : tl('C\'è una creatura da accudire e da veder crescere. Se ti va, prova a giocarci: quando vuoi, senza obblighi.')}</Body>
        </View>
      </Row>
      {why ? <Body small muted style={{ marginTop: 8 }}>{`${tl('Perché lo vedi')}: ${sig.map((s) => tl(s.fact)).join('; ')}. ${tl('Sono solo indizi, non una diagnosi, e restano sul telefono.')}`}</Body> : null}
      {human ? <Body small style={{ marginTop: 8 }}>{tl('Se queste cose durano da un po\' di giorni, può essere utile parlarne con una persona di fiducia o con un professionista. Se stai male, in Svizzera 143, in Europa 112.')}</Body> : null}
      <Row gap={8} style={{ marginTop: 10, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
        <Btn small title={played && ex ? tl(ex.title) : 'Proviamo'} onPress={() => { setHide(true); go('theiaPet', played && ex ? { ex: ex.id } : undefined); }} />
        <Btn small ghost title="Non adesso" onPress={() => { patchInv({ lastAny: Date.now() }); setHide(true); }} />
        <Btn small ghost title="Non mostrarmelo più" onPress={() => { patchInv({ on: false }); setHide(true); }} />
        <Btn small ghost title={why ? 'Nascondi' : 'Perché lo vedi?'} onPress={() => setWhy(!why)} />
      </Row>
    </Card>
  );
}
