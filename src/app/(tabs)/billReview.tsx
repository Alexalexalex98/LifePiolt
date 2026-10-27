import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, View, useWindowDimensions } from 'react-native';

import { Text } from '@/components/T';
import { PlanList } from '@/components/bills/PlanCard';
import { ReviewField } from '@/components/bills/ReviewField';
import { Note, StatusPill, fmtDay, fmtWeekday, money, usePlan } from '@/components/bills/shared';
import { Body, Btn, Card, H, Input, Item, Page, Pill, Row, Select, Sheet, Switch, Toggle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/core';
import { currentCurrency, currentLocale } from '@/i18n/format';
import { routeRequest } from '@/lib/aiRouter';
import { aiReadFiles, aiServerConfigured, AiServerError } from '@/lib/aiServer';
import { askSend, askSendRouted, logSend } from '@/lib/aiConsent';
import { AiNote } from '@/components/AiNote';
import { addBillToCalendar } from '@/lib/bills/calendar';
import { diffDays, todayIso } from '@/lib/bills/dates';
import { fileKind, openBillFile, readLocally, storeBillFile, type PickedBill } from '@/lib/bills/files';
import { emptyForm, formFromDraft, inputToIso, validateForm, isoToInput, type BillForm, type FormErrors } from '@/lib/bills/form';
import { applyAiExtraction, draftFromText } from '@/lib/bills';
import { takePendingText } from '@/lib/bills/pending';
import { scanQrFromImage, swissQrFrom } from '@/lib/bills/qrScan';
import { splitInstallments, statusOf } from '@/lib/bills/plan';
import { RECURRENCE_LABEL, KIND_LABEL, BILL_KINDS, type BillDraft, type BillKind, type Recurrence } from '@/lib/bills/types';
import { refreshBillReminders, previewReminders } from '@/lib/bills/schedule';
import { isSupported, requestPermission } from '@/lib/notify';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useFin } from '@/store/finance';
import { toast } from '@/store/toast';

const KIND_OPTIONS = BILL_KINDS.map((k) => KIND_LABEL[k]);
const kindOf = (label: string): BillKind => BILL_KINDS.find((k) => KIND_LABEL[k] === label) ?? 'altro';
const REC_OPTIONS = ['Nessuna', ...(Object.values(RECURRENCE_LABEL) as string[])];
const recOf = (label: string): Recurrence | '' => (Object.keys(RECURRENCE_LABEL) as Recurrence[]).find((k) => RECURRENCE_LABEL[k] === label) ?? '';

type Stage = 'loading' | 'review' | 'plan';

