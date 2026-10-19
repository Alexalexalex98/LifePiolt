import * as DocumentPicker from 'expo-document-picker';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Body, Btn, Input, Item, Row, Select, Sheet, Toggle } from '@/components/ui';
import { insightsOf } from '@/lib/statementInsights';
import { defaultBudget } from '@/store/finance';
import { alertT } from '@/lib/alert';
import { go } from '@/lib/nav';
import { AiNote } from '@/components/AiNote';
import { aiChat, aiReadFiles, aiServerConfigured, AiServerError } from '@/lib/aiServer';
import { readBytes, readLocally } from '@/lib/bills/files';
import { extractPdfLayout } from '@/lib/bills/pdfText';
import { askSend, logSend } from '@/lib/aiConsent';
import { STATEMENT_PDF_PROMPT, chunkLines, parseTableStatement, movesToCsv, parseStatementReply, statementChunkPrompt, statementLines, type StatementMove } from '@/lib/statementPdf';
import { announceStatement } from '@/lib/statementReport';
import { useTheme } from '@/hooks/use-theme';
import { movementLabel, parseCsv, splitDuplicates, toAppDate, monthLabelOfIso, type CsvRow } from '@/lib/csvImport';
import { readPickedText } from '@/lib/readPicked';
import { useFin } from '@/store/finance';
import { showUndoToast, toast } from '@/store/toast';
import { formatMoney } from '@/i18n/format';

