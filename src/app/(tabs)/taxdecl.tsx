import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { FinTabs } from '@/components/FinTabs';
import { Body, Btn, Card, Empty, H, Input, Item, Link, Page, Pill, Progress, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { monthNames } from '@/lib/format';
import { useFin } from '@/store/finance';
import { toast } from '@/store/toast';

export default function TaxDecl() {
  const t = useTheme();
  const { tax, setTax, toggleTaxDoc } = useFin();
  const [bankSheet, setBankSheet] = useState(false);
  const [bank, setBank] = useState('');
  const [summary, setSummary] = useState(false);

  const persons = tax.married ? ['Titolare', 'Coniuge'] : ['Titolare'];
  const items: { key: string; label: string; group: string }[] = [];
  monthNames.forEach((m) => persons.forEach((p) => items.push({ key: `ps|${m}|${p}`, label: `Busta paga ${m} · ${p}`, group: 'Buste paga' })));
  tax.banks.forEach((b) => items.push({ key: `bank|${b}`, label: `Estratto conto al 31.12 · ${b}`, group: 'Conti bancari' }));
  items.push({ key: 'doc|salario', label: tax.married ? 'Certificati di salario (Titolare e Coniuge)' : 'Certificato di salario', group: 'Altri documenti' });
  items.push({ key: 'doc|3pillar', label: 'Attestato 3° pilastro', group: 'Altri documenti' });
  items.push({ key: 'doc|cassamalati', label: 'Attestato premi cassa malati', group: 'Altri documenti' });
  items.push({ key: 'doc|ipoteca', label: 'Interessi su mutuo/ipoteca', group: 'Altri documenti' });
  items.push({ key: 'doc|donazioni', label: 'Ricevute donazioni deducibili', group: 'Altri documenti' });
  items.push({ key: 'doc|spesemediche', label: 'Spese mediche non rimborsate', group: 'Altri documenti' });
  if (tax.children) items.push({ key: 'doc|figli', label: 'Spese per figli a carico (asili, rette, ecc.)', group: 'Altri documenti' });

  const groups: Record<string, typeof items> = {};
  items.forEach((it) => { (groups[it.group] = groups[it.group] || []).push(it); });
  const total = items.length, done = items.filter((it) => tax.docs[it.key]).length;
  const YN = ({ v, on }: { v: boolean; on: (v: boolean) => void }) => <View style={{ flexDirection: 'row' }}><Pill label="Sì" on={v} onPress={() => on(true)} /><Pill label="No" on={!v} onPress={() => on(false)} /></View>;

  return (
    <Page id="taxdecl" title="Dichiarazione fiscale" back>
      <Body muted style={{ marginBottom: 6 }}>Svizzera · anno fiscale {new Date().getFullYear() - 1}</Body>
      <FinTabs current="taxdecl" />
      <Card>
        <H>Situazione</H>
        <Row><Body>Coniugato/a</Body><YN v={tax.married} on={(v) => { setTax({ married: v }); toast(v ? 'Coniugato/a' : 'Non coniugato/a'); }} /></Row>
        <Row style={{ marginTop: 10 }}><Body>Figli a carico</Body><YN v={tax.children} on={(v) => setTax({ children: v })} /></Row>
      </Card>
      <Card>
        <Row><H>Conti bancari</H><Btn small ghost title="+ Banca" onPress={() => setBankSheet(true)} /></Row>
        {tax.banks.length === 0 ? <Empty text="Nessuna banca aggiunta." /> : tax.banks.map((b) => <Item key={b}><Row><Body>{b}</Body><Link danger onPress={() => setTax({ banks: tax.banks.filter((x) => x !== b) })}>rimuovi</Link></Row></Item>)}
      </Card>
      <Card>
        <Row><H>Documenti richiesti</H><Body small muted>{done}/{total}</Body></Row>
        <Progress value={total ? (done / total) * 100 : 0} />
        {Object.keys(groups).map((g) => (
          <View key={g}>
            <Body small muted style={{ marginTop: 12, marginBottom: 4 }}>{g}</Body>
            {groups[g].map((it) => {
              const checked = !!tax.docs[it.key];
              return (
                <Pressable key={it.key} onPress={() => toggleTaxDoc(it.key, !checked)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.item }} accessibilityRole="checkbox" accessibilityState={{ checked }}>
                  <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: checked ? t.positive : t.muted, backgroundColor: checked ? t.positive : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{checked && <Text style={{ color: t.bg, fontWeight: '800', fontSize: 13 }}>✓</Text>}</View>
                  <Body style={{ flex: 1, textDecorationLine: checked ? 'line-through' : 'none', opacity: checked ? 0.45 : 1 }}>{it.label}</Body>
                </Pressable>
              );
            })}
          </View>
        ))}
      </Card>
      <Btn style={{ marginVertical: 6 }} title="Genera dichiarazione" onPress={() => setSummary(true)} />

      <Sheet visible={bankSheet} title="Aggiungi banca" onClose={() => setBankSheet(false)}>
        <Input placeholder="Nome banca…" value={bank} onChangeText={setBank} />
        <Btn title="Aggiungi" onPress={() => { const n = bank.trim(); if (n && !tax.banks.includes(n)) setTax({ banks: [...tax.banks, n] }); setBank(''); setBankSheet(false); toast('Banca aggiunta'); }} />
      </Sheet>
      <Sheet visible={summary} title="Dichiarazione generata" onClose={() => setSummary(false)}>
        <Body>Situazione: {tax.married ? 'coniugato/a' : 'non coniugato/a'}{tax.children ? ', con figli a carico' : ''}.</Body>
        <Body style={{ marginTop: 8 }}>Documenti caricati: <Text style={{ fontWeight: '700' }}>{done}/{total}</Text>.</Body>
        <Body small muted style={{ marginTop: 8 }}>LifePilot prepara qui un riepilogo dei documenti raccolti per la dichiarazione fiscale svizzera. Un file compilato e conforme al tuo Cantone richiede l'integrazione con i moduli ufficiali (es. eTax) e la verifica di un fiduciario: non viene ancora generato.</Body>
        {done < total ? <Body small color={t.warn} style={{ marginTop: 8 }}>Mancano ancora {total - done} documenti per una dichiarazione completa.</Body> : <Body small color={t.positive} style={{ marginTop: 8 }}>Tutti i documenti risultano caricati ✓</Body>}
      </Sheet>
    </Page>
  );
}