/** Schermata di revisione: cosa e' stato letto (con confidenza e riga d'origine), da controllare e confermare prima di salvare. */
export default function BillReview() {
  const th = useTheme();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ uri?: string; mime?: string; name?: string; text?: string; p?: string; k?: string; mode?: string; id?: string }>();
  const f = useFin();
  const { plan } = usePlan();
  const wide = width >= 820;

  const [stage, setStage] = useState<Stage>('loading');
  const [file, setFile] = useState<PickedBill | undefined>();
  const [text, setText] = useState<string | undefined>();
  const [qrPayload, setQrPayload] = useState<string | undefined>();
  const [draft, setDraft] = useState<BillDraft | undefined>();
  const [form, setForm] = useState<BillForm>(emptyForm(currentCurrency()));
  const [initial, setInitial] = useState<BillForm>(emptyForm(currentCurrency()));
  const [errors, setErrors] = useState<FormErrors>({});
  const [localNote, setLocalNote] = useState<string | undefined>();
  const [noTextWhy, setNoTextWhy] = useState<string | undefined>();
  const [saveFile, setSaveFile] = useState(true);
  const [remind, setRemind] = useState(true);
  const [calendar, setCalendar] = useState(false);
  const [rate, setRate] = useState(0);
  const [advanced, setAdvanced] = useState(false);
  const [aiSheet, setAiSheet] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | undefined>();
  const [zoom, setZoom] = useState(false);
  const [showText, setShowText] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState<string | undefined>();
  const [editId, setEditId] = useState<string | undefined>();
  const [reminderTick, setReminderTick] = useState(0);
  const run = useRef(0);

  const parseOpts = useCallback(() => ({ today: todayIso(), defaultCurrency: currentCurrency(), dateOrder: /^en-US/i.test(currentLocale()) ? ('mdy' as const) : undefined }), []);

  const load = useCallback(async () => {
    const my = ++run.current;
    setStage('loading'); setErrors({}); setAiMsg(undefined); setLocalNote(undefined); setNoTextWhy(undefined); setSavedId(undefined); setEditId(undefined);
    setRate(0); setAdvanced(false); setCalendar(false); setRemind(true); setSaveFile(true); setShowText(false);
    const apply = (d: BillDraft, ftext?: string) => {
      const fm = formFromDraft(d, currentCurrency());
      setDraft(d); setText(ftext); setForm(fm); setInitial(fm); setStage('review');
    };
    const blank = () => draftFromText('', parseOpts());
    // modifica di una bolletta esistente
    if (params.id) {
      const inv = useFin.getState().invoices.find((i) => i.id === params.id);
      if (inv) {
        const fm: BillForm = {
          issuer: inv.issuer, kind: inv.kind, amount: String(inv.amount).replace('.', ','), currency: inv.currency, issueDate: isoToInput(inv.issueDate), dueDate: isoToInput(inv.dueDate),
          periodFrom: isoToInput(inv.periodFrom), periodTo: isoToInput(inv.periodTo), number: inv.number ?? '', iban: inv.iban ?? '', reference: inv.reference ?? '', pagopa: inv.pagopa ?? '',
          recurrence: inv.recurrence ?? '', lateFee: inv.lateFee != null ? String(inv.lateFee).replace('.', ',') : '', lateInterestPct: inv.lateInterestPct != null ? String(inv.lateInterestPct).replace('.', ',') : '',
          notes: inv.notes ?? '', reminderLevel: inv.reminderLevel ?? 0,
        };
        setEditId(inv.id); setFile(inv.fileUri ? { uri: inv.fileUri, name: inv.fileName ?? 'Documento', mime: inv.fileMime } : undefined);
        setDraft(blank()); setText(undefined); setForm(fm); setInitial(fm); setRemind(inv.remind); setAdvanced(true); setStage('review');
        return;
      }
    }
    // testo incollato
    let pasted: string | undefined = params.text;
    if (!pasted && params.p) pasted = takePendingText()?.text;
    if (pasted) { setFile(undefined); apply(draftFromText(pasted, parseOpts()), pasted); return; }
    // file
    if (params.uri) {
      const pf: PickedBill = { uri: String(params.uri), name: String(params.name || 'Documento'), mime: params.mime ? String(params.mime) : undefined };
      setFile(pf);
      const r = await readLocally(pf);
      if (my !== run.current) return;
      if (r.kind === 'text') { setLocalNote(r.note); apply(draftFromText(r.text, parseOpts()), r.text); return; }
      setNoTextWhy(r.message);
      // foto della fattura: il QR-bill si legge sul telefono (senza AI e senza inviare nulla) e riempie IBAN, importo e riferimento
      const qr = (pf.mime ?? '').startsWith('image/') ? await scanQrFromImage(pf.uri) : null;
      if (my !== run.current) return;
      setQrPayload(qr ?? undefined);
      apply(qr ? draftFromText(qr, parseOpts()) : blank(), qr ?? undefined);
      return;
    }
    setFile(undefined);
    apply(blank());
    // k e mode non si leggono qui: servono a rieseguire il caricamento a ogni nuova apertura della schermata
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, params.text, params.p, params.uri, params.name, params.mime, params.k, params.mode, parseOpts]);

  useEffect(() => { void load(); }, [load]);

  const set = <K extends keyof BillForm>(k: K, v: BillForm[K]) => setForm((p) => ({ ...p, [k]: v }));
  const edited = (k: keyof BillForm) => !!draft && String(initial[k]) !== String(form[k]) && String(initial[k]) !== '';

  const isImage = file ? fileKind(file) === 'image' : false;
  const isEdit = !!editId;
  const warnings = useMemo(() => [...(draft?.warnings ?? []), ...(draft?.ambiguities ?? [])], [draft]);
  const needsAi = !!file && !!noTextWhy && !isEdit;

  async function readWithAi() {
    if (!file) return;
    setAiBusy(true); setAiMsg(undefined);
    try {
      const prompt = t('Leggi questa bolletta o fattura e riporta in testo semplice: fornitore, importo totale da pagare con valuta, data di emissione, data di scadenza, numero del documento, IBAN e riferimento di pagamento. Non inventare nulla.');
      const mime = file.mime || (isImage ? 'image/jpeg' : 'application/pdf');
      if (aiServerConfigured) {
        if (!(await askSend('files', file.name))) { setAiMsg(t('Non invio il file: senza il permesso non posso leggerlo. Compila i campi a mano.')); return; }
        logSend('files', file.size ?? 0, [mime]);
      }
      let res: { status: string; text?: string; message: string };
      if (aiServerConfigured) res = { status: 'answered', text: await aiReadFiles(prompt, [{ uri: file.uri, mime }]), message: '' };
      else {
        const gate = await askSendRouted('files', file.name);
        if (!gate.ok) { setAiMsg(t('Non invio il file: senza il permesso non posso leggerlo. Compila i campi a mano.')); return; }
        try { res = await routeRequest({ text: prompt, lang: 'it', source: 'typed', images: [{ uri: file.uri, mime }] }); } finally { gate.restore(); }
      }
      if (res.status === 'answered' && res.text) {
        const merged = applyAiExtraction(draft ?? draftFromText('', parseOpts()), { text: res.text }, parseOpts());
        const nf = formFromDraft(merged, currentCurrency());
        setDraft(merged);
        setForm((p) => {
          const out = { ...p };
          (Object.keys(nf) as (keyof BillForm)[]).forEach((k) => { if (!String(p[k] ?? '').trim() || (k === 'kind' && p.kind === 'altro')) (out as Record<string, unknown>)[k] = nf[k]; });
          return out;
        });
        setInitial(nf);
        setNoTextWhy(undefined);
        setAiMsg(t('Ho riempito i campi con la lettura esterna: controllali, sono tutti da confermare.'));
      } else setAiMsg(res.message);
    } catch (e) { setAiMsg(e instanceof AiServerError ? e.message : t('Non sono riuscito a contattare il servizio esterno.')); }
    finally { setAiBusy(false); setAiSheet(false); }
  }

  async function save() {
    const r = validateForm(form);
    if (!r.ok || !r.value) { setErrors(r.errors); toast(t('Controlla i campi evidenziati')); return; }
    setErrors({});
    setBusy(true);
    try {
      const v = r.value;
      const st = useFin.getState();
      if (editId) {
        // campi svuotati dal modulo tornano indefiniti
        const cleared: Record<string, undefined> = {};
        (['issueDate', 'periodFrom', 'periodTo', 'number', 'iban', 'reference', 'pagopa', 'recurrence', 'lateFee', 'lateInterestPct', 'notes'] as const).forEach((k) => { if (!(k in v)) cleared[k] = undefined; });
        st.patchInvoice(editId, { ...cleared, ...v, remind, estimated: undefined }, 'Modificata');
        setSavedId(editId);
      } else {
        let fileInfo: { fileUri?: string; fileId?: string; fileName?: string; fileMime?: string } = {};
        if (file && saveFile) {
          const s = await storeBillFile(file);
          fileInfo = { fileUri: s.uri, fileId: s.driveId, fileName: file.name, fileMime: file.mime };
        }
        const installments = draft?.plan ? draft.plan.installments : rate > 1 ? splitInstallments(v.amount, rate, v.dueDate) : undefined;
        const how = text ? (file ? 'Aggiunta da file' : 'Aggiunta da testo incollato') : file ? 'Aggiunta dal documento (compilata a mano)' : 'Aggiunta a mano';
        const id = st.addInvoice({ ...v, ...fileInfo, ...((qrPayload ?? swissQrFrom(text)) ? { qr: (qrPayload ?? swissQrFrom(text))! } : {}), ...(installments ? { installments } : {}), remind, calendar: false }, installments ? `${how} · rateizzata in ${rate} rate` : how);
        if (calendar) {
          const inv = useFin.getState().invoices.find((i) => i.id === id);
          if (inv && addBillToCalendar(inv, money(inv.amount, inv.currency)).length) useFin.getState().patchInvoice(id, { calendar: true });
        }
        setSavedId(id);
      }
      if (remind && isSupported()) { try { await requestPermission(); } catch { /* ignore */ } }
      void refreshBillReminders();
      setStage('plan');
      toast(isEdit ? t('Bolletta aggiornata') : t('Bolletta salvata'));
    } catch { toast(t('Non sono riuscito a salvare la bolletta')); }
    finally { setBusy(false); }
  }

  // ------------------------------------------------------------ anteprima del documento
  const preview = file ? (
    <Card>
      <Row>
        <H style={{ marginBottom: 0, flex: 1 }}>{t('Il documento')}</H>
        <Btn small ghost title="Apri" icon="file" onPress={() => { if (!openBillFile(file)) toast(t('Impossibile aprire il file')); }} />
      </Row>
      <Body small muted numberOfLines={2} style={{ marginBottom: 8 }}>{file.name}</Body>
      {isImage ? (
        <Btn ghost small title="Ingrandisci" icon="eye" onPress={() => setZoom(true)} style={{ marginBottom: 8, alignSelf: 'flex-start' }} />
      ) : null}
      {isImage ? (
        <Image source={{ uri: file.uri }} resizeMode="contain" accessibilityLabel={t('Anteprima del documento')} style={{ width: '100%', height: wide ? 420 : 230, backgroundColor: th.tile, borderRadius: 12 }} />
      ) : (
        <View style={{ height: 90, borderRadius: 12, backgroundColor: th.tile, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Icon name="file" size={26} color={th.muted} stroke={1.7} />
          <Body small muted>{fileKind(file) === 'pdf' ? 'Documento PDF' : 'Documento'}</Body>
        </View>
      )}
      {!isEdit && <Row style={{ marginTop: 8 }}><Body small style={{ flex: 1 }}>Salva il documento in LifeDrive (resta sul telefono)</Body><Switch value={saveFile} onValueChange={setSaveFile} accessibilityLabel={t('Salva il documento in LifeDrive')} /></Row>}
    </Card>
  ) : text ? (
    <Card>
      <Row>
        <H style={{ marginBottom: 0, flex: 1 }}>{t('Testo analizzato')}</H>
        <Btn small ghost title={showText ? 'Nascondi' : 'Mostra'} onPress={() => setShowText((v) => !v)} />
      </Row>
      <Body small muted>{t('{0} caratteri letti sul telefono, nulla è stato inviato.', text.length)}</Body>
      {showText ? <Text selectable style={{ color: th.muted, fontSize: 12, lineHeight: 17, marginTop: 8 }}>{text.slice(0, 3000)}{text.length > 3000 ? ' …' : ''}</Text> : null}
    </Card>
  ) : null;

  // ------------------------------------------------------------ passo 2: piano e promemoria
  if (stage === 'plan' && savedId) {
    const inv = f.invoices.find((i) => i.id === savedId);
    return (
      <PlanStep
        invoiceId={savedId}
        issuer={inv?.issuer ?? ''}
        tick={reminderTick}
        onTick={() => setReminderTick((x) => x + 1)}
        onDone={() => go('billDetail', { id: savedId })}
        onAnother={() => go('lifefinance')}
        plan={plan}
      />
    );
  }

  return (
    <Page id="billReview" title={isEdit ? 'Modifica bolletta' : 'Controlla la bolletta'} back>
      {stage === 'loading' ? (
        <Card><Body muted>{t('Leggo il documento sul telefono…')}</Body></Card>
      ) : (
        <>
          <Card accent={th.accent}>
            <Row gap={10} style={{ alignItems: 'flex-start', justifyContent: 'flex-start' }}>
              <Icon name="shield" size={20} color={th.accent} stroke={1.9} />
              <Body small style={{ flex: 1 }}>
                {isEdit ? 'Modifica i dati: i promemoria e il piano si aggiornano da soli.' : 'Nulla viene inserito finché non confermi. Controlla ogni campo: sotto ognuno vedi cosa ho letto e da quale riga. I dati restano sul telefono.'}
              </Body>
            </Row>
          </Card>

          {localNote ? <Card><Note icon="alert" tone="warn">{localNote}</Note></Card> : null}

          {needsAi && (
            <Card accent={th.warn}>
              <Row gap={10} style={{ alignItems: 'flex-start', justifyContent: 'flex-start' }}>
                <Icon name="eye" size={20} color={th.text} stroke={1.9} />
                <View style={{ flex: 1 }}>
                  <Body bold>{t('Non riesco a leggerlo qui')}</Body>
                  <Body small muted style={{ marginTop: 2 }}>{noTextWhy}</Body>
                  <Body small style={{ marginTop: 6 }}>Compila i campi qui sotto guardando il documento. Se vuoi, puoi provare a leggerlo con un'AI esterna: prima ti mostro cosa verrebbe inviato e serve il tuo consenso.</Body>
                  <Btn small ghost style={{ marginTop: 8, alignSelf: 'flex-start' }} icon="sparkle" title="Leggi con un'AI esterna" onPress={() => setAiSheet(true)} />
                  {aiMsg ? <><Note icon="info">{aiMsg}</Note><AiNote /></> : null}
                </View>
              </Row>
            </Card>
          )}
          {!needsAi && aiMsg ? <Card><Note icon="info">{aiMsg}</Note><AiNote /></Card> : null}

          {draft && draft.empty && !needsAi && !isEdit && (text ?? '').length > 0 && (
            <Card><Note icon="alert" tone="warn">{t('Da questo testo non riesco a ricavare una bolletta. Compila i campi a mano oppure incolla un testo più completo.')}</Note></Card>
          )}

          {warnings.length > 0 && !isEdit && (
            <Card accent={th.warn}>
              <Body bold>{t('Da controllare')}</Body>
              {warnings.map((w, i) => <Note key={i} icon="alert" tone="warn">{w}</Note>)}
            </Card>
          )}

          <View style={wide ? { flexDirection: 'row', gap: 16, alignItems: 'flex-start' } : undefined}>
            {wide && preview ? <View style={{ flex: 1 }}>{preview}</View> : null}
            <View style={wide ? { flex: 1.2 } : undefined}>
              {!wide && preview}
              <Card>
                <H>{t('Cosa ho letto')}</H>
                <ReviewField label="Fornitore o chi emette" value={form.issuer} onValue={(v) => set('issuer', v)} read={draft?.issuer} edited={edited('issuer')} error={errors.issuer} placeholder="Es. Energia Ticino SA" />
                <View style={{ marginBottom: 12 }}>
                  <Body small bold style={{ marginBottom: 5 }}>Tipo</Body>
                  <Select value={KIND_LABEL[form.kind]} options={KIND_OPTIONS} title="Tipo" onChange={(v) => set('kind', kindOf(v))} />
                  {draft && !isEdit && draft.kind.source ? <Body small muted>{t('Tipo dedotto: {0} · confidenza {1}', t(KIND_LABEL[draft.kind.value]), t(draft.kind.confidence === 'alta' ? 'alta' : draft.kind.confidence === 'media' ? 'media' : 'bassa'))} ({draft.kind.source})</Body> : null}
                </View>
                <Row style={{ alignItems: 'flex-start' }}>
                  <View style={{ flex: 2 }}>
                    <ReviewField label="Importo da pagare" value={form.amount} onValue={(v) => set('amount', v)} read={draft?.amount} edited={edited('amount')} error={errors.amount} keyboardType="decimal-pad" placeholder="0,00">
                      {draft && draft.amountAlternatives.length > 1 && !isEdit ? (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
                          {draft.amountAlternatives.slice(0, 4).map((a) => <Pill key={a.value} label={String(a.value).replace('.', ',')} on={inputToIsoAmount(form.amount) === a.value} onPress={() => set('amount', String(a.value).replace('.', ','))} />)}
                        </View>
                      ) : null}
                    </ReviewField>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ReviewField label="Valuta" value={form.currency} onValue={(v) => set('currency', v.toUpperCase().slice(0, 3))} read={draft?.currency} edited={edited('currency')} error={errors.currency} autoCapitalize="characters" maxLength={3} />
                  </View>
                </Row>
                <ReviewField label="Scadenza (gg/mm/aaaa)" value={form.dueDate} onValue={(v) => set('dueDate', v)} read={draft?.dueDate} edited={edited('dueDate')} error={errors.dueDate} placeholder="gg/mm/aaaa" keyboardType="numbers-and-punctuation" />
                {form.dueDate && inputToIso(form.dueDate) ? <DueHint iso={inputToIso(form.dueDate) as string} /> : null}
                <ReviewField label="Data del documento (gg/mm/aaaa)" value={form.issueDate} onValue={(v) => set('issueDate', v)} read={draft?.issueDate} edited={edited('issueDate')} error={errors.issueDate} placeholder="gg/mm/aaaa" keyboardType="numbers-and-punctuation" />
                <ReviewField label="Numero del documento" value={form.number} onValue={(v) => set('number', v)} read={draft?.number} edited={edited('number')} autoCapitalize="characters" />
                <ReviewField label="IBAN" value={form.iban} onValue={(v) => set('iban', v)} read={draft?.iban} edited={edited('iban')} error={errors.iban} autoCapitalize="characters" />
                <ReviewField label="Riferimento di pagamento" value={form.reference} onValue={(v) => set('reference', v)} read={draft?.reference} edited={edited('reference')} autoCapitalize="characters" />
                {draft?.qrIban ? <Note icon="info">{t('QR-IBAN: il pagamento richiede il riferimento QR.')}</Note> : null}
                <ReviewField label="Codice avviso PagoPA" value={form.pagopa} onValue={(v) => set('pagopa', v)} read={draft?.pagopa} edited={edited('pagopa')} keyboardType="numbers-and-punctuation" />
                <Btn small ghost title={advanced ? 'Meno opzioni' : 'Altre opzioni'} icon={advanced ? 'arrow-up' : 'arrow-down'} onPress={() => setAdvanced((v) => !v)} style={{ alignSelf: 'flex-start' }} />
                {advanced && (
                  <View style={{ marginTop: 12 }}>
                    <Row style={{ alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}><ReviewField label="Periodo da" value={form.periodFrom} onValue={(v) => set('periodFrom', v)} read={draft?.periodFrom} placeholder="gg/mm/aaaa" keyboardType="numbers-and-punctuation" error={errors.periodFrom} /></View>
                      <View style={{ flex: 1 }}><ReviewField label="Periodo a" value={form.periodTo} onValue={(v) => set('periodTo', v)} read={draft?.periodTo} placeholder="gg/mm/aaaa" keyboardType="numbers-and-punctuation" error={errors.periodTo} /></View>
                    </Row>
                    <View style={{ marginBottom: 12 }}>
                      <Body small bold style={{ marginBottom: 5 }}>Si ripete</Body>
                      <Select value={form.recurrence ? RECURRENCE_LABEL[form.recurrence] : 'Nessuna'} options={REC_OPTIONS} title="Si ripete" onChange={(v) => set('recurrence', recOf(v))} />
                      {draft?.recurrence ? <Body small muted>{t('Suggerito: {0} ({1})', t(RECURRENCE_LABEL[draft.recurrence.value]), draft.recurrence.source)}</Body> : null}
                    </View>
                    <ReviewField label="Penale di ritardo (importo)" value={form.lateFee} onValue={(v) => set('lateFee', v)} read={draft?.lateFee} error={errors.lateFee} keyboardType="decimal-pad" />
                    <ReviewField label="Interesse di mora annuo (%)" value={form.lateInterestPct} onValue={(v) => set('lateInterestPct', v)} read={draft?.lateInterestPct} error={errors.lateInterestPct} keyboardType="decimal-pad" />
                    {draft?.reminderNotice ? <Note icon="alert" tone="warn">{t('Il documento sembra un sollecito (livello {0}).', draft.reminderNotice.value)}</Note> : null}
                    <Body small bold style={{ marginBottom: 5 }}>Note</Body>
                    <Input multiline style={{ minHeight: 70 }} placeholder="Note personali" value={form.notes} onChangeText={(v) => set('notes', v)} />
                  </View>
                )}
              </Card>

              {!isEdit && draft?.plan ? (
                <Card accent={th.accent}>
                  <H>{t('Piano di pagamento riconosciuto')}</H>
                  <Body small muted style={{ marginBottom: 6 }}>{t('{0} rate, in tutto {1}. Le salvo tutte con le loro scadenze e ti avviso prima di ognuna.', draft.plan.installments.length, money(draft.plan.statedTotal ?? draft.plan.total, form.currency || undefined))}</Body>
                  {[...draft.plan.installments.slice(0, 3), ...(draft.plan.installments.length > 4 ? [null] : []), ...draft.plan.installments.slice(-1)].map((x, i) => (
                    x ? <Row key={i}><Body small muted>{t('Rata {0}: {1}', draft.plan!.installments.indexOf(x) + 1, fmtDay(x.dueDate))}</Body><Body small bold>{money(x.amount, form.currency || undefined)}</Body></Row> : <Body key={i} small muted>…</Body>
                  ))}
                </Card>
              ) : null}
              {!isEdit && !draft?.plan && (
                <Card>
                  <H>{t('Come vuoi pagarla')}</H>
                  <Body small muted style={{ marginBottom: 6 }}>Se hai concordato una rateizzazione, scegli quante rate: la divido in rate mensili.</Body>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    <Pill label="Un solo pagamento" on={rate === 0} onPress={() => setRate(0)} />
                    {[2, 3, 4, 6, 12].map((n) => <Pill key={n} label={`${n} rate`} on={rate === n} onPress={() => setRate(n)} />)}
                  </View>
                  {rate > 1 && inputToIso(form.dueDate) && validateForm(form).value ? (
                    <View style={{ marginTop: 8 }}>
                      {splitInstallments(validateForm(form).value!.amount, rate, inputToIso(form.dueDate) as string).map((x, i) => (
                        <Row key={i}><Body small muted>{t('Rata {0}: {1}', i + 1, fmtDay(x.dueDate))}</Body><Body small bold>{money(x.amount, form.currency || undefined)}</Body></Row>
                      ))}
                    </View>
                  ) : null}
                </Card>
              )}

              <Card>
                <Toggle label="Ricordami la scadenza" hint="Notifiche sul telefono prima della scadenza (le scegli dopo)" value={remind} onChange={setRemind} />
                {!isEdit && <Toggle label="Aggiungi la scadenza al calendario" hint="Evento ambra nel Plan" value={calendar} onChange={setCalendar} />}
              </Card>

              <Btn title={isEdit ? 'Salva le modifiche' : 'Conferma e pianifica'} icon="check" onPress={save} disabled={busy} />
              <Btn ghost style={{ marginTop: 8 }} title="Annulla" onPress={() => go('lifefinance')} />
            </View>
          </View>
        </>
      )}

      <Sheet visible={aiSheet} title="Leggere con un'AI esterna?" onClose={() => setAiSheet(false)}>
        <Body style={{ marginBottom: 8 }}>Vedi qui cosa uscirebbe dal telefono, prima di decidere.</Body>
        <Item><Body bold>Verrebbe inviato</Body><Body small muted>L'immagine o il PDF di questo documento ({file?.name ?? ''}) e una richiesta di lettura. Nient'altro: niente saldo, movimenti o altri dati delle tue finanze.</Body></Item>
        <Item><Body bold>Il tuo controllo</Body><Body small muted>Con «Solo sul telefono» attivo (è l'impostazione predefinita) non parte nulla. Se un servizio è collegato, ti chiederò il consenso prima di inviare.</Body></Item>
        <Item last><Body bold>Dopo</Body><Body small muted>I campi letti restano proposte: li controlli e li confermi tu, come per la lettura sul telefono.</Body></Item>
        <Btn style={{ marginTop: 14 }} title={aiBusy ? 'Attendi…' : 'Continua'} disabled={aiBusy} onPress={readWithAi} />
        <Btn style={{ marginTop: 8 }} ghost title="Annulla" onPress={() => setAiSheet(false)} />
      </Sheet>
      <Sheet visible={zoom} title="Documento" onClose={() => setZoom(false)}>
        {file ? <Image source={{ uri: file.uri }} resizeMode="contain" style={{ width: '100%', height: Platform.OS === 'web' ? 520 : 480 }} accessibilityLabel={t('Documento ingrandito')} /> : null}
      </Sheet>
    </Page>
  );
}

const inputToIsoAmount = (s: string): number | null => { const n = parseFloat(s.replace(/[^\d,.-]/g, '').replace(',', '.')); return Number.isFinite(n) ? Math.round(n * 100) / 100 : null; };

function DueHint({ iso }: { iso: string }) {
  const th = useTheme();
  const d = diffDays(todayIso(), iso);
  const msg = d < 0 ? t('Scaduta da {0} giorni', -d) : d === 0 ? t('Scade oggi') : t('Mancano {0} giorni', d);
  return <Body small color={d < 0 ? th.danger : th.muted} style={{ marginTop: -4, marginBottom: 10 }}>{fmtWeekday(iso)} · {msg}</Body>;
}

// ---------------------------------------------------------------- passo 2

function PlanStep({ invoiceId, issuer, tick, onTick, onDone, onAnother, plan }: {
  invoiceId: string; issuer: string; tick: number; onTick: () => void; onDone: () => void; onAnother: () => void; plan: ReturnType<typeof usePlan>['plan'];
}) {
  const th = useTheme();
  const f = useFin();
  const inv = f.invoices.find((i) => i.id === invoiceId);
  const prefs = f.billPrefs;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reminders = useMemo(() => previewReminders(invoiceId), [invoiceId, f.invoices, f.billPrefs, tick]);
  const status = inv ? statusOf(inv, todayIso(), prefs.soonDays) : 'da_pagare';
  const wd = (at: number) => { const d = new Date(at); return `${fmtDay(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  return (
    <Page id="billReview" title="Piano e promemoria" back>
      <Card accent={th.positive}>
        <Row gap={10} style={{ justifyContent: 'flex-start' }}>
          <Icon name="check" size={20} color={th.positive} stroke={2.4} />
          <View style={{ flex: 1 }}><Body bold>{issuer}</Body><Body small muted>{t('Salvata. Ecco quando conviene pagarla e quali promemoria vengono programmati.')}</Body></View>
          <StatusPill status={status} />
        </Row>
      </Card>

      <Card>
        <H>{t('Quando pagare')}</H>
        <PlanList plan={plan} filterId={invoiceId} />
        {plan.warnings.length > 0 && <Note icon="alert" tone="danger">{t('Con le entrate e le spese previste, in alcune date la liquidità non basta: vedi il piano completo in Bollette.')}</Note>}
      </Card>

      <Card>
        <H>{t('Promemoria')}</H>
        <Toggle label="Ricordami la scadenza" value={!!inv?.remind} onChange={(v) => { f.patchInvoice(invoiceId, { remind: v }); onTick(); }} />
        {!isSupported() && <Note icon="info">{t('Le notifiche si programmano sull\'app installata sul telefono: qui vedi l\'anteprima di quando partirebbero.')}</Note>}
        <View style={{ opacity: prefs.on && inv?.remind ? 1 : 0.45 }}>
          <Toggle label="7 giorni prima" value={prefs.d7} onChange={(v) => f.setBillPrefs({ d7: v })} />
          <Toggle label="3 giorni prima" value={prefs.d3} onChange={(v) => f.setBillPrefs({ d3: v })} />
          <Toggle label="Il giorno prima" value={prefs.d1} onChange={(v) => f.setBillPrefs({ d1: v })} />
          <Toggle label="La mattina della scadenza" value={prefs.d0} onChange={(v) => f.setBillPrefs({ d0: v })} />
          <Toggle label="Se scade senza pagamento: giorno dopo e ogni 3 giorni" value={prefs.overdue} onChange={(v) => f.setBillPrefs({ overdue: v })} />
        </View>
        <Body small muted style={{ marginTop: 4 }}>{t('Gli interruttori valgono per tutte le bollette; l\'ora si cambia in Bollette > Promemoria.')}</Body>
        <View style={{ marginTop: 10 }}>
          {inv?.remind && prefs.on ? (reminders.length ? reminders.slice(0, 12).map((r, i) => (
            <Item key={r.id} last={i === Math.min(reminders.length, 12) - 1}>
              <Body small bold>{wd(r.at)}</Body>
              <Body small muted>{r.body}</Body>
            </Item>
          )) : <Body small muted>{t('Nessun promemoria futuro da programmare.')}</Body>) : <Body small muted>{t('Promemoria disattivati per questa bolletta.')}</Body>}
        </View>
      </Card>

      <Btn title="Apri la bolletta" onPress={onDone} />
      <Btn ghost style={{ marginTop: 8 }} title="Torna a Finanze" onPress={onAnother} />
    </Page>
  );
}
