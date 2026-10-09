import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Image, Platform, Pressable, Share, View } from 'react-native';
import { Text } from '@/components/T';

import { FinTabs } from '@/components/FinTabs';
import { Body, Btn, Card, Empty, H, Input, Item, Link, Page, Pill, Progress, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { checkDoc, fmtBytes, isImageFile, taxDocFolder, type DocCheck } from '@/lib/docCheck';
import { dayKey, monthNames, weekdayShortDate } from '@/lib/format';
import { persistFile } from '@/lib/chatMedia';
import { Icon } from '@/lib/icons';
import { TAX_DISCLAIMER, taxEventsToAdd, upcomingDeadlines } from '@/lib/taxDeadlines';
import { taxDocOf, useFin, type TaxDocFile } from '@/store/finance';
import { useLife } from '@/store/life';
import { toast } from '@/store/toast';

type ReqItem = { key: string; label: string; group: string };
type Picked = { name: string; uri: string; size?: number; mime?: string };

/** Su web gli URI blob spariscono al ricaricamento: i file piccoli vengono salvati come data URL. */
async function storableUri(f: Picked): Promise<string> {
  if (Platform.OS !== 'web') return persistFile(f.uri, f.name);
  if (f.uri.startsWith('data:') || (f.size ?? 0) > 1024 * 1024) return f.uri;
  try {
    const blob = await (await fetch(f.uri)).blob();
    return await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  } catch { return f.uri; }
}

export default function TaxDecl() {
  const t = useTheme();
  const { tax, setTax, setTaxDoc } = useFin();
  const { addFile, delFile } = useLife();
  const [bankSheet, setBankSheet] = useState(false);
  const [bank, setBank] = useState('');
  const [summary, setSummary] = useState(false);
  const [active, setActive] = useState<ReqItem | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [res, setRes] = useState<DocCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<TaxDocFile | null>(null);

  const deadlines = upcomingDeadlines(dayKey());
  const addDeadlines = () => {
    const life = useLife.getState();
    const add = taxEventsToAdd(deadlines, life.events);
    add.forEach((a) => life.addEvent(a.day, a.ev));
    toast(add.length ? `Aggiunte ${add.length} scadenze al Plan, con promemoria` : 'Le scadenze fiscali sono già nel Plan');
  };

  const persons = tax.married ? ['Titolare', 'Coniuge'] : ['Titolare'];
  const items: ReqItem[] = [];
  monthNames.forEach((m) => persons.forEach((p) => items.push({ key: `ps|${m}|${p}`, label: `Busta paga ${m} · ${p}`, group: 'Buste paga' })));
  tax.banks.forEach((b) => items.push({ key: `bank|${b}`, label: `Estratto conto al 31.12 · ${b}`, group: 'Conti bancari' }));
  items.push({ key: 'doc|salario', label: tax.married ? 'Certificati di salario (Titolare e Coniuge)' : 'Certificato di salario', group: 'Altri documenti' });
  items.push({ key: 'doc|3pillar', label: 'Attestato 3° pilastro', group: 'Altri documenti' });
  items.push({ key: 'doc|cassamalati', label: 'Attestato premi cassa malati', group: 'Altri documenti' });
  items.push({ key: 'doc|ipoteca', label: 'Interessi su mutuo/ipoteca', group: 'Altri documenti' });
  items.push({ key: 'doc|donazioni', label: 'Ricevute donazioni deducibili', group: 'Altri documenti' });
  items.push({ key: 'doc|spesemediche', label: 'Spese mediche non rimborsate', group: 'Altri documenti' });
  if (tax.children) items.push({ key: 'doc|figli', label: 'Spese per figli a carico (asili, rette, ecc.)', group: 'Altri documenti' });

  const groups: Record<string, ReqItem[]> = {};
  items.forEach((it) => { (groups[it.group] = groups[it.group] || []).push(it); });
  const total = items.length, done = items.filter((it) => taxDocOf(tax.docs, it.key)).length;
  const YN = ({ v, on }: { v: boolean; on: (v: boolean) => void }) => <View style={{ flexDirection: 'row' }}><Pill label="Sì" on={v} onPress={() => on(true)} /><Pill label="No" on={!v} onPress={() => on(false)} /></View>;

  const closeSheet = () => { setActive(null); setPicked(null); setRes(null); };
  const open = (it: ReqItem) => { setPicked(null); setRes(null); setActive(it); };
  const evaluate = (it: ReqItem, f: Picked) => { setPicked(f); setRes(checkDoc({ key: it.key, label: it.label, group: it.group }, { name: f.name, size: f.size, mime: f.mime })); };

  async function pickFile() {
    if (!active) return;
    try {
      const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (!r.canceled && r.assets[0]) { const a = r.assets[0]; evaluate(active, { name: a.name, uri: a.uri, size: a.size, mime: a.mimeType }); }
    } catch { toast('Impossibile aprire i file'); }
  }
  async function pickPhoto(camera: boolean) {
    if (!active) return;
    try {
      const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { toast(camera ? 'Serve il permesso della fotocamera' : 'Serve il permesso di accedere alle foto'); return; }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.85 };
      const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (!r.canceled && r.assets[0]) {
        const a = r.assets[0];
        evaluate(active, { name: a.fileName ?? `Foto ${weekdayShortDate().replace('/', '-')}.jpg`, uri: a.uri, size: a.fileSize, mime: a.mimeType });
      }
    } catch { toast('Impossibile aprire le foto'); }
  }
  function photoChoice() {
    if (Platform.OS === 'web') { pickPhoto(false); return; }
    Alert.alert('Foto del documento', undefined, [{ text: 'Scatta una foto', onPress: () => pickPhoto(true) }, { text: 'Scegli dalla libreria', onPress: () => pickPhoto(false) }, { text: 'Annulla', style: 'cancel' }]);
  }

  function dropDrive(uri?: string) {
    if (!uri) return;
    useLife.getState().drive.filter((f) => f.uri === uri).forEach((f) => delFile(f.id));
  }
  async function confirm() {
    if (!active || !picked || !res || res.status === 'invalido') return;
    setBusy(true);
    try {
      const old = taxDocOf(tax.docs, active.key);
      const uri = await storableUri(picked);
      if (old) dropDrive(old.uri);
      const rec: TaxDocFile = { name: picked.name, uri, size: picked.size, mime: picked.mime, checkedAt: new Date().toISOString(), status: res.status === 'ok' ? 'ok' : 'dubbio' };
      setTaxDoc(active.key, rec);
      if (!useLife.getState().drive.some((f) => f.uri === uri)) addFile({ n: picked.name, s: fmtBytes(picked.size) || '—', folder: taxDocFolder(active.key), date: weekdayShortDate(), uri });
      toast('Documento confermato e salvato in LifeDrive');
      closeSheet();
    } finally { setBusy(false); }
  }
  function remove(it: ReqItem) {
    const old = taxDocOf(tax.docs, it.key);
    if (old) dropDrive(old.uri);
    setTaxDoc(it.key, null);
    toast('Documento rimosso');
  }
  function openFile(f: TaxDocFile) {
    if (isImageFile({ name: f.name, mime: f.mime })) { setView(f); return; }
    if (Platform.OS === 'web') { (globalThis as any).open?.(f.uri, '_blank'); return; }
    Share.share({ message: f.name, url: f.uri }).catch(() => toast('Impossibile aprire il file'));
  }

  const tone = (st: DocCheck['status']) => (st === 'ok' ? t.positive : st === 'dubbio' ? t.warn : t.danger);
  const activeRec = active ? taxDocOf(tax.docs, active.key) : undefined;

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
        <Row><H>Conti bancari</H><Btn small ghost icon="plus" title="Banca" onPress={() => setBankSheet(true)} /></Row>
        {tax.banks.length === 0 ? <Empty text="Nessuna banca aggiunta." /> : tax.banks.map((b) => <Item key={b}><Row><Body>{b}</Body><Link danger onPress={() => setTax({ banks: tax.banks.filter((x) => x !== b) })}>rimuovi</Link></Row></Item>)}
      </Card>
      <Card>
        <Row><H>Documenti richiesti</H><Body small muted>{done}/{total}</Body></Row>
        <Progress value={total ? (done / total) * 100 : 0} />
        <Body small muted style={{ marginTop: 8 }}>Tocca un documento per caricare il file: si spunta solo dopo il controllo e la tua conferma.</Body>
        {Object.keys(groups).map((g) => (
          <View key={g}>
            <Body small muted style={{ marginTop: 12, marginBottom: 4 }}>{g}</Body>
            {groups[g].map((it) => {
              const rec = taxDocOf(tax.docs, it.key);
              const legacy = !rec && (tax.docs as Record<string, unknown>)[it.key] === true;
              const checked = !!rec;
              return (
                <View key={it.key} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.item }}>
                  <Pressable onPress={() => (rec ? openFile(rec) : open(it))} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityRole="checkbox" accessibilityLabel={it.label} accessibilityState={{ checked }}>
                    <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: checked ? t.positive : t.muted, backgroundColor: checked ? t.positive : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{checked && <Icon name="check" size={14} color={t.bg} stroke={3} />}</View>
                    <View style={{ flex: 1 }}>
                      <Body>{it.label}</Body>
                      {legacy ? <Body small color={t.warn}>Da ricaricare: serve il file</Body> : null}
                    </View>
                    {!checked && <Icon name="paperclip" size={18} color={t.muted} stroke={1.9} />}
                  </Pressable>
                  {rec ? (
                    <View style={{ marginLeft: 32, marginTop: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Icon name={isImageFile({ name: rec.name, mime: rec.mime }) ? 'image' : 'file'} size={15} color={t.muted} stroke={1.9} />
                        <Body small muted numberOfLines={1} style={{ flexShrink: 1 }}>{rec.name}{rec.size ? ` · ${fmtBytes(rec.size)}` : ''}</Body>
                        {rec.status === 'dubbio' ? <Icon name="alert" size={14} color={t.warn} stroke={2} /> : null}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                        <Btn small ghost icon="eye" title="Vedi" onPress={() => openFile(rec)} />
                        <Btn small ghost icon="repeat" title="Sostituisci" onPress={() => open(it)} />
                        <Btn small ghost danger icon="trash" title="Rimuovi" onPress={() => remove(it)} />
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </Card>
      <Card>
        <H>Scadenze fiscali</H>
        <Body small color={t.warn} style={{ marginVertical: 6 }}>{TAX_DISCLAIMER}</Body>
        {deadlines.map((d, i) => (
          <Item key={d.id} last={i === deadlines.length - 1}>
            <Body bold>{d.day.slice(8)}.{d.day.slice(5, 7)}.{d.day.slice(0, 4)} · {d.title}</Body>
            <Body small muted style={{ marginTop: 2 }}>{d.note}</Body>
          </Item>
        ))}
        <Btn style={{ marginTop: 12 }} icon="calendar" title="Aggiungi le scadenze fiscali al Plan" onPress={addDeadlines} />
        <Body small muted style={{ marginTop: 6 }}>Vengono inserite come impegni alle 09:00 con promemoria, senza duplicati.</Body>
      </Card>
      <Btn style={{ marginVertical: 6 }} title="Genera dichiarazione" onPress={() => setSummary(true)} />

      <Sheet visible={!!active} title={active ? `Carica: ${active.label}` : ''} onClose={closeSheet}>
        {active ? (
          <>
            {activeRec && !picked ? <Body small muted style={{ marginBottom: 10 }}>File attuale: {activeRec.name}. Caricandone uno nuovo lo sostituirai.</Body> : null}
            <View style={{ gap: 8 }}>
              <Btn icon="file" title="Scegli file" onPress={pickFile} />
              <Btn ghost icon="camera" title="Scatta/scegli foto" onPress={photoChoice} />
            </View>
            <Body small muted style={{ marginTop: 8 }}>Formati ammessi: PDF, JPG, PNG, HEIC, XLSX, CSV, DOCX.</Body>
            {picked && res ? (
              <View style={{ marginTop: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, backgroundColor: t.input }}>
                  {isImageFile(picked) ? <Image source={{ uri: picked.uri }} accessibilityLabel="Anteprima" style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: t.item }} resizeMode="cover" /> : <View style={{ width: 64, height: 64, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: t.item }}><Icon name="file" size={28} color={t.muted} stroke={1.8} /></View>}
                  <View style={{ flex: 1 }}>
                    <Body numberOfLines={2}>{picked.name}</Body>
                    <Body small muted>{fmtBytes(picked.size) || 'Dimensione non disponibile'}</Body>
                  </View>
                </View>
                <View style={{ marginTop: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: tone(res.status), backgroundColor: tone(res.status) + '1a' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name={res.status === 'ok' ? 'check' : res.status === 'dubbio' ? 'alert' : 'x'} size={18} color={tone(res.status)} stroke={2.4} />
                    <Body bold color={tone(res.status)} style={{ flex: 1 }}>{res.title}</Body>
                  </View>
                  {res.details.map((d, i) => <Body key={i} small muted style={{ marginTop: 4 }}>{d}</Body>)}
                </View>
                {res.status === 'invalido' ? (
                  <Body small color={t.danger} style={{ marginTop: 10 }}>Scegli un altro file per poter confermare.</Body>
                ) : (
                  <Btn style={{ marginTop: 12 }} icon="check" disabled={busy} title="Conferma: è il documento richiesto" onPress={confirm} />
                )}
              </View>
            ) : null}
          </>
        ) : null}
      </Sheet>
      <Sheet visible={!!view} title={view?.name ?? ''} onClose={() => setView(null)}>
        {view ? <Image source={{ uri: view.uri }} accessibilityLabel="Documento" style={{ width: '100%', aspectRatio: 0.75, borderRadius: 12, backgroundColor: t.input }} resizeMode="contain" /> : null}
      </Sheet>
      <Sheet visible={bankSheet} title="Aggiungi banca" onClose={() => setBankSheet(false)}>
        <Input placeholder="Nome banca…" value={bank} onChangeText={setBank} />
        <Btn title="Aggiungi" onPress={() => { const n = bank.trim(); if (n && !tax.banks.includes(n)) setTax({ banks: [...tax.banks, n] }); setBank(''); setBankSheet(false); toast('Banca aggiunta'); }} />
      </Sheet>
      <Sheet visible={summary} title="Dichiarazione generata" onClose={() => setSummary(false)}>
        <Body>Situazione: {tax.married ? 'coniugato/a' : 'non coniugato/a'}{tax.children ? ', con figli a carico' : ''}.</Body>
        <Body style={{ marginTop: 8 }}>Documenti caricati e confermati: <Text style={{ fontWeight: '700' }}>{done}/{total}</Text>.</Body>
        <Body small muted style={{ marginTop: 8 }}>LifePilot prepara qui un riepilogo dei documenti raccolti per la dichiarazione fiscale svizzera. Un file compilato e conforme al tuo Cantone richiede l'integrazione con i moduli ufficiali (es. eTax) e la verifica di un fiduciario: non viene ancora generato.</Body>
        {done < total ? <Body small color={t.warn} style={{ marginTop: 8 }}>Mancano ancora {total - done} documenti per una dichiarazione completa.</Body> : <Body small color={t.positive} style={{ marginTop: 8 }}>Tutti i documenti risultano caricati</Body>}
      </Sheet>
    </Page>
  );
}
