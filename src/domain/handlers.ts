/**
 * Handler degli eventi di dominio, registrati UNA volta all'avvio (src/app/_layout.tsx -> registerDomainHandlers()).
 * Qui vivono gli effetti collaterali: riprogrammare promemoria, notifiche in-app, registro di uscita, manutenzione.
 * Le operazioni (operations.ts) e gli store non importano questo file: nessun ciclo.
 *
 * Ordine (order): 10 = coerenza dei dati, 50 = promemoria/notifiche di sistema, 90 = notifiche in-app e log.
 */
import { onInterviewAccepted } from '@/lib/interviewActions';
import { cancelBillReminders, refreshBillReminders } from '@/lib/bills/schedule';
import { log, errToString } from '@/lib/log';
import { refreshReminders } from '@/lib/notify';
import { buildRef } from '@/lib/notifyLinks';
import { logOutflow } from '@/lib/privacyGateApp';
import { t } from '@/i18n/core';
import { useNet } from '@/store/network';
import { startDomainBridge } from './bridge.ts';
import { on, registerModule, setErrorSink, type EventName } from './events.ts';
import { setOperationErrorSink } from './operation.ts';
import './stores';

const ALL: EventName[] = [
  'bill.created', 'bill.paid', 'bill.reopened', 'bill.deleted', 'event.added', 'event.updated', 'event.removed', 'task.completed', 'goal.progressed',
  'booking.confirmed', 'booking.cancelled', 'booking.attended', 'interview.accepted', 'club.subscribed', 'mood.logged', 'location.habit.detected', 'clock.changed', 'maintenance.due',
];

export function registerDomainHandlers() {
  registerModule('domain.sinks', () => {
    setErrorSink((e, w) => log.error('domain', `Handler fallito: ${w.event} (${w.module}:${w.handler})`, errToString(e)));
    setOperationErrorSink((name, step, e, rolled) => log.error('domain', `Operazione ${name} fallita al passo "${step}"${rolled.length ? `; ripristinato: ${rolled.join(', ')}` : ''}`, errToString(e)));
    // traccia di ogni evento nel log (livello debug)
    for (const ev of ALL) // solo il nome dell'evento e i campi: mai i valori (titoli, nomi) nel log
    on(ev, 'log', (p) => { log.debug('domain', ev, Object.keys(p ?? {}).join(',')); }, { order: 1, name: 'trace' });
  });

  registerModule('domain.bills', () => {
    on('bill.paid', 'bills', (p) => { void cancelBillReminders(p.id).then(() => refreshBillReminders()); }, { order: 50, name: 'riprogrammaPromemoria' });
    on('bill.reopened', 'bills', () => { void refreshBillReminders(); }, { order: 50, name: 'riprogrammaPromemoria' });
    on('bill.created', 'bills', () => { void refreshBillReminders(); }, { order: 50, name: 'riprogrammaPromemoria' });
    on('bill.deleted', 'bills', (p) => { void cancelBillReminders(p.id).then(() => refreshBillReminders()); }, { order: 50, name: 'riprogrammaPromemoria' });
  });

  registerModule('domain.reminders', () => {
    // impegni cambiati da qualunque schermata (ponte degli store): ricalcolo con debounce
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => { void refreshReminders(); }, 2500); };
    for (const ev of ['event.added', 'event.updated', 'event.removed'] as const) on(ev, 'reminders', later, { order: 50, name: 'riprogrammaPromemoria' });
    on('booking.confirmed', 'reminders', () => { void refreshReminders(); }, { order: 50, name: 'riprogrammaPromemoria' });
    on('booking.cancelled', 'reminders', () => { void refreshReminders(); }, { order: 50, name: 'riprogrammaPromemoria' });
    on('interview.accepted', 'reminders', () => { void refreshReminders(); }, { order: 60, name: 'riprogrammaPromemoria' });
    // fuso orario / ora legale: la riprogrammazione la esegue runMaintenance (background.ts); qui solo il segno nel log
    on('clock.changed', 'reminders', (p) => { log.info('notify', `Orologio cambiato (${p.reason}): notifiche da riprogrammare`); }, { order: 50, name: 'segnala' });
  });

  registerModule('domain.inapp', () => {
    // notifiche in-app silenziose (categoria Sistema): servono da traccia, non fanno rumore
    on('booking.confirmed', 'inapp', (p) => {
      if (p.restored) return;
      const text = p.kind === 'seminar' ? t('Iscrizione confermata: {0}', p.title) : t('Prenotazione confermata con {0}: {1}', p.host, p.title);
      useNet.getState().notify('system', text, false, { kind: 'sistema', ref: buildRef('booking', p.id) });
    }, { order: 90, name: 'notificaInApp' });
  });

  registerModule('domain.interview', () => {
    on('interview.accepted', 'interview', (p) => { onInterviewAccepted(p.appId); }, { order: 40, name: 'pianoENotifiche' });
  });

  registerModule('domain.privacy', () => {
    // l'iscrizione a un club e' un dato che raggiunge il creatore: solo metadati nel registro di uscita
    on('club.subscribed', 'privacy', () => { logOutflow('club_member', 'club', { explicit: true }); }, { order: 90, name: 'registroUscita' });
  });

  registerModule('domain.bridge', () => { startDomainBridge(); });
}
