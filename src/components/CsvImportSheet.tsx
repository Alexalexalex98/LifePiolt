import * as DocumentPicker from 'expo-document-picker';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Body, Btn, Item, Row, Select, Sheet, Toggle } from '@/components/ui';
import { alertT } from '@/lib/alert';
import { AiNote } from '@/components/AiNote';
import { aiChat, aiReadFiles, aiServerConfigured, AiServerError } from '@/lib/aiServer';
import { readLocally } from '@/lib/bills/files';
import { askSend, logSend } from '@/lib/aiConsent';
import { STATEMENT_PDF_PROMPT, chunkLines, movesToCsv, parseStatementReply, statementChunkPrompt, statementLines, type StatementMove } from '@/lib/statementPdf';
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
  const [replace, setReplace] = useState(true);
  const [aiRead, setAiRead] = useState(false);
  const [progress, setProgress] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => { setRows(null); setOff({}); setInfo([]); setSkipped(0); setDups(0); setDupRows([]); setFileName(''); };

  async function pick() {
    setBusy(true);
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel', '*/*'], copyToCacheDirectory: true });
      if (r.canceled || !r.assets[0]) return;
      const a = r.assets[0];
      const isPdf = a.mimeType === 'application/pdf' || /\.pdf$/i.test(a.name ?? '');
      const isImage = (a.mimeType ?? '').startsWith('image/');
      let text: string;
      if (isPdf || isImage) {
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
          if (read.kind !== 'text') { setInfo([read.message]); return; }
          const { lines, year } = statementLines(read.text);
          if (!lines.length) { setInfo(['Non trovo righe di movimenti in questo PDF: potrebbe essere una scansione. Carica il CSV della banca o una foto leggibile.']); return; }
          const parts = chunkLines(lines);
          if (!(await askSend('files', `${a.name} · ${lines.length} righe di movimenti`))) { setInfo(['Non invio i movimenti: senza il permesso non posso leggere il PDF. Puoi caricare il file CSV della banca.']); return; }
          logSend('files', lines.join('\n').length, ['movimenti']);
          for (let i = 0; i < parts.length; i++) {
            setProgress(`Leggo il PDF… ${i + 1} di ${parts.length}`);
            moves.push(...parseStatementReply(await aiChat(statementChunkPrompt(parts[i], year))));
          }
        }
        if (!moves.length) { setInfo(['Non ho trovato movimenti in questo file. Controlla che sia l’estratto conto, oppure carica il CSV della banca.']); return; }
        text = movesToCsv(moves);
        setAiRead(true);
      } else { text = await readPickedText(a as { uri: string; file?: unknown }); setAiRead(false); }
      const parsed = parseCsv(text, catNames);
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
  function doReplace() {
    const all = [...chosen, ...dupRows].map((r) => ({ date: r.date, label: movementLabel(r), amount: r.amount }));
    const res = useFin.getState().replaceWithStatement(all);
    if (!res.added) { toast('Nessun movimento utilizzabile nell’estratto'); return; }
    const prev = res.previous;
    useFin.getState().setStatementAt(Date.now());
    announceStatement({ added: res.added, months: res.months });
    showUndoToast(`Estratto conto applicato: ${res.added} movimenti in ${res.months} ${res.months === 1 ? 'mese' : 'mesi'}${res.removed ? ` · tolti ${res.removed} movimenti precedenti` : ''}`, () => useFin.getState().restoreMonths(prev));
    reset(); onClose();
  }
  function confirm() {
    if (!chosen.length && !(replace && dupRows.length)) { toast('Nessun movimento selezionato'); return; }
    if (replace) {
      const have = useFin.getState().months.reduce((s, m) => s + m.movements.length, 0);
      alertT('L’estratto conto ha la precedenza', `Sostituisco i ${have} movimenti attuali con quelli dell’estratto conto (${chosen.length + dupRows.length}). Quello che non viene dalla banca sarà tolto. Subito dopo puoi annullare.`, [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Sostituisci', style: 'destructive', onPress: doReplace },
      ]);
      return;
    }
    const res = useFin.getState().importMovements(chosen.map((r) => ({ date: r.date, label: movementLabel(r), amount: r.amount })));
    useFin.getState().setStatementAt(Date.now());
    announceStatement({ added: res.added, months: Math.max(1, res.newMonths) });
    toast(`Importati ${res.added} movimenti${res.newMonths ? ` (${res.newMonths} ${res.newMonths === 1 ? 'mese aggiunto' : 'mesi aggiunti'})` : ''}${res.future ? ` · ${res.future} nel futuro ignorati` : ''}`);
    reset(); onClose();
  }
  const total = chosen.reduce((s, r) => s + r.amount, 0);

  return (
    <Sheet visible={visible} title="Importa movimenti" onClose={() => { reset(); onClose(); }}>
      {!rows ? (
        <>
          <Body small muted style={{ marginBottom: 10 }}>Scegli il file CSV (o l’estratto in PDF) scaricato dal tuo e-banking (UBS, PostFinance, Raiffeisen, ZKB, Revolut…). Riconosco da solo separatori, date e importi in formato svizzero; vedrai un’anteprima prima di importare e i movimenti già presenti non vengono duplicati.</Body>
          <Btn icon="plus" title={busy ? (progress || 'Leggo il file…') : 'Scegli un file (CSV, PDF o foto)'} disabled={busy} onPress={pick} />
          {info.map((w, i) => <Body key={i} small color={t.warn} style={{ marginTop: 8 }}>{w}</Body>)}
        </>
      ) : (
        <>
          <Body bold>{fileName}</Body>
          <Body small muted style={{ marginTop: 2 }}>{rows.length} {rows.length === 1 ? 'movimento nuovo' : 'movimenti nuovi'}{dups ? ` · ${dups} già presenti, ignorati` : ''}{skipped ? ` · ${skipped} righe non valide` : ''}</Body>
          {aiRead ? <AiNote /> : null}
          {aiRead ? <Body small muted>Letto da un PDF con l’AI: confronta importi e date con il tuo estratto prima di applicarlo.</Body> : null}
          {info.map((w, i) => <Body key={i} small color={t.warn} style={{ marginTop: 6 }}>{w}</Body>)}
          {rows.length === 0 && <Body small muted style={{ marginTop: 10 }}>Non c’è nulla da importare.</Body>}
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
          <Body small muted style={{ marginTop: 10 }}>Saldo dei movimenti selezionati: {total >= 0 ? '+' : ''}{formatMoney(total, { decimals: 2 })}. I mesi che non hai ancora in app vengono aggiunti come storico.</Body>
          <Toggle label="L’estratto conto ha la precedenza" value={replace} onChange={setReplace} hint="Sostituisce i movimenti attuali con quelli della banca e toglie tutto il resto. Puoi annullare subito dopo." />
          <Row style={{ marginTop: 12 }} gap={8}>
            <Btn ghost style={{ flex: 1 }} title="Altro file" onPress={reset} />
            <Btn style={{ flex: 1 }} disabled={!chosen.length && !(replace && dupRows.length)} title={replace ? `Applica l’estratto (${chosen.length + dupRows.length})` : `Importa ${chosen.length}`} onPress={confirm} />
          </Row>
        </>
      )}
    </Sheet>
  );
}