/** Importa movimenti da un CSV/estratto conto: scelta del file, anteprima con categorie modificabili, conferma. */
export function CsvImportSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const cats = useFin((s) => s.categories);
  const catNames = useMemo(() => cats.map((c) => c.n), [cats]);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<CsvRow[] | null>(null);
  const [off, setOff] = useState<Record<number, boolean>>({});
  const [info, setInfo] = useState<string[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [dups, setDups] = useState(0);
  const [dupRows, setDupRows] = useState<CsvRow[]>([]);
  /* l'estratto conto ha la precedenza: di base sostituisce i movimenti attuali */
  const [updateFixed, setUpdateFixed] = useState(true);
  const [balance, setBalance] = useState('');
  const [showList, setShowList] = useState(false);
  const [aiRead, setAiRead] = useState(false);
  const [progress, setProgress] = useState('');
  const [explained, setExplained] = useState(false);
  const [busy, setBusy] = useState(false);

  const reset = () => { setBalance(''); setShowList(false); setExplained(false); setRows(null); setOff({}); setInfo([]); setSkipped(0); setDups(0); setDupRows([]); setFileName(''); };

  /* qualsiasi altro file: non e' un estratto conto, quindi Theia guarda cos'e' e lo racconta in chat (con il consenso) */
  async function explainFile(a: { uri: string; name?: string; mimeType?: string }): Promise<boolean> {
    if (!aiServerConfigured) return false;
    const { readFilesWithAi } = await import('@/lib/assistant/theiaFlow');
    setProgress('Guardo cos’è questo file…');
    await readFilesWithAi('', [{ uri: a.uri, mime: a.mimeType ?? 'application/octet-stream', name: a.name }]);
    setInfo(['Non sembra un estratto conto, quindi non ho inserito nulla. Ho guardato cos’è e ti rispondo nella chat di Theia.']);
    setExplained(true);
    return true;
  }

  async function pick() {
    setBusy(true);
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel', '*/*'], copyToCacheDirectory: true });
      if (r.canceled || !r.assets[0]) return;
      const a = r.assets[0];
      const isPdf = a.mimeType === 'application/pdf' || /\.pdf$/i.test(a.name ?? '');
      const isImage = (a.mimeType ?? '').startsWith('image/');
      let text: string;
      /* PDF con tabella (Data, Testo, Addebito, Accredito): si legge tutto SUL TELEFONO, senza AI e senza inviare niente */
      let localText: string | null = null;
      if (isPdf) {
        try {
          setProgress('Leggo il PDF…');
          const layout = extractPdfLayout(await readBytes({ uri: a.uri, file: (a as { file?: unknown }).file }));
          const mv = layout ? parseTableStatement(layout) : [];
          if (mv.length) localText = movesToCsv(mv);
        } catch { /* si prova in altri modi */ }
      }
      if (localText) { text = localText; setAiRead(false); }
      else if (isPdf || isImage) {
        /* PDF o foto dell'estratto: l'AI legge solo le RIGHE dei movimenti (il resto del documento non esce dal telefono) */
        if (!aiServerConfigured) { setInfo(['Per leggere un estratto in PDF o in foto serve il server AI, che qui non è collegato. Scarica l’estratto in formato CSV dal tuo e-banking e riprova.']); return; }
        let moves: StatementMove[] = [];
        if (isImage) {
          if (!(await askSend('files', a.name))) { setInfo(['Non invio la foto: senza il permesso non posso leggerla. Puoi caricare il file CSV della banca.']); return; }
          logSend('files', a.size ?? 0, [a.mimeType ?? 'image']);
          setProgress('Leggo la foto…');
          moves = parseStatementReply(await aiReadFiles(STATEMENT_PDF_PROMPT, [{ uri: a.uri, mime: a.mimeType ?? 'image/jpeg' }]));
        } else {
          const read = await readLocally({ uri: a.uri, name: a.name ?? 'estratto.pdf', mime: 'application/pdf', size: a.size });
          if (read.kind !== 'text') { if (await explainFile(a)) return; setInfo([read.message]); return; }
          const { lines, year } = statementLines(read.text);
          if (!lines.length) { if (await explainFile(a)) return; setInfo(['Non trovo righe di movimenti in questo PDF: potrebbe essere una scansione. Carica il CSV della banca o una foto leggibile.']); return; }
          const parts = chunkLines(lines);
          if (!(await askSend('files', `${a.name} · ${lines.length} righe di movimenti`))) { setInfo(['Non invio i movimenti: senza il permesso non posso leggere il PDF. Puoi caricare il file CSV della banca.']); return; }
          logSend('files', lines.join('\n').length, ['movimenti']);
          for (let i = 0; i < parts.length; i++) {
            setProgress(`Leggo il PDF… ${i + 1} di ${parts.length}`);
            moves.push(...parseStatementReply(await aiChat(statementChunkPrompt(parts[i], year))));
          }
        }
        if (!moves.length) { if (await explainFile(a)) return; setInfo(['Non ho trovato movimenti in questo file. Controlla che sia l’estratto conto, oppure carica il CSV della banca.']); return; }
        text = movesToCsv(moves);
        setAiRead(true);
      } else { text = await readPickedText(a as { uri: string; file?: unknown }); setAiRead(false); }
      const parsed = parseCsv(text, catNames);
      if (!parsed.rows.length && !isPdf && !isImage && (await explainFile(a))) return;
      const existing = useFin.getState().months.flatMap((m) => m.movements.map((x) => ({ monthLabel: m.label, date: x.date, amount: x.amount })));
      const { fresh, duplicates } = splitDuplicates(parsed.rows, existing);
      setFileName(a.name); setRows(fresh); setOff({}); setInfo(parsed.warnings); setSkipped(parsed.skipped); setDups(duplicates.length); setDupRows(duplicates);
    } catch (e) {
      if (e instanceof AiServerError) { setInfo([e.message]); return; }
      toast('Impossibile leggere il file');
      setInfo(['Impossibile leggere il file. Esporta di nuovo l’estratto in formato CSV e riprova.']);
    } finally { setBusy(false); setProgress(''); }
  }

  const chosen = (rows ?? []).filter((_, i) => !off[i]);
  /* tutte le righe dell'estratto (anche quelle gia' presenti: l'estratto fa fede) */
  const allRows = () => [...chosen, ...dupRows].map((r) => ({ date: r.date, label: movementLabel(r), amount: r.amount }));
  const ins = useMemo(() => insightsOf([...(rows ?? []), ...dupRows].map((r) => ({ date: r.date, label: r.label, amount: r.amount }))), [rows, dupRows]);
  const bankMode = visible && useFin.getState().hasBankData();
  const day = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

  function importAll() {
    const all = allRows();
    if (!all.length) { toast('Nessun movimento selezionato'); return; }
    const st = useFin.getState();
    const prev = { months: st.months, bills: st.bills, budget: st.budget, info: st.statementInfo };
    const bal = Number(balance.replace(/['’\s]/g, '').replace(',', '.'));
    const opts = { balance: balance.trim() && Number.isFinite(bal) ? bal : null };
    let msg: string; let months = 1;
    if (bankMode) {
      const r = st.mergeStatement(all, opts);
      msg = `Aggiunti ${r.added} movimenti mancanti · ${r.known} erano già presenti${r.confirmedManual ? ` · ${r.confirmedManual} inserimenti a mano confermati dall’estratto` : ''}`;
    } else {
      const r = st.replaceWithStatement(all, opts);
      if (!r.added) { toast('Nessun movimento utilizzabile nell’estratto'); return; }
      months = r.months;
      msg = `Estratto conto importato: ${r.added} movimenti in ${r.months} ${r.months === 1 ? 'mese' : 'mesi'}${r.removed ? ` · tolti ${r.removed} movimenti precedenti` : ''}`;
    }
    if (updateFixed && ins) {
      const f = useFin.getState();
      if (ins.salary > 0) f.setBudget({ salary: ins.salary });
      f.replaceBills(ins.fixed.map((b) => ({ name: b.name, amount: b.amount, freq: 'monthly' as const })));
      f.setBudget(defaultBudget(ins.salary > 0 ? ins.salary : f.budget.salary, f.budget.saveToEmergency, f.categories, f.months));
    }
    useFin.getState().setStatementAt(Date.now());
    if (ins) useFin.getState().setStatementInfo({ from: ins.from, to: ins.to, count: ins.count, salary: ins.salary, sources: ins.sources, fixed: ins.fixed.map((b) => ({ name: b.name, amount: b.amount, count: b.count, lastDate: b.lastDate, key: b.key })), balanceKnown: opts.balance !== null || (bankMode && !!prev.info?.balanceKnown), ...(opts.balance !== null ? { balance: opts.balance } : bankMode && prev.info?.balance !== undefined ? { balance: prev.info.balance } : {}), at: Date.now() });
    announceStatement({ added: all.length, months });
    showUndoToast(msg, () => { const f = useFin.getState(); f.restoreMonths(prev.months); f.replaceBills(prev.bills.map(({ id: _id, ...b }) => b)); f.setBudget(prev.budget); f.setStatementInfo(prev.info); });
    reset(); onClose();
  }
  const total = chosen.reduce((s, r) => s + r.amount, 0);

  return (
    <Sheet visible={visible} title="Importa movimenti" onClose={() => { reset(); onClose(); }}>
      {!rows ? (
        <>
          <Body small muted style={{ marginBottom: 10 }}>Scegli un file. Se è l’estratto conto del tuo e-banking (CSV o PDF: UBS, PostFinance, Raiffeisen, ZKB, Revolut…) lo leggo e lo inserisco; se è un altro tipo di file ti dico cos’è. Riconosco da solo separatori, date e importi in formato svizzero; vedrai un’anteprima prima di importare e i movimenti già presenti non vengono duplicati.</Body>
          <Btn icon="plus" title={busy ? (progress || 'Leggo il file…') : 'Scegli un file (CSV, PDF o foto)'} disabled={busy} onPress={pick} />
          {info.map((w, i) => <Body key={i} small color={t.warn} style={{ marginTop: 8 }}>{w}</Body>)}
          {explained ? <Btn style={{ marginTop: 10 }} ghost title="Apri la chat di Theia" onPress={() => { reset(); onClose(); go('ai'); }} /> : null}
        </>
      ) : (
        <>
          <Body bold>Estratto conto</Body>
          <Body small muted>{fileName}</Body>
          {ins ? <Body style={{ marginTop: 6 }}>{ins.count} movimenti dal {day(ins.from)} al {day(ins.to)} · entrate {formatMoney(ins.income, { decimals: 2 })} · uscite {formatMoney(ins.expense, { decimals: 2 })}</Body> : <Body small muted style={{ marginTop: 6 }}>Non c’è nulla da importare.</Body>}
          {aiRead ? <AiNote /> : null}
          {aiRead ? <Body small muted>Letto da un PDF con l’AI: confronta importi e date con il tuo estratto.</Body> : null}
          {info.map((w, i) => <Body key={i} small color={t.warn} style={{ marginTop: 6 }}>{w}</Body>)}
          {ins && ins.salary > 0 ? <Body small style={{ marginTop: 8 }}>Stipendio / reddito mensile riconosciuto: circa {formatMoney(ins.salary)} ({ins.sources.map((s) => s.name).slice(0, 3).join(', ')}).</Body> : null}
          {ins && ins.fixed.length ? <Body small style={{ marginTop: 4 }}>Spese fisse riconosciute: {ins.fixed.slice(0, 5).map((b) => `${b.name} ${formatMoney(b.amount)}`).join(', ')}{ins.fixed.length > 5 ? '…' : ''}.</Body> : null}
          {ins ? (
            <>
              <Toggle label="Aggiorna stipendio, budget e spese fisse" value={updateFixed} onChange={setUpdateFixed} hint="Sostituisce le spese e il budget di prima con quello che risulta dall’estratto." />
              <Input placeholder="Saldo attuale del conto (facoltativo)" keyboardType="numeric" value={balance} onChangeText={setBalance} accessibilityLabel="Saldo attuale del conto" />
              <Body small muted>Se lo indichi, il totale dell’app parte da questo e il totale di prima si elimina.</Body>
              <Body bold style={{ marginTop: 14 }}>Vuoi importare tutti i movimenti dell’estratto?</Body>
              <Body small muted style={{ marginTop: 2 }}>{bankMode ? `Aggiungo solo quelli che mancano (${dups} già presenti). I movimenti inseriti a mano che l’estratto conferma vengono tolti.` : 'Sostituisco tutto quello che c’è ora (tranne i LifePoints, che restano nostri): quello che non è nell’estratto non ha più valore.'}</Body>
              <Row style={{ marginTop: 10 }} gap={8}>
                <Btn ghost style={{ flex: 1 }} title="No" onPress={() => { reset(); onClose(); }} />
                <Btn style={{ flex: 1 }} title="Sì, importa" onPress={importAll} />
              </Row>
              <Btn style={{ marginTop: 8 }} small ghost title={showList ? 'Nascondi i movimenti' : 'Vedi e correggi i movimenti'} onPress={() => setShowList(!showList)} />
            </>
          ) : <Btn style={{ marginTop: 10 }} ghost title="Altro file" onPress={reset} />}
          {showList ? (
            <View style={{ marginTop: 10 }}>
              {rows.map((r, i) => (
                <Item key={i} last={i === rows.length - 1} style={{ opacity: off[i] ? 0.4 : 1 }}>
                  <Row>
                    <View style={{ flex: 1 }}>
                      <Body small muted>{toAppDate(r.date)} · {monthLabelOfIso(r.date)}</Body>
                      <Body numberOfLines={2}>{r.label}</Body>
                    </View>
                    <Body bold color={r.amount > 0 ? t.positive : t.danger}>{r.amount > 0 ? '+' : ''}{r.amount.toFixed(2)}</Body>
                  </Row>
                  <Row style={{ marginTop: 6 }}>
                    {r.category ? <View style={{ flex: 1 }}><Select value={r.category} options={catNames} title="Categoria" onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, category: v } : x)))} /></View> : <Body small muted style={{ flex: 1 }}>Entrata</Body>}
                    <Btn small ghost title={off[i] ? 'Includi' : 'Escludi'} onPress={() => setOff({ ...off, [i]: !off[i] })} />
                  </Row>
                </Item>
              ))}
            </View>
          ) : null}
        </>
      )}
    </Sheet>
  );
}
