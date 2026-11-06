import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useToday } from '@/components/casa/shared';
import { FinTabs } from '@/components/FinTabs';
import { Text } from '@/components/T';
import { Body, Btn, Card, Empty, H, Page, Row, Sheet } from '@/components/ui';
import { WarrantyCard } from '@/components/warranty/WarrantyCard';
import { WarrantyEditor } from '@/components/warranty/WarrantyEditor';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { alertT } from '@/lib/alert';
import { readWarranty } from '@/lib/warrantyAi';
import { fromFile, fromPhoto, scanDocument, type Captured } from '@/lib/warrantyScan';
import { purchaseTitle, reminders, sortPurchases, summary, type Purchase } from '@/lib/warranty';
import { fmtBytes } from '@/lib/docCheck';
import { useLife } from '@/store/life';
import { toast } from '@/store/toast';
import { useWarranty } from '@/store/warranty';
import { File } from 'expo-file-system';

const uid = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Garanzie: scansioni la fattura (o fai una foto), Theia legge i dati e la garanzia si segna da sola, con il PDF e il conto alla rovescia. */
export default function Warranties() {
  const th = useTheme(); const today = useToday(); const items = useWarranty((s) => s.items);
  const [pick, setPick] = useState(false); const [busy, setBusy] = useState(false); const [draft, setDraft] = useState<{ p: Purchase; preview?: string; notice?: string; isNew: boolean } | null>(null);
  const list = useMemo(() => sortPurchases(items, today), [items, today]); const sum = useMemo(() => summary(items, today), [items, today]);

  const process = async (c: Captured | null) => {
    if (!c) return; setBusy(true);
    const base: Purchase = { id: uid(), store: '', date: '', currency: 'EUR', products: [], pages: c.pages, ...(c.pdf ? { pdf: c.pdf } : {}), source: c.source, createdAt: today };
    const r = await readWarranty(c, today); setBusy(false);
    if (r.ok) setDraft({ p: { ...base, store: r.data.store, date: r.data.date ?? '', currency: r.data.currency, ...(r.data.total != null ? { total: r.data.total } : {}), products: r.data.products.map((x, i) => ({ ...x, id: `${base.id}-${i}` })) }, preview: c.pages[0], notice: tl('Ecco cosa ho letto: controlla e correggi.'), isNew: true });
    else { toast(r.message); setDraft({ p: base, preview: c.pages[0], isNew: true }); }
  };
  const save = (p: Purchase) => {
    const isNew = draft?.isNew; if (isNew) useWarranty.getState().add(p); else useWarranty.getState().update(p);
    if (isNew && p.pdf) { let size = ''; try { size = fmtBytes(new File(p.pdf).size ?? 0); } catch { /* dimensione non nota */ } useLife.getState().addFile({ n: `Garanzia - ${purchaseTitle(p)}.pdf`.slice(0, 80), s: size, folder: 'Ricevute', date: today, uri: p.pdf, tag: 'Garanzie' }); }
    for (const r of reminders(p, today)) { const has = (useLife.getState().events[r.day] ?? []).some((e) => e.title === r.title); if (!has) useLife.getState().addEvent(r.day, { time: '09:00', title: r.title, dur: 15, reminder: true }); }
    setDraft(null); toast(isNew ? 'Garanzia salvata: la trovi qui e la fattura in LifeDrive' : 'Garanzia aggiornata');
  };
  const remove = (p: Purchase) => alertT('Eliminare questa garanzia?', purchaseTitle(p), [{ text: 'Annulla', style: 'cancel' }, { text: 'Elimina', style: 'destructive', onPress: () => useWarranty.getState().remove(p.id) }]);
  const choose = (f: () => Promise<Captured | null>) => { setPick(false); void f().then(process); };

  return (
    <Page id="warranties" title="Garanzie" back>
      <FinTabs current="warranties" />
      <Card>
        <Row><Stat l="Attive" v={sum.active} c="#22c55e" /><Stat l="In scadenza" v={sum.soon} c="#f59e0b" /><Stat l="Scadute" v={sum.expired} c={sum.expired ? th.danger : undefined} /></Row>
        <Body small muted style={{ marginTop: 8 }}>{sum.products ? tl('{0} prodotti in elenco. Ti avviso nel Plan un mese prima della scadenza.', sum.products) : tl('Scansiona una fattura o uno scontrino: Theia legge prodotti, data e durata della garanzia e li segna per te.')}</Body>
        <Row style={{ marginTop: 12 }}><Btn icon="camera" disabled={busy} title={busy ? 'Theia legge…' : 'Scansiona'} onPress={() => { void scanDocument().then(process); }} /><Btn ghost disabled={busy} title="Foto o file" onPress={() => setPick(true)} /></Row>
      </Card>
      {list.length === 0 ? <Card><H>Le tue garanzie</H><Empty text="Ancora nessuna garanzia. Scansiona la fattura di un elettrodomestico, di un telefono o di un mobile: la trovi qui con il conto alla rovescia." /></Card> : list.map((p) => <WarrantyCard key={p.id} p={p} today={today} onEdit={() => setDraft({ p, preview: p.pages[0], isNew: false })} onDelete={() => remove(p)} />)}
      <Body small muted>{tl('La scansione trova i bordi del foglio e lo raddrizza. Il PDF resta sul tuo telefono e in LifeDrive (cartella Ricevute). Le foto si mandano all\'AI solo con il tuo permesso e Theia può sbagliare: controlla sempre i dati.')}</Body>

      <Sheet visible={pick} title="Aggiungi un documento" onClose={() => setPick(false)}>
        <View style={{ gap: 8 }}>
          <Btn icon="camera" title="Scatta una foto" onPress={() => choose(() => fromPhoto('camera'))} />
          <Btn ghost icon="image" title="Scegli dalla galleria" onPress={() => choose(() => fromPhoto('gallery'))} />
          <Btn ghost icon="file" title="Scegli un PDF o un file" onPress={() => choose(fromFile)} />
          <Btn ghost icon="edit" title="Inserisci a mano" onPress={() => { setPick(false); setDraft({ p: { id: uid(), store: '', date: '', currency: 'EUR', products: [], pages: [], source: 'manuale', createdAt: today }, isNew: true }); }} />
        </View>
        <Body small muted style={{ marginTop: 10 }}>{tl('Una foto diventa un PDF di una pagina, così la fattura si conserva sempre allo stesso modo.')}</Body>
      </Sheet>
      {draft ? <WarrantyEditor key={draft.p.id} purchase={draft.p} preview={draft.preview} notice={draft.notice} onSave={save} onClose={() => setDraft(null)} /> : null}
    </Page>
  );
}

function Stat({ l, v, c }: { l: string; v: number; c?: string }) {
  const th = useTheme();
  return <View style={{ flex: 1 }}><Text style={{ color: c ?? th.text, fontSize: 26, fontWeight: '800' }}>{v}</Text><Body small muted>{tl(l)}</Body></View>;
}
