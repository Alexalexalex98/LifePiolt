import { useState } from 'react';
import { View } from 'react-native';

import { DashBackground } from '@/components/dash/DashBackground';
import { DashGrid } from '@/components/dash/DashGrid';
import { DashData } from '@/components/dash/data';
import { WBY } from '@/components/dash/registry';
import { AddWidgetSheet, BackgroundSheet, OptionsSheet } from '@/components/dash/Sheets';
import { Body, Btn, Card, H, Page, Pill, Row } from '@/components/ui';
import { t as tl } from '@/i18n/core';
import { parseShape } from '@/lib/dash/grid';
import { go } from '@/lib/nav';
import { pageScroll } from '@/lib/pageScroll';
import { useApp } from '@/store/app';
import { useDash } from '@/store/dash';

const SUGGEST = ['mood', 'agenda', 'water', 'tip'];

/** La Dashboard: una pagina di widget scelti da te, in una griglia a 4 colonne, con le foto che vuoi come sfondo. */
export default function Dashboard() {
  const account = useApp((s) => s.account);
  const items = useDash((s) => s.items);
  const add = useDash((s) => s.add);
  const reset = useDash((s) => s.reset);
  const [edit, setEdit] = useState(false);
  const [adding, setAdding] = useState(false);
  const [bg, setBg] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera';
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Page id="index" background={<DashBackground />}>
      <DashData>
        <View style={{ marginTop: 6 }}>
          <Row>
            <View style={{ flex: 1 }}>
              <H style={{ marginBottom: 0 }}>{`${tl(greet)}${account.name ? `, ${account.name.split(' ')[0]}` : ''}`}</H>
              <Body small muted style={{ textTransform: 'capitalize' }}>{date}</Body>
            </View>
            {edit ? <Btn small title="Fine" onPress={() => setEdit(false)} /> : <Row gap={8}><Btn small ghost icon="edit" title="Modifica" onPress={() => setEdit(true)} /><Btn small icon="plus" title="Widget" onPress={() => setAdding(true)} /></Row>}
          </Row>
          {edit ? (
            <View style={{ marginTop: 10, gap: 8 }}>
              <Body small muted>Tieni premuto un widget e trascinalo dove vuoi. Il pulsante in basso a destra cambia la forma, la X lo toglie. I puntini sono i quadratini.</Body>
              <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>
                <Btn small icon="plus" title="Aggiungi" onPress={() => setAdding(true)} />
                <Btn small ghost icon="image" title="Sfondo" onPress={() => setBg(true)} />
                <Btn small ghost title="Dashboard classica" onPress={() => go('dashboardClassic')} />
                {items.length ? <Btn small ghost danger icon="trash" title="Svuota" onPress={() => reset()} /> : null}
              </Row>
            </View>
          ) : null}
        </View>

        <View style={{ marginTop: 14 }}>
          {items.length === 0 && !edit ? (
            <Card>
              <H>La tua Dashboard è vuota</H>
              <Body small muted>Aggiungi i widget che ti interessano: umore, soldi, allenamento, notizie, titoli di borsa e tanto altro. Li metti dove vuoi, grandi quanto vuoi.</Body>
              <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 10 }} gap={8}>
                {SUGGEST.map((k) => <Pill key={k} label={WBY[k].title} onPress={() => add(k, parseShape(WBY[k].def))} />)}
              </Row>
              <Btn style={{ marginTop: 12 }} icon="plus" title="Aggiungi un widget" onPress={() => setAdding(true)} />
            </Card>
          ) : null}
          <DashGrid edit={edit} onEnterEdit={() => setEdit(true)} onSelect={setSel} />
        </View>
        {items.length > 0 && !edit ? <Btn style={{ marginTop: 16 }} ghost icon="plus" title="Aggiungi un widget" onPress={() => setAdding(true)} /> : null}

        <AddWidgetSheet visible={adding} onClose={() => setAdding(false)} onAdded={(id) => { setEdit(true); const it = useDash.getState().items.find((x) => x.id === id); if (it) setTimeout(() => pageScroll.scrollTo(Math.max(0, 300 + it.y * 92 - 220)), 250); }} />
        <OptionsSheet id={sel} onClose={() => setSel(null)} />
        <BackgroundSheet visible={bg} onClose={() => setBg(false)} onReopen={() => setBg(true)} />
      </DashData>
    </Page>
  );
}
