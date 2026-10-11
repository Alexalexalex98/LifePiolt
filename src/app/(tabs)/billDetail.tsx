import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, View } from 'react-native';

import { PlanList } from '@/components/bills/PlanCard';
import { Note, StatusPill, dueText, fmtDay, money, usePlan } from '@/components/bills/shared';
import { Body, Btn, Card, Empty, H, Input, Item, Metric, Page, Pill, Row, Sheet, Toggle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/core';
import { currentCurrency, fmtDate } from '@/i18n/format';
import { alertT } from '@/lib/alert';
import { addBillToCalendar, isInCalendar, removeBillFromCalendar, restoreBillEvents } from '@/lib/bills/calendar';
import { diffDays } from '@/lib/bills/dates';
import { openBillFile, fileKind } from '@/lib/bills/files';
import { inputToAmount, inputToIso, isoToInput } from '@/lib/bills/form';
import { dueItemsOf, lateCost, nextDueDate, outstanding, splitInstallments, statusOf } from '@/lib/bills/plan';
import { KIND_LABEL, RECURRENCE_LABEL } from '@/lib/bills/types';
import { cancelBillReminders, previewReminders, refreshBillReminders } from '@/lib/bills/schedule';
import { confirmDelete } from '@/lib/confirm';
import { go } from '@/lib/nav';
import { useFin, type PaidToken } from '@/store/finance';
import { showUndoToast, toast } from '@/store/toast';

function DataRow({ label, value, copy }: { label: string; value?: string; copy?: boolean }) {
  const th = useTheme();
  if (!value) return null;
  return (
    <Item>
      <Row style={{ alignItems: 'flex-start' }}>
        <Body small muted style={{ flex: 1 }}>{label}</Body>
        <View style={{ flex: 1.6, alignItems: 'flex-end' }}>
          <Body small bold style={{ textAlign: 'right' }} >{value}</Body>
        </View>
        {copy ? <Btn small ghost icon="copy" title="" label={t('Copia {0}', t(label))} onPress={() => { void Clipboard.setStringAsync(value).then(() => toast(t('Copiato'))).catch(() => toast(t('Non riesco a copiare'))); }} /> : null}
      </Row>
      <View style={{ height: 0, backgroundColor: th.item }} />
    </Item>
  );
}

const dt = (iso: string) => fmtDate(new Date(iso), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Dettaglio di una bolletta: dati, allegato, stato, piano, promemoria, cronologia e azioni (pagata, modifica, elimina, calendario). */
export default function BillDetail() {
  const th = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const f = useFin();
  const { today, plan } = usePlan();
  const inv = f.invoices.find((i) => i.id === id);
  const [paySheet, setPaySheet] = useState<{ installment?: number } | null>(null);
  const [payDate, setPayDate] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payRecord, setPayRecord] = useState(false);
  const [splitSheet, setSplitSheet] = useState(false);
  const [splitN, setSplitN] = useState(3);
  const [splitFirst, setSplitFirst] = useState('');
  const [zoom, setZoom] = useState(false);
  const [calTick, setCalTick] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reminders = useMemo(() => (inv ? previewReminders(inv.id) : []), [inv, f.billPrefs]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const inCal = useMemo(() => (inv ? isInCalendar(inv.id) : false), [inv, calTick]);

  if (!inv) {
    return (
      <Page id="billDetail" title="Bolletta" back>
        <Card><Empty text="Questa bolletta non c'è più." /><Btn style={{ marginTop: 10 }} title="Torna a Finanze" onPress={() => go('lifefinance')} /></Card>
      </Page>
    );
  }

  const status = statusOf(inv, today, f.billPrefs.soonDays);
  const nd = nextDueDate(inv) ?? inv.dueDate;
  const dd = nd ? diffDays(today, nd) : null;
  const open = inv.state === 'open';
  const left = outstanding(inv);
  const cost = open && dd != null && dd < 0 ? lateCost(inv, left, -dd) : undefined;
  const dues = dueItemsOf(inv);
  const img = inv.fileUri && fileKind({ name: inv.fileName ?? '', mime: inv.fileMime }) === 'image';
  const rec = inv.recurrence ? RECURRENCE_LABEL[inv.recurrence] : undefined;
  const canRecord = (inv.currency || '').toUpperCase() === currentCurrency().toUpperCase() && !!f.months[0] && !f.months[0].locked;

  function openPay(installment?: number) {
    const amt = installment != null ? inv!.installments?.[installment]?.amount ?? left : left;
    setPayDate(isoToInput(today)); setPayAmount(String(amt).replace('.', ',')); setPayRecord(false); setPaySheet({ installment });
  }
  function confirmPay() {
    const iso = inputToIso(payDate), amt = inputToAmount(payAmount);
    if (!iso) { toast(t('Data non valida: usa gg/mm/aaaa')); return; }
    if (amt == null) { toast(t('Inserisci un importo maggiore di zero')); return; }
    const sheet = paySheet;
    setPaySheet(null);
    alertT('Segnare come pagata?', `${inv!.issuer}: ${money(amt, inv!.currency)} · ${fmtDay(iso)}${payRecord && canRecord ? '\nVerrà registrata anche come movimento.' : ''}`, [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Conferma',
        onPress: () => {
          const tok: PaidToken | null = useFin.getState().markInvoicePaid(inv!.id, { date: iso, amount: amt, record: payRecord && canRecord, installment: sheet?.installment });
          if (!tok) return;
          const after = useFin.getState().invoices.find((i) => i.id === inv!.id);
          let removed: ReturnType<typeof removeBillFromCalendar> = [];
          if (after?.state === 'paid') { void cancelBillReminders(inv!.id); removed = removeBillFromCalendar(inv!.id); }
          setCalTick((x) => x + 1);
          void refreshBillReminders();
          showUndoToast(t('Segnata come pagata'), () => { useFin.getState().undoInvoicePaid(tok); restoreBillEvents(removed); setCalTick((x) => x + 1); void refreshBillReminders(); });
        },
      },
    ]);
  }

  function toggleCalendar(v: boolean) {
    if (v) {
      const n = addBillToCalendar(inv!, money(inv!.amount, inv!.currency)).length;
      f.patchInvoice(inv!.id, { calendar: n > 0 });
      toast(n ? t('Scadenza aggiunta al calendario') : t('Non ci sono scadenze da aggiungere'));
    } else {
      const removed = removeBillFromCalendar(inv!.id);
      f.patchInvoice(inv!.id, { calendar: false });
      if (removed.length) showUndoToast(t('Scadenza tolta dal calendario'), () => { restoreBillEvents(removed); f.patchInvoice(inv!.id, { calendar: true }); setCalTick((x) => x + 1); });
    }
    setCalTick((x) => x + 1);
  }

  function remove() {
    let r: ReturnType<typeof f.delInvoice> = null;
    let cal: ReturnType<typeof removeBillFromCalendar> = [];
    confirmDelete(`la bolletta «${inv!.issuer}»`, () => {
      cal = removeBillFromCalendar(inv!.id);
      r = useFin.getState().delInvoice(inv!.id);
      void cancelBillReminders(inv!.id);
      go('lifefinance');
    }, () => {
      if (r) useFin.getState().restoreInvoice(r.inv, r.at);
      restoreBillEvents(cal);
      void refreshBillReminders();
    }, { undoMessage: 'Bolletta eliminata (il file resta in LifeDrive)' });
  }

  function doSplit() {
    const first = inputToIso(splitFirst);
    if (!first) { toast(t('Data non valida: usa gg/mm/aaaa')); return; }
    const prev = inv!.installments;
    const ins = splitInstallments(inv!.amount, splitN, first);
    f.patchInvoice(inv!.id, { installments: ins }, `Rateizzata in ${splitN} rate`);
    setSplitSheet(false);
    showUndoToast(t('Rateizzazione impostata'), () => f.patchInvoice(inv!.id, { installments: prev }, 'Rateizzazione annullata'));
  }

  const dueLabel = nd ? `${fmtDay(nd)}${dd != null && open ? ` · ${dueText(dd)}` : ''}` : undefined;

  return (
    <Page id="billDetail" title={inv.issuer} back>
      <Card accent={status === 'scaduta' ? th.danger : undefined}>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Body small muted>{t(KIND_LABEL[inv.kind])}{inv.number ? ` · n. ${inv.number}` : ''}</Body>
            <StatusPill status={status} />
          </View>
          <Metric>{money(inv.state === 'paid' ? inv.paidAmount ?? inv.amount : left || inv.amount, inv.currency)}</Metric>
        </Row>
        {inv.installments?.length ? <Body small muted style={{ marginTop: 6 }}>{t('Totale {0} in {1} rate · ancora da pagare {2}', money(inv.amount, inv.currency), inv.installments.length, money(left, inv.currency))}</Body> : null}
        {open && dueLabel ? <Body bold style={{ marginTop: 8 }} color={dd != null && dd < 0 ? th.danger : th.text}>{t('Scadenza')}: {dueLabel}</Body> : null}
        {inv.state === 'paid' ? <Body small muted style={{ marginTop: 8 }}>{t('Pagata il {0}', fmtDay(inv.paidAt))}</Body> : null}
        {cost != null && cost > 0 ? <Note icon="alert" tone="danger">{t('Costo del ritardo stimato: {0}', money(cost, inv.currency))}</Note> : null}
        {open && !nd ? <Note icon="alert" tone="warn">{t('Manca la scadenza: aggiungila con «Modifica» per avere piano e promemoria.')}</Note> : null}
        {inv.estimated ? <Note icon="info">{t('Scadenza stimata dalla ricorrenza. Quando arriva il documento vero, aggiorna importo e data con «Modifica».')}</Note> : null}
        {(inv.reminderLevel ?? 0) > 0 ? <Note icon="alert" tone="warn">{t('Documento di sollecito (livello {0}): paga il prima possibile.', inv.reminderLevel ?? 0)}</Note> : null}
      </Card>

      {open && (
        <Card>
          <Btn icon="check" title={inv.installments?.length ? 'Segna una rata come pagata' : 'Segna come pagata'} onPress={() => openPay(inv.installments?.length ? inv.installments.findIndex((x) => !x.paidAt) : undefined)} />
          <Row style={{ marginTop: 8 }}>
            <Btn small ghost style={{ flex: 1 }} icon="edit" title="Modifica" onPress={() => go('billReview', { id: inv.id, k: String(Date.now()) })} />
            <Btn small ghost style={{ flex: 1 }} icon="info" title={inv.state === 'open' ? 'Contestata' : 'Aperta'} onPress={() => { const prev = inv.state; f.patchInvoice(inv.id, { state: 'disputed' }, 'Segnata come contestata'); showUndoToast(t('Segnata come contestata'), () => f.patchInvoice(inv.id, { state: prev }, 'Contestazione annullata')); }} />
          </Row>
        </Card>
      )}
      {inv.state === 'disputed' && (
        <Card>
          <Body small muted>{t('Contestata: non genera promemoria né entra nel piano finché non la riapri.')}</Body>
          <Row style={{ marginTop: 8 }}>
            <Btn small style={{ flex: 1 }} title="Riapri" onPress={() => f.patchInvoice(inv.id, { state: 'open' }, 'Riaperta')} />
            <Btn small ghost style={{ flex: 1 }} icon="edit" title="Modifica" onPress={() => go('billReview', { id: inv.id, k: String(Date.now()) })} />
          </Row>
        </Card>
      )}
      {inv.state === 'paid' && (
        <Card>
          <Row>
            <Btn small ghost style={{ flex: 1 }} icon="edit" title="Modifica" onPress={() => go('billReview', { id: inv.id, k: String(Date.now()) })} />
            <Btn small ghost style={{ flex: 1 }} title="Segna come non pagata" onPress={() => { const prev = inv; f.patchInvoice(inv.id, { state: 'open', paidAt: undefined, paidAmount: undefined }, 'Riaperta: non pagata'); showUndoToast(t('Riaperta'), () => f.patchInvoice(inv.id, { state: prev.state, paidAt: prev.paidAt, paidAmount: prev.paidAmount }, 'Riapertura annullata')); }} />
          </Row>
        </Card>
      )}

      {open && dues.length > 0 && (
        <Card>
          <H>{t('Piano di pagamento')}</H>
          <PlanList plan={plan} filterId={inv.id} />
        </Card>
      )}

      {inv.installments?.length ? (
        <Card>
          <H>{t('Rate')}</H>
          {inv.installments.map((x, i) => {
            const late = !x.paidAt && diffDays(today, x.dueDate) < 0;
            return (
              <Item key={i} last={i === inv.installments!.length - 1}>
                <Row>
                  <View style={{ flex: 1 }}>
                    <Body>{t('Rata {0} di {1}', i + 1, inv.installments!.length)} · {money(x.amount, inv.currency)}</Body>
                    <Body small color={x.paidAt ? th.positive : late ? th.danger : th.muted}>{x.paidAt ? t('Pagata il {0}', fmtDay(x.paidAt)) : `${fmtDay(x.dueDate)} · ${dueText(diffDays(today, x.dueDate))}`}</Body>
                  </View>
                  {!x.paidAt && open ? <Btn small ghost title="Pagata" onPress={() => openPay(i)} /> : null}
                </Row>
              </Item>
            );
          })}
          {open && !inv.installments.some((x) => x.paidAt) ? <Btn small ghost style={{ marginTop: 8, alignSelf: 'flex-start' }} title="Annulla rateizzazione" onPress={() => { const prev = inv.installments; f.patchInvoice(inv.id, { installments: undefined }, 'Rateizzazione annullata'); showUndoToast(t('Rateizzazione annullata'), () => f.patchInvoice(inv.id, { installments: prev }, 'Rateizzazione ripristinata')); }} /> : null}
        </Card>
      ) : open && inv.amount >= 100 ? (
        <Card>
          <Row>
            <View style={{ flex: 1 }}><Body bold>{t('Importo alto?')}</Body><Body small muted>{t('Se hai concordato una rateizzazione, dividila in rate mensili.')}</Body></View>
            <Btn small ghost icon="repeat" title="Rateizza" onPress={() => { setSplitFirst(isoToInput(inv.dueDate ?? today)); setSplitSheet(true); }} />
          </Row>
        </Card>
      ) : null}

      <Card>
        <H>{t('Promemoria e calendario')}</H>
        <Toggle label="Ricordami la scadenza" value={inv.remind} onChange={(v) => f.patchInvoice(inv.id, { remind: v }, v ? 'Promemoria attivati' : 'Promemoria disattivati')} />
        {open && <Toggle label="Aggiungi la scadenza al calendario" hint="Evento ambra nel Plan" value={inCal} onChange={toggleCalendar} />}
        {open && inv.remind && f.billPrefs.on ? (
          reminders.length ? reminders.slice(0, 8).map((r, i) => {
            const d = new Date(r.at);
            return (
              <Item key={r.id} last={i === Math.min(reminders.length, 8) - 1}>
                <Body small bold>{fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Body>
                <Body small muted>{r.body}</Body>
              </Item>
            );
          }) : <Body small muted>{t('Nessun promemoria futuro da programmare.')}</Body>
        ) : <Body small muted>{f.billPrefs.on ? t('Promemoria disattivati per questa bolletta.') : t('I promemoria sono spenti nelle impostazioni delle finanze.')}</Body>}
        <Body small muted style={{ marginTop: 6 }}>{t('Le notifiche partono dal telefono, senza server. Per scegliere i momenti e l\'ora: Finanze > Bollette > Promemoria.')}</Body>
      </Card>

      <Card>
        <H>{t('Dati')}</H>
        <DataRow label="Tipo" value={t(KIND_LABEL[inv.kind])} />
        <DataRow label="Data del documento" value={inv.issueDate ? fmtDay(inv.issueDate) : undefined} />
        <DataRow label="Scadenza" value={inv.dueDate ? fmtDay(inv.dueDate) : undefined} />
        <DataRow label="Periodo" value={inv.periodFrom && inv.periodTo ? `${fmtDay(inv.periodFrom)} – ${fmtDay(inv.periodTo)}` : undefined} />
        <DataRow label="Si ripete" value={rec ? t(rec) : undefined} />
        <DataRow label="IBAN" value={inv.iban} copy />
        <DataRow label="Riferimento" value={inv.reference} copy />
        <DataRow label="Codice avviso PagoPA" value={inv.pagopa} copy />
        <DataRow label="Penale di ritardo" value={inv.lateFee != null ? money(inv.lateFee, inv.currency) : undefined} />
        <DataRow label="Interesse di mora" value={inv.lateInterestPct != null ? `${inv.lateInterestPct}%` : undefined} />
        <DataRow label="Note" value={inv.notes} />
      </Card>

      {inv.fileUri ? (
        <Card>
          <Row>
            <View style={{ flex: 1 }}><H style={{ marginBottom: 0 }}>{t('Documento')}</H><Body small muted numberOfLines={2}>{inv.fileName ?? ''}</Body><Body small muted>{t('Sul telefono · LifeDrive, cartella «Bollette e fatture»')}</Body></View>
            <Btn small ghost icon="file" title="Apri" onPress={() => { if (img) setZoom(true); else if (!openBillFile({ uri: inv.fileUri!, name: inv.fileName ?? 'Documento' })) toast(t('Impossibile aprire il file')); }} />
          </Row>
          {img ? <Image source={{ uri: inv.fileUri }} resizeMode="contain" accessibilityLabel={t('Anteprima del documento')} style={{ width: '100%', height: 160, marginTop: 10, borderRadius: 12, backgroundColor: th.tile }} /> : null}
        </Card>
      ) : null}

      <Card>
        <H>{t('Cronologia')}</H>
        {inv.history.slice().reverse().map((h, i, a) => (
          <Item key={i} last={i === a.length - 1}>
            <Body small>{h.text}</Body>
            <Body small muted>{dt(h.at)}</Body>
          </Item>
        ))}
      </Card>

      <Btn ghost danger icon="trash" title="Elimina" onPress={remove} />

      <Sheet visible={!!paySheet} title="Segna come pagata" onClose={() => setPaySheet(null)}>
        <Body small muted style={{ marginBottom: 8 }}>{paySheet?.installment != null ? t('Rata {0} di {1}', paySheet.installment + 1, inv.installments?.length ?? 1) : inv.issuer}</Body>
        <Body small bold style={{ marginBottom: 4 }}>Data del pagamento</Body>
        <Input value={payDate} onChangeText={setPayDate} placeholder="gg/mm/aaaa" keyboardType="numbers-and-punctuation" />
        <Body small bold style={{ marginBottom: 4 }}>Importo pagato</Body>
        <Input value={payAmount} onChangeText={setPayAmount} keyboardType="decimal-pad" placeholder="0,00" />
        <Toggle label="Registra come movimento" hint={canRecord ? 'Aggiunge un\'uscita al mese corrente (si può annullare). Se importi l\'estratto conto, lascia spento per non duplicare.' : 'Disponibile solo per importi nella tua valuta e nel mese corrente.'} value={payRecord && canRecord} onChange={(v) => canRecord && setPayRecord(v)} />
        {inv.recurrence && !inv.installments?.length ? <Note icon="repeat">{t('Si ripete {0}: creo la prossima scadenza stimata.', t(RECURRENCE_LABEL[inv.recurrence]).toLowerCase())}</Note> : null}
        <Btn style={{ marginTop: 14 }} title="Continua" onPress={confirmPay} />
      </Sheet>

      <Sheet visible={splitSheet} title="Rateizza" onClose={() => setSplitSheet(false)}>
        <Body small muted style={{ marginBottom: 8 }}>{t('Dividi {0} in rate mensili uguali. Ogni rata ha il suo promemoria.', money(inv.amount, inv.currency))}</Body>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {[2, 3, 4, 6, 12].map((n) => <Pill key={n} label={`${n} rate`} on={splitN === n} onPress={() => setSplitN(n)} />)}
        </View>
        <Body small bold style={{ marginTop: 10, marginBottom: 4 }}>Prima rata (gg/mm/aaaa)</Body>
        <Input value={splitFirst} onChangeText={setSplitFirst} placeholder="gg/mm/aaaa" keyboardType="numbers-and-punctuation" />
        {inputToIso(splitFirst) ? splitInstallments(inv.amount, splitN, inputToIso(splitFirst) as string).map((x, i) => (
          <Row key={i}><Body small muted>{t('Rata {0}: {1}', i + 1, fmtDay(x.dueDate))}</Body><Body small bold>{money(x.amount, inv.currency)}</Body></Row>
        )) : null}
        <Btn style={{ marginTop: 14 }} title="Imposta le rate" onPress={doSplit} />
      </Sheet>

      <Sheet visible={zoom} title="Documento" onClose={() => setZoom(false)}>
        {inv.fileUri ? <Image source={{ uri: inv.fileUri }} resizeMode="contain" style={{ width: '100%', height: 480 }} accessibilityLabel={t('Documento ingrandito')} /> : null}
      </Sheet>
    </Page>
  );
}
