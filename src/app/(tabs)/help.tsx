import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Btn, Card, Input, Page, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { go } from '@/lib/nav';
import { HELP_TOPICS, helpAreas, searchHelp, type HelpTopic } from '@/lib/helpKb';
import { useTour } from '@/store/tour';

const EXAMPLES = ['A cosa serve il LifePoint giornaliero?', 'Come pago con il QR?', 'Come uso il timer dei task?', 'Come funzionano le recensioni?', 'Come condivido un file?', 'Cos\'è Theia?'];

function Answer({ t: topic, strong }: { t: HelpTopic; strong?: boolean }) {
  const t = useTheme();
  const openIt = () => { if (topic.page) go(topic.page, topic.params); };
  const tutorial = () => { if (!topic.page || !topic.tutorial) return; go(topic.page, topic.params); setTimeout(() => useTour.getState().start(topic.tutorial!), 500); };
  return (
    <Card>
      <Text style={{ color: t.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' }}>{topic.area}</Text>
      <Text style={{ color: t.text, fontSize: strong ? 20 : 17, fontWeight: '800', marginTop: 2 }}>{topic.title}</Text>
      <Text style={{ color: t.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 12 }}>A cosa serve</Text>
      <Body style={{ marginTop: 3 }}>{topic.what}</Body>
      <Text style={{ color: t.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 12 }}>Come si usa</Text>
      {topic.how.map((h) => <Row key={h} style={{ alignItems: 'flex-start', justifyContent: 'flex-start', marginTop: 4 }} gap={8}><Text style={{ color: t.accent, fontWeight: '800' }}>•</Text><Body small style={{ flex: 1 }}>{h}</Body></Row>)}
      <Row style={{ marginTop: 12 }} gap={8}>
        {topic.page ? <Btn small style={{ flex: 1 }} title="Aprila" onPress={openIt} /> : null}
        {topic.tutorial ? <Btn small ghost style={{ flex: 1 }} title="Fai il tutorial" onPress={tutorial} /> : null}
      </Row>
    </Card>
  );
}

/** Aiuto e domande: chiedi qualsiasi cosa e Theia risponde a cosa serve e come si usa ogni funzione (risposte sul telefono, nessuna AI esterna). */
export default function Help() {
  const t = useTheme();
  const [q, setQ] = useState('');
  const [asked, setAsked] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const results = asked ? searchHelp(asked, 3) : [];
  const ask = (text: string) => { setQ(text); setAsked(text.trim()); };
  return (
    <Page id="help" back title="Aiuto e domande">
      <Body muted>Chiedi a Theia a cosa serve e come si usa qualsiasi funzione dell'app. Rispondo qui, sul tuo telefono.</Body>
      <Row style={{ marginTop: 12 }} gap={8}>
        <Input flex={1} placeholder="Es. come funzionano i LifePoints?" value={q} onChangeText={setQ} returnKeyType="search" onSubmitEditing={() => setAsked(q.trim())} />
        <Btn small title="Chiedi" onPress={() => setAsked(q.trim())} />
      </Row>
      {!asked ? (
        <View style={{ marginTop: 6 }}>
          <Text style={{ color: t.muted, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>Domande frequenti</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {EXAMPLES.map((e) => <Pressable key={e} onPress={() => ask(e)} accessibilityRole="button" style={{ backgroundColor: t.chip, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 }}><Text style={{ color: t.text, fontSize: 13.5, fontWeight: '600' }}>{e}</Text></Pressable>)}
          </View>
        </View>
      ) : results.length === 0 ? (
        <Card style={{ marginTop: 12 }}>
          <Body bold>Non ho trovato una risposta precisa.</Body>
          <Body small muted style={{ marginTop: 4 }}>Prova con altre parole (per esempio «pagamenti», «task», «recensioni») oppure scorri gli argomenti qui sotto.</Body>
          <Btn small ghost style={{ marginTop: 10 }} title="Chiedi a Theia nella chat" onPress={() => go('ai')} />
        </Card>
      ) : (
        <View style={{ marginTop: 8 }}>
          <Answer t={results[0].topic} strong />
          {results.length > 1 && <Text style={{ color: t.muted, fontSize: 12, fontWeight: '700', marginTop: 8 }}>Potrebbe interessarti anche</Text>}
          {results.slice(1).map((r) => <Answer key={r.topic.id} t={r.topic} />)}
        </View>
      )}

      <Text style={{ color: t.text, fontSize: 17, fontWeight: '800', marginTop: 18, marginBottom: 8 }}>Tutti gli argomenti</Text>
      {helpAreas().map((area) => (
        <Card key={area} style={{ paddingVertical: 4 }}>
          <Pressable onPress={() => setOpen(open === area ? null : area)} accessibilityRole="button" accessibilityState={{ expanded: open === area }} style={{ paddingVertical: 12 }}>
            <Row><Text style={{ color: t.text, fontSize: 15.5, fontWeight: '700' }}>{area}</Text><Text style={{ color: t.muted, fontSize: 12.5 }}>{HELP_TOPICS.filter((x) => x.area === area).length}</Text></Row>
          </Pressable>
          {open === area && HELP_TOPICS.filter((x) => x.area === area).map((x) => (
            <Pressable key={x.id} onPress={() => { setOpen(null); ask(x.title); }} accessibilityRole="button" style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: t.border }}>
              <Text style={{ color: t.text, fontSize: 14.5, fontWeight: '600' }}>{x.title}</Text>
              <Text style={{ color: t.muted, fontSize: 12.5 }} numberOfLines={2}>{x.what}</Text>
            </Pressable>
          ))}
        </Card>
      ))}
    </Page>
  );
}
