/**
 * Motore dell'assistente: capisce una richiesta in italiano, chiede ciò che manca (dialogo a più turni),
 * esegue l'azione sull'app e permette di annullarla. NESSUNA AI e nessuna chiamata di rete: solo regole.
 * È indipendente dall'app (usa un `Env` iniettato), così si prova con test automatici.
 */
import { freeSlots, fmtMin, toMin } from '../availability.ts';
import { travelWarnings } from '../places.ts';
import { skippedWork } from '../reschedule.ts';
import { planMonth, pickSlot, keyOf, type PlanItem } from '../planner.ts';
import { nextActionText, rankTasks } from '../priority.ts';
import { bestMatch, isDelegate, dayKeyOf, dayLabel, detectIntent, extractTitle, isNo, isYes, norm, pageNames, parseWhen, addDaysTo, type Intent, type When } from './nlp.ts';

export type Ev = { time: string; title: string; dur?: number; important?: boolean; place?: string; ref?: string };
export type TaskLite = { id: string; t: string; done?: boolean; urgent?: boolean; due?: string };

export interface Env {
  now(): Date;
  events(): Record<string, Ev[]>;
  addEvent(day: string, ev: Ev): void;
  delEvent(day: string, ev: Ev): void;
  tasks(): TaskLite[];
  addTask(t: string): string;
  setTaskDone(id: string, v: boolean): void;
  delTask(id: string): TaskLite | null;
  restoreTask(t: TaskLite): void;
  renameTask(id: string, t: string): void;
  addNote(text: string): void;
  addGoal(t: string): void;
  logMood(m: string): void;
  workHours(): { start: string; end: string };
  setWorkHours(start: string, end: string): void;
  setDark(dark: boolean): void;
  setNotifications(on: boolean): void;
  setPrivateProfile(on: boolean): void;
  isPrivateProfile(): boolean;
  pickProfilePhoto(): Promise<boolean>;
  financeReport(): string;
  healthReport(): string;
  moodReport(): string;
  /** manda davvero l'agenda in chat; ritorna il testo di conferma o null se non trova la persona / non c'è nulla */
  shareAgenda(person: string, range: 'oggi' | 'domani' | '7 giorni', mode: 'liberi' | 'occupato' | 'dettagli'): string | null;
  people(): string[];
  setTaskUrgent(id: string, v: boolean): void;
  setEventImportant(day: string, ev: Ev, v: boolean): void;
  setTaskDue(id: string, day: string | undefined): void;
  /** crea un impegno che si ripete (settimanale o giornaliero) fino a `until`; ritorna il riferimento per annullare */
  addRecurring(day: string, ev: Ev, until: string, kind: 'weekly' | 'daily'): string;
  delByRef(ref: string): void;
  briefing(): { title: string; body: string };
  userName(): string;
}

export type Reply = { text: string; chips?: string[]; navigate?: string; handled: boolean };

type Pending =
  | { kind: 'resched.confirm'; moves: { from: { day: string; ev: Ev }; to: { day: string; time: string } }[] }
  | { kind: 'event.add'; recur?: 'weekly' | 'daily'; place?: string; title: string; day?: string; time?: string; dur: number; hint?: When['hint']; awaiting: 'title' | 'day' | 'time' | 'conflict'; conflicts?: { day: string; ev: Ev }[]; replacing?: { day: string; ev: Ev } }
  | { kind: 'event.move'; target: { day: string; ev: Ev }; day?: string; time?: string; dur: number; awaiting: 'when' }
  | { kind: 'confirm.photo' }
  | { kind: 'plan.confirm'; items: PlanItem[]; keep: number; scope: string }
  | { kind: 'share.agenda'; range: 'oggi' | 'domani' | '7 giorni'; mode: 'liberi' | 'occupato' | 'dettagli' }
  | { kind: 'add.suggest'; title: string };

const DEF_DUR = 60;
const pad = (n: number) => String(n).padStart(2, '0');

export class Assistant {
  private _pending: Pending | null = null;
  private pendingAt = 0;
  private misses = 0;
  private lastTask: string | null = null;
  private lastEv: { day: string; ev: Ev } | null = null;
  get pending(): Pending | null { return this._pending; }
  set pending(v: Pending | null) { this._pending = v; this.pendingAt = Date.now(); this.misses = 0; }
  /** dopo 3 risposte non capite la domanda in sospeso cade, così non si resta bloccati in un giro */
  private miss(): boolean { this.misses++; if (this.misses >= 3) { this._pending = null; this.misses = 0; return true; } return false; }
  private undo: { label: string; run: () => void }[] = [];
  private env: Env;
  constructor(env: Env) { this.env = env; }

  /* ---------- utilità ---------- */
  private today() { return dayKeyOf(this.env.now()); }
  private label(day: string) { return dayLabel(day, this.env.now()); }
  private evs(day: string) { return (this.env.events()[day] ?? []).slice().sort((a, b) => a.time.localeCompare(b.time)); }
  private conflictsAt(day: string, time: string, dur: number, ignore?: Ev): { day: string; ev: Ev }[] {
    const s = toMin(time), e = s + dur;
    return this.evs(day).filter((x) => x !== ignore && !(ignore && x.time === ignore.time && x.title === ignore.title)).filter((x) => { const a = toMin(x.time); return a < e && s < a + (x.dur || DEF_DUR); }).map((ev) => ({ day, ev }));
  }
  private slotChips(day: string, dur: number, hint?: When['hint']): string[] {
    const wh = this.env.workHours();
    const now = this.env.now();
    const from = day === this.today() ? now.getHours() * 60 + Math.ceil(now.getMinutes() / 30) * 30 : 0;
    const spans = freeSlots(this.evs(day), wh.start, wh.end, Math.max(30, dur), DEF_DUR, from);
    const out: string[] = [];
    spans.forEach((sp) => {
      for (let m = Math.ceil(sp.from / 30) * 30; m + dur <= sp.to; m += 60) {
        const h = Math.floor(m / 60);
        if (hint === 'mattina' && h >= 12) continue;
        if (hint === 'pomeriggio' && (h < 12 || h >= 18)) continue;
        if (hint === 'sera' && h < 18) continue;
        out.push(fmtMin(m));
      }
    });
    return out.slice(0, 5);
  }
  private pushUndo(label: string, run: () => void) { this.undo.push({ label, run }); if (this.undo.length > 20) this.undo.shift(); }
  private upcoming(): { day: string; ev: Ev }[] {
    const t = this.today();
    return Object.entries(this.env.events()).filter(([d]) => d >= t).flatMap(([day, list]) => list.map((ev) => ({ day, ev }))).sort((a, b) => (a.day + a.ev.time).localeCompare(b.day + b.ev.time));
  }
  private dayChips() {
    const now = this.env.now();
    return ['Oggi', 'Domani', 'Dopodomani', ...[3, 4].map((n) => { const d = addDaysTo(now, n); return ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'][d.getDay()]; })];
  }

  /* ---------- ingresso ---------- */
  async handle(text: string): Promise<Reply> {
    const raw = text.trim();
    if (!raw) return { text: 'Scrivimi cosa vuoi fare: per esempio "aggiungi riunione al piano domani alle 15".', handled: true };
    if (this._pending && Date.now() - this.pendingAt > 15 * 60000) this._pending = null; // domanda vecchia: non resta appesa
    // scorciatoia: "metti nel piano" dopo aver parlato di un task
    if (this.lastTask && /^(metti|aggiungi|inserisci)( questo| il task| lo)?( nel| al| in)? piano$/.test(norm(raw))) {
      this.pending = { kind: 'event.add', title: `Lavoro su: ${this.lastTask}`, dur: DEF_DUR, awaiting: 'day' };
      return this.progressAdd();
    }
    // 1) risposta a una domanda in sospeso
    if (this.pending) {
      const r = await this.continuePending(raw);
      if (r) return r;
    }
    const nn = norm(raw);
    if (/^(ciao|salve|hey|ehi|buongiorno|buonasera|buon pomeriggio)\b/.test(nn) && nn.split(' ').length <= 3) return { handled: true, text: `Ciao${this.env.userName() ? ' ' + this.env.userName() : ''}! Dimmi cosa vuoi fare: piano, task, note, report o una domanda sui tuoi dati.`, chips: ['Cosa devo fare adesso?', 'Che impegni ho oggi?', 'Aiuto'] };
    if (/^(grazie|ok grazie|perfetto|ottimo|bene|ok)\b/.test(nn) && nn.split(' ').length <= 3) return { handled: true, text: 'Di niente! Se ti serve altro, sono qui.', chips: ['Cosa devo fare adesso?'] };
    if ((isYes(raw) || isNo(raw)) && !this.pending && !/^(annulla|disfa|ripristina|torna indietro)/.test(nn)) return { handled: true, text: 'Al momento non ho nulla in sospeso. Dimmi cosa vuoi fare.', chips: ['Aiuto'] };
    // 2) nuovo comando
    const intent = detectIntent(raw);
    switch (intent) {
      case 'undo': return this.doUndo();
      case 'plan.fill': return this.planFill(raw);
      case 'plan.reschedule': return this.reschedule();
      case 'briefing': return { handled: true, text: (() => { const b = this.env.briefing(); return `${b.title}\n${b.body}`; })(), chips: ['Cosa devo fare adesso?', 'Pianificami il mese'] };
      case 'event.recurring': return this.startEventAdd(raw, true);
      case 'event.when': return this.eventWhen(raw);
      case 'task.due': return this.taskDue(raw);
      case 'task.next': return this.taskNext();
      case 'task.urgent': return this.taskUrgent(raw);
      case 'event.important': return this.eventImportant(raw);
      case 'event.add': return this.startEventAdd(raw);
      case 'event.move': return this.startEventMove(raw);
      case 'event.delete': return this.eventDelete(raw);
      case 'event.rename': return this.eventRename(raw);
      case 'agenda.show': return this.agendaShow(raw);
      case 'agenda.free': return this.agendaFree(raw);
      case 'agenda.share': return this.agendaShare(raw);
      case 'task.add': return this.taskAdd(raw);
      case 'task.done': return this.taskDone(raw);
      case 'task.delete': return this.taskDelete(raw);
      case 'task.rename': return this.taskRename(raw);
      case 'task.list': return this.taskList();
      case 'note.add': return this.noteAdd(raw);
      case 'goal.add': return this.goalAdd(raw);
      case 'mood.log': return this.moodLog(raw);
      case 'mood.analysis': return { handled: true, text: this.env.moodReport(), chips: ['Apri analisi umore'], navigate: undefined };
      case 'profile.photo': return this.profilePhoto();
      case 'profile.private': return this.setPrivate(true);
      case 'profile.public': return this.setPrivate(false);
      case 'finance.report': return { handled: true, text: this.env.financeReport(), chips: ['Apri Finanze', 'Come risparmiare?'] };
      case 'health.report': return { handled: true, text: this.env.healthReport(), chips: ['Apri Salute'] };
      case 'theme.dark': this.env.setDark(true); this.pushUndo('tema', () => this.env.setDark(false)); return { handled: true, text: 'Fatto: ora l’app è in modalità scura.', chips: ['Annulla'] };
      case 'theme.light': this.env.setDark(false); this.pushUndo('tema', () => this.env.setDark(true)); return { handled: true, text: 'Fatto: ora l’app è in modalità chiara.', chips: ['Annulla'] };
      case 'hours.set': return this.hoursSet(raw);
      case 'notif.on': this.env.setNotifications(true); return { handled: true, text: 'Notifiche attivate.', chips: ['Annulla'] };
      case 'notif.off': this.env.setNotifications(false); return { handled: true, text: 'Notifiche disattivate.', chips: ['Annulla'] };
      case 'open': return this.open(raw);
      case 'help': return this.help();
      default: return this.fallback(raw);
    }
  }

  /* ---------- risposte a domande in sospeso ---------- */
  private async continuePending(raw: string): Promise<Reply | null> {
    const p = this.pending!;
    const n = norm(raw);
    if (isNo(raw) && !/\bcambia|sposta\b/.test(n)) { this.pending = null; return { handled: true, text: 'Va bene, lascio stare.' }; }
    // un comando chiaramente diverso interrompe la domanda in sospeso (la richiesta di prima resta annullata)
    {
      const w0 = parseWhen(raw, this.env.now());
      const answerish = !!(w0.day || w0.time) || /^\d{1,2}([:.]\d{2})?$/.test(n) || isYes(raw) || /\b(cambia|sposta|tieni|ora|giorno|entrambi)\b/.test(n);
      if ((p.kind === 'event.add' || p.kind === 'event.move') && !answerish && !(p.kind === 'event.add' && p.awaiting === 'title') && detectIntent(raw) !== 'unknown') { this.pending = null; return null; }
    }
    if (isDelegate(raw)) {
      if (p.kind === 'event.add' && p.awaiting !== 'title') return this.delegateAdd(p, raw);
      if (p.kind === 'event.move') {
        const slot = this.choose(p.dur, false, p.target.day);
        if (!slot) return { handled: true, text: 'Non trovo uno slot libero nei prossimi giorni: dimmi tu quando.' };
        p.day = slot.day; p.time = slot.time; return this.commitMove();
      }
    }
    if (p.kind === 'plan.confirm') return this.planAnswer(p, raw);
    if (p.kind === 'resched.confirm') return this.reschedAnswer(p, raw);
    if (p.kind === 'share.agenda') return this.shareAnswer(p, raw);
    if (p.kind === 'add.suggest') {
      const n2 = norm(raw);
      if (/task|lista|da fare/.test(n2)) { const id = this.env.addTask(p.title); this.lastTask = p.title; this.pending = null; this.pushUndo('nuovo task', () => this.env.delTask(id)); return { handled: true, text: `Aggiunto il task «${p.title}».`, chips: ['Annulla', 'Metti nel piano'] }; }
      if (/piano|calendario|agenda|impegno/.test(n2) || isYes(raw)) { this.pending = { kind: 'event.add', title: p.title, dur: DEF_DUR, awaiting: 'day' }; return this.progressAdd(); }
      this.pending = null; return null;
    }
    if (p.kind === 'event.add') {
      const w = parseWhen(raw, this.env.now());
      if (p.awaiting === 'title') { p.title = raw.replace(/[?!.]+$/, '').trim(); p.title = p.title.charAt(0).toUpperCase() + p.title.slice(1); return this.progressAdd(); }
      if (p.awaiting === 'day') {
        const chip = /^oggi$/.test(n) ? this.today() : /^domani$/.test(n) ? dayKeyOf(addDaysTo(this.env.now(), 1)) : undefined;
        const day = chip ?? w.day;
        if (!day) { if (this.miss()) return null; return { handled: true, text: 'Non ho capito il giorno. Dimmi per esempio "domani", "venerdì" o "il 15".', chips: this.dayChips() }; }
        p.day = day; if (w.time) p.time = w.time; if (w.durationMin) p.dur = w.durationMin; if (w.hint) p.hint = w.hint;
        return this.progressAdd();
      }
      if (p.awaiting === 'time') {
        const bare = /^(\d{1,2})([:.]\d{2})?$/.exec(n);
        let time = w.time;
        if (!time && bare) { let h = Number(bare[1]); if (h >= 1 && h <= 7) h += 12; time = `${pad(h)}:${bare[2] ? bare[2].slice(1) : '00'}`; }
        if (!time) { if (this.miss()) return null; return { handled: true, text: 'Dimmi l’ora, per esempio "15:30" o "alle 10". Oppure scrivi "scegli tu" e la scelgo io.', chips: this.slotChips(p.day!, p.dur, p.hint) }; }
        p.time = time; if (w.durationMin) p.dur = w.durationMin; if (w.day) p.day = w.day;
        return this.progressAdd();
      }
      if (p.awaiting === 'conflict') return this.resolveConflict(raw, w);
    }
    if (p.kind === 'event.move') {
      const w = parseWhen(raw, this.env.now());
      const bare = /^(\d{1,2})([:.]\d{2})?$/.exec(n);
      let time = w.time;
      if (!time && bare) { let h = Number(bare[1]); if (h >= 1 && h <= 7) h += 12; time = `${pad(h)}:${bare[2] ? bare[2].slice(1) : '00'}`; }
      if (!w.day && !time) { if (this.miss()) return null; return { handled: true, text: 'Dimmi a quando lo sposto: per esempio "venerdì alle 11", oppure "scegli tu".', chips: this.slotChips(p.target.day, p.dur) }; }
      p.day = w.day ?? p.day ?? p.target.day; p.time = time ?? p.time ?? p.target.ev.time;
      return this.commitMove();
    }
    return null;
  }

  /* ---------- aggiungere al piano ---------- */
  /** "riunione a Zurigo domani" -> luogo "Zurigo". Cerca "a/presso/in" + Maiuscola, oppure luoghi comuni (ufficio, casa, online). */
  private splitPlace(raw: string): { text: string; place?: string } {
    const m = /\b(?:a|presso|in|da)\s+((?:[A-ZÀ-Ý][\p{L}'.-]+)(?:\s+[A-ZÀ-Ý][\p{L}'.-]+){0,2})(?=\s|[?.!,]|$)/u.exec(raw) ?? /\b(?:in|a|da)\s+(ufficio|casa|online|studio|palestra|sede)\b/i.exec(raw);
    if (!m) return { text: raw };
    const place = m[1].replace(/\.$/, '');
    const first = raw.slice(0, m.index).trim();
    // se il "luogo" è l'inizio della frase (es. "A Marco dico...") non lo tratto come luogo
    if (!first && /^[a-zà-ÿ]/.test(m[1]) === false && /^(a|in|da)\b/i.test(raw)) return { text: raw };
    return { text: (raw.slice(0, m.index) + ' ' + raw.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim(), place: place.charAt(0).toUpperCase() + place.slice(1) };
  }

  private startEventAdd(raw0: string, recurring = false): Reply {
    const { text: raw, place } = this.splitPlace(raw0);
    const w = parseWhen(raw, this.env.now());
    const title = extractTitle(raw, w.spans, /\b(aggiungi|metti|inserisci|segna|programma|pianifica|fissa|prenota|crea|organizza|ogni|tutti|tutte|i|le|giorni|giorno|settimana|settimane|sera|mattina|pomeriggio|al piano|nel piano|ho)\b/g);
    const recur = recurring ? (/\bogni (giorno|sera|mattina|pomeriggio)\b|\btutti i giorni\b|\btutte le (sere|mattine)\b/.test(norm(raw)) ? 'daily' : 'weekly') : undefined;
    let day = w.day;
    if (recur === 'daily' && !day) day = this.today();
    this.pending = { kind: 'event.add', title, day, time: w.time, dur: w.durationMin ?? DEF_DUR, hint: w.hint, awaiting: 'title', recur, place };
    return this.progressAdd();
  }

  private progressAdd(): Reply {
    const p = this.pending as Extract<Pending, { kind: 'event.add' }>;
    if (!p.title) { p.awaiting = 'title'; return { handled: true, text: 'Come lo chiamo? Dimmi il titolo dell’impegno.' }; }
    if (!p.day) { p.awaiting = 'day'; return { handled: true, text: `Per quale giorno aggiungo «${p.title}»?`, chips: this.dayChips() }; }
    if (!p.time) {
      p.awaiting = 'time';
      const chips = this.slotChips(p.day, p.dur, p.hint);
      const lab = this.label(p.day);
      if (!chips.length) return { handled: true, text: `${lab[0].toUpperCase() + lab.slice(1)} non vedo slot liberi nel tuo orario di lavoro. Dimmi tu l'ora oppure scegli un altro giorno.`, chips: ['Cambia giorno'] };
      return { handled: true, text: `Quando lo aggiungo? ${lab[0].toUpperCase() + lab.slice(1)} ho questi slot liberi: ${chips.join(', ')}. Scegline uno o scrivi un orario.`, chips };
    }
    const conflicts = this.conflictsAt(p.day, p.time, p.dur, p.replacing?.ev);
    if (conflicts.length) {
      p.awaiting = 'conflict'; p.conflicts = conflicts;
      const c = conflicts[0];
      return { handled: true, text: `${this.label(p.day)[0].toUpperCase() + this.label(p.day).slice(1)} alle ${c.ev.time} hai già «${c.ev.title}». Cosa preferisci?`, chips: ['Cambia giorno', 'Cambia ora', `Sposta «${c.ev.title}»`, 'Tieni entrambi', 'Annulla'] };
    }
    return this.commitAdd();
  }

  private resolveConflict(raw: string, w: When): Reply | null {
    const p = this.pending as Extract<Pending, { kind: 'event.add' }>;
    const n = norm(raw);
    if (/tieni entrambi|entrambi|lo stesso|comunque|insieme|aggiungi lo stesso/.test(n)) return this.commitAdd();
    if (/^cambia giorno|altro giorno|un altro giorno/.test(n)) { p.day = undefined; p.time = undefined; p.awaiting = 'day'; return this.progressAdd(); }
    if (/^cambia ora|cambia orario|altro orario|un altro orario/.test(n)) { p.time = undefined; p.awaiting = 'time'; return this.progressAdd(); }
    if (/\bsposta\b/.test(n)) {
      const c = p.conflicts![0];
      // sposta quello esistente alla prima ora libera dello stesso giorno (dopo la fine del nuovo impegno), o chiede quando
      if (w.day || w.time) return this.moveExistingThenAdd(c, w);
      const after = freeSlots(this.evs(c.day).filter((x) => x !== c.ev), this.env.workHours().start, this.env.workHours().end, DEF_DUR, DEF_DUR, toMin(p.time!) + p.dur)[0];
      if (after) return this.moveExistingThenAdd(c, { spans: [], day: c.day, time: fmtMin(after.from) });
      return { handled: true, text: `Non vedo uno slot libero dopo quel giorno. Dimmi quando sposto «${c.ev.title}» (es. "venerdì alle 11").` };
    }
    if (w.day || w.time) { if (w.day) p.day = w.day; if (w.time) p.time = w.time; return this.progressAdd(); }
    if (this.miss()) return null;
    return { handled: true, text: 'Scegli un’opzione: cambiare giorno, cambiare ora, spostare l’altro impegno, tenerli entrambi oppure scrivi "scegli tu".', chips: ['Cambia giorno', 'Cambia ora', `Sposta «${p.conflicts![0].ev.title}»`, 'Tieni entrambi', 'Annulla'] };
  }

  private moveExistingThenAdd(c: { day: string; ev: Ev }, w: When): Reply {
    const p = this.pending as Extract<Pending, { kind: 'event.add' }>;
    const newDay = w.day ?? c.day, newTime = w.time ?? c.ev.time;
    this.env.delEvent(c.day, c.ev);
    this.env.addEvent(newDay, { time: newTime, title: c.ev.title });
    const moved = { day: newDay, ev: { time: newTime, title: c.ev.title } };
    const undoMove = () => { this.env.delEvent(moved.day, moved.ev); this.env.addEvent(c.day, c.ev); };
    const added = this.commitAdd(true);
    this.pushUndo('spostamento', undoMove);
    return { handled: true, text: `Ho spostato «${c.ev.title}» a ${this.label(newDay)} alle ${newTime} e aggiunto «${p.title}» ${this.label(p.day!)} alle ${p.time}.`, chips: ['Annulla'], navigate: undefined, ...(added.chips ? {} : {}) };
  }

  private commitAdd(silent = false): Reply {
    const p = this.pending as Extract<Pending, { kind: 'event.add' }>;
    const ev: Ev = { time: p.time!, title: p.title, dur: p.dur, ...(p.place ? { place: p.place } : {}) };
    const day = p.day!;
    const warns = p.place ? travelWarnings(this.evs(day).map((e) => ({ time: e.time, title: e.title, dur: e.dur, place: e.place })), { time: ev.time, title: ev.title, dur: ev.dur, place: ev.place }) : [];
    if (p.recur) {
      const until = dayKeyOf(addDaysTo(new Date(day + 'T00:00:00'), p.recur === 'daily' ? 30 : 90));
      const ref = this.env.addRecurring(day, ev, until, p.recur);
      this.pushUndo('impegno ricorrente', () => this.env.delByRef(ref));
      this.pending = null;
      this.lastEv = { day, ev };
      const end0 = fmtMin(toMin(ev.time) + p.dur);
      return { handled: true, text: `Fatto: «${ev.title}» ${p.recur === 'daily' ? 'ogni giorno' : `ogni ${this.label(day).split(' ')[0]}`} dalle ${ev.time} alle ${end0}${p.recur === 'daily' ? ' per 30 giorni' : ' per circa 3 mesi'}${p.place ? ` a ${p.place}` : ''}. Per togliere tutta la serie scrivi "annulla".`, chips: ['Annulla', 'Apri il piano'] };
    }
    this.env.addEvent(day, ev);
    this.pushUndo('aggiunta al piano', () => this.env.delEvent(day, ev));
    this.pending = null;
    this.lastEv = { day, ev };
    const end = fmtMin(toMin(ev.time) + p.dur);
    if (silent) return { handled: true, text: '' };
    return { handled: true, text: `Fatto: «${ev.title}» ${this.label(day)} dalle ${ev.time} alle ${end}${p.place ? ` a ${p.place}` : ''}. Lo trovi nel Plan.${warns.length ? '\nAttenzione: ' + warns.join(' ') : ''}`, chips: ['Annulla', 'Apri il piano'] };
  }

  /* ---------- spostare / eliminare / rinominare ---------- */
  private findEvent(raw: string): { day: string; ev: Ev } | null {
    const w = parseWhen(raw, this.env.now());
    const list = this.upcoming();
    const q = extractTitle(raw, w.spans, /\b(sposta|rimanda|anticipa|posticipa|cambia|elimina|cancella|togli|rimuovi|rinomina|impegno|evento|appuntamento|riunione|dal piano)\b/g) || raw;
    const byDay = w.day ? list.filter((x) => x.day === w.day) : list;
    const hit = bestMatch(q, byDay.length ? byDay : list, (x) => x.ev.title);
    if (hit) { this.lastEv = hit; return hit; }
    // "spostala", "cancellalo", "quella riunione": mi riferisco all'ultimo impegno di cui abbiamo parlato
    const le = this.lastEv;
    if (le && /\b(la|lo|l|quella|quello|questa|questo|stessa|stesso|ultima|ultimo)\b|(a|o|e)$|\b\w+(la|lo)\b/.test(norm(raw)) && (this.env.events()[le.day] ?? []).some((e) => e.time === le.ev.time && e.title === le.ev.title)) return le;
    return null;
  }

  private startEventMove(raw: string): Reply {
    const target = this.findEvent(raw);
    if (!target) return { handled: true, text: 'Non trovo quell’impegno nel piano. Dimmi il nome com’è scritto, per esempio "sposta Meeting team a venerdì alle 11".' };
    const w = parseWhen(raw.replace(/.*?\b(?:a|al|alle|per|su|verso)\b/i, ' $& ').slice(0), this.env.now());
    // la data/ora nuova è quella dopo "a/al/alle" se presente; altrimenti quella trovata nella frase
    const w2 = parseWhen(raw, this.env.now());
    const day = w2.day ?? w.day, time = w2.time ?? w.time;
    this.pending = { kind: 'event.move', target, day: day && day !== target.day ? day : day, time, dur: DEF_DUR, awaiting: 'when' };
    if (!day && !time) return { handled: true, text: `A quando sposto «${target.ev.title}» (ora ${this.label(target.day)} alle ${target.ev.time})?`, chips: this.slotChips(target.day, DEF_DUR) };
    return this.commitMove();
  }

  private commitMove(): Reply {
    const p = this.pending as Extract<Pending, { kind: 'event.move' }>;
    const day = p.day ?? p.target.day, time = p.time ?? p.target.ev.time;
    const c = this.conflictsAt(day, time, DEF_DUR, p.target.ev);
    const old = p.target;
    this.env.delEvent(old.day, old.ev);
    const ev = { time, title: old.ev.title };
    this.env.addEvent(day, ev);
    this.pushUndo('spostamento', () => { this.env.delEvent(day, ev); this.env.addEvent(old.day, old.ev); });
    this.pending = null;
    this.lastEv = { day, ev };
    const warn = c.length ? ` Attenzione: a quell’ora hai anche «${c[0].ev.title}».` : '';
    return { handled: true, text: `Spostato: «${ev.title}» ora è ${this.label(day)} alle ${time}.${warn}`, chips: ['Annulla'] };
  }

  private eventDelete(raw: string): Reply {
    const t = this.findEvent(raw);
    if (!t) return { handled: true, text: 'Non trovo quell’impegno. Dimmi il nome o il giorno, per esempio "elimina la riunione di domani".' };
    this.env.delEvent(t.day, t.ev);
    this.pushUndo('eliminazione', () => this.env.addEvent(t.day, t.ev));
    return { handled: true, text: `Ho eliminato «${t.ev.title}» (${this.label(t.day)} alle ${t.ev.time}).`, chips: ['Annulla'] };
  }

  private eventRename(raw: string): Reply {
    const m = /\b(?:in|con|come|a)\s+(.+)$/i.exec(raw);
    const t = this.findEvent(raw.replace(/\b(?:in|con|come|a)\s+.+$/i, ''));
    if (!t || !m) return { handled: true, text: 'Dimmi quale impegno e il nuovo nome: per esempio "rinomina riunione team in Riunione budget".' };
    const nt = m[1].replace(/[?!.]+$/, '').trim();
    this.env.delEvent(t.day, t.ev);
    const ev = { time: t.ev.time, title: nt.charAt(0).toUpperCase() + nt.slice(1) };
    this.env.addEvent(t.day, ev);
    this.pushUndo('rinomina', () => { this.env.delEvent(t.day, ev); this.env.addEvent(t.day, t.ev); });
    return { handled: true, text: `Rinominato in «${ev.title}».`, chips: ['Annulla'] };
  }

  /* ---------- agenda ---------- */
  private agendaShow(raw: string): Reply {
    const w = parseWhen(raw, this.env.now());
    const n = norm(raw);
    if (/settimana|prossimi giorni|prossimi 7/.test(n) && !w.day) {
      const lines: string[] = [];
      for (let i = 0; i < 7; i++) { const d = dayKeyOf(addDaysTo(this.env.now(), i)); const l = this.evs(d); lines.push(`${this.label(d)}: ${l.length ? l.map((e) => `${e.time} ${e.title}`).join(' · ') : 'libero'}`); }
      return { handled: true, text: lines.join('\n'), chips: ['Quando sono libero questa settimana?'] };
    }
    const day = w.day ?? this.today();
    const l = this.evs(day);
    const lab = this.label(day);
    if (!l.length) return { handled: true, text: `${lab[0].toUpperCase() + lab.slice(1)} non hai impegni: giornata libera.`, chips: ['Aggiungi un impegno'] };
    return { handled: true, text: `${lab[0].toUpperCase() + lab.slice(1)} hai ${l.length} ${l.length === 1 ? 'impegno' : 'impegni'}:\n${l.map((e) => `${e.time}  ${e.title}${e.place ? ' · ' + e.place : ''}${e.important ? ' (importante)' : ''}`).join('\n')}`, chips: ['Quando sono libero?', 'Aggiungi un impegno'] };
  }

  private agendaFree(raw: string): Reply {
    const w = parseWhen(raw, this.env.now());
    const wh = this.env.workHours();
    const days = w.day ? [w.day] : Array.from({ length: 5 }, (_, i) => dayKeyOf(addDaysTo(this.env.now(), i))).filter((d) => { const wd = new Date(d + 'T00:00:00').getDay(); return wd !== 0 && wd !== 6; });
    const lines = days.map((d) => {
      const now = this.env.now();
      const from = d === this.today() ? now.getHours() * 60 + Math.ceil(now.getMinutes() / 15) * 15 : 0;
      const lo = w.hint === 'pomeriggio' ? '12:00' : w.hint === 'sera' ? '18:00' : wh.start, hi = w.hint === 'mattina' ? '12:00' : w.hint === 'pomeriggio' ? '18:00' : wh.end;
      const sl = freeSlots(this.evs(d), lo < wh.start ? wh.start : lo, hi > wh.end && w.hint !== 'sera' ? wh.end : hi, 30, DEF_DUR, from);
      return `${this.label(d)}: ${sl.length ? sl.map((s) => `${fmtMin(s.from)}–${fmtMin(s.to)}`).join(', ') : 'nessuno slot libero'}`;
    });
    return { handled: true, text: `Slot liberi nel tuo orario di lavoro (${wh.start}–${wh.end}):\n${lines.join('\n')}`, chips: ['Condividi la mia agenda'] };
  }

  private agendaShare(raw: string): Reply {
    const m = /\b(?:con|a)\s+([A-ZÀ-Ý][\p{L}.' -]+?)(?:\s+(?:per|di|da|questa|domani|oggi|solo|dettagli|con)\b|[?.!]*$)/u.exec(raw);
    const person = m?.[1]?.trim();
    const n = norm(raw);
    const range = /oggi/.test(n) ? 'oggi' : /domani/.test(n) ? 'domani' : '7 giorni';
    const mode = /dettagl|completa|tutto/.test(n) ? 'dettagli' : /occupat/.test(n) ? 'occupato' : 'liberi';
    if (!person) {
      this.pending = { kind: 'share.agenda', range, mode };
      const ppl = this.env.people();
      return { handled: true, text: `A chi la mando? Condivido ${mode === 'liberi' ? 'solo i tuoi slot liberi (nessun titolo)' : mode === 'occupato' ? 'solo quando sei occupato (nessun titolo)' : 'i tuoi impegni con i titoli'} ${range === 'oggi' ? 'di oggi' : range === 'domani' ? 'di domani' : 'dei prossimi 7 giorni'}.`, chips: ppl.slice(0, 5) };
    }
    return this.doShare(person, range, mode);
  }

  /* ---------- task ---------- */
  private taskAdd(raw: string): Reply {
    const w = /\b(entro|scade|scadenza|per il|per)\b/.test(norm(raw)) ? parseWhen(raw, this.env.now()) : { spans: [] as [number, number][], day: undefined as string | undefined };
    const title = extractTitle(raw, w.spans, /\b(aggiungi|crea|nuovo|nuova|metti|segna|inserisci|devo|bisogna|ricordami di|ricordati di|task|attivita|entro|scade|scadenza|per il)\b/g);
    if (!title) return { handled: true, text: 'Che task aggiungo? Scrivi per esempio "aggiungi task chiamare il commercialista entro venerdì".' };
    const id = this.env.addTask(title);
    if (w.day) this.env.setTaskDue(id, w.day);
    this.lastTask = title;
    this.pushUndo('nuovo task', () => this.env.delTask(id));
    return { handled: true, text: `Aggiunto il task «${title}»${w.day ? `, scade ${this.label(w.day)}` : ''}.`, chips: ['Annulla', 'Metti nel piano'] };
  }

  private openTasks() { return this.env.tasks().filter((t) => !t.done); }

  private taskDone(raw: string): Reply {
    const q = extractTitle(raw, [], /\b(ho fatto|ho finito|ho completato|ho concluso|completa|completato|segna come fatto|segna come completato|segna|spunta|fatto|finito|task|attivita|il|lo|la)\b/g) || raw;
    const t = bestMatch(q, this.openTasks(), (x) => x.t) ?? (this.lastTask && /\b(l|lo|la|quello|quella|questo|questa)\b|(lo|la)$/.test(norm(raw)) ? this.openTasks().find((x) => x.t === this.lastTask) ?? null : null);
    if (!t) return { handled: true, text: this.openTasks().length ? 'Non trovo quel task. Quelli aperti sono: ' + this.openTasks().slice(0, 6).map((x) => `«${x.t}»`).join(', ') + '.' : 'Non hai task aperti.' };
    this.env.setTaskDone(t.id, true);
    this.pushUndo('task completato', () => this.env.setTaskDone(t.id, false));
    return { handled: true, text: `Segnato come fatto: «${t.t}». Bravo!`, chips: ['Annulla'] };
  }

  private taskDelete(raw: string): Reply {
    const q = extractTitle(raw, [], /\b(elimina|cancella|togli|rimuovi|task|attivita|il|lo|la)\b/g) || raw;
    const t = bestMatch(q, this.env.tasks(), (x) => x.t);
    if (!t) return { handled: true, text: 'Non trovo quel task. Dimmi il nome com’è scritto.' };
    const removed = this.env.delTask(t.id);
    if (removed) this.pushUndo('task eliminato', () => this.env.restoreTask(removed));
    return { handled: true, text: `Ho eliminato il task «${t.t}».`, chips: ['Annulla'] };
  }

  private taskRename(raw: string): Reply {
    const m = /\b(?:in|con|come)\s+(.+)$/i.exec(raw);
    const q = extractTitle(raw.replace(/\b(?:in|con|come)\s+.+$/i, ''), [], /\b(rinomina|cambia nome|cambia il nome|cambia titolo|task|attivita|il|lo|la)\b/g);
    const t = bestMatch(q, this.env.tasks(), (x) => x.t);
    if (!t || !m) return { handled: true, text: 'Dimmi quale task e il nuovo nome: "rinomina task report in Report trimestrale".' };
    const nt = m[1].replace(/[?!.]+$/, '').trim(); const title = nt.charAt(0).toUpperCase() + nt.slice(1);
    const old = t.t;
    this.env.renameTask(t.id, title);
    this.pushUndo('rinomina task', () => this.env.renameTask(t.id, old));
    return { handled: true, text: `Task rinominato in «${title}».`, chips: ['Annulla'] };
  }

  private taskList(): Reply {
    const open = this.openTasks();
    if (!open.length) return { handled: true, text: 'Non hai task aperti. Bel lavoro!', chips: ['Aggiungi un task'] };
    return { handled: true, text: `Hai ${open.length} ${open.length === 1 ? 'task aperto' : 'task aperti'}:\n${open.slice(0, 12).map((t) => `• ${t.t}`).join('\n')}`, chips: ['Aggiungi un task', 'Apri i task'] };
  }

  /* ---------- note, obiettivi, umore ---------- */
  private noteAdd(raw: string): Reply {
    const text = (/:\s*(.+)$/s.exec(raw)?.[1] ?? raw.replace(/^.*?\b(?:nota|appunto|memo)\b[:\s]*/i, '')).trim();
    if (!text) return { handled: true, text: 'Cosa scrivo nella nota? Per esempio "scrivi una nota: idee per AURA".' };
    this.env.addNote(text);
    return { handled: true, text: 'Nota salvata in LifeNotes.', chips: ['Apri note'] };
  }

  private goalAdd(raw: string): Reply {
    const t = extractTitle(raw, [], /\b(nuovo obiettivo|aggiungi un obiettivo|aggiungi obiettivo|crea un obiettivo|crea obiettivo|imposta un obiettivo|obiettivo)\b/g);
    if (!t) return { handled: true, text: 'Qual è l’obiettivo? Per esempio "nuovo obiettivo correre 10 km".' };
    this.env.addGoal(t);
    return { handled: true, text: `Obiettivo aggiunto: «${t}». Lo trovi nel Plan.`, chips: ['Apri il piano'] };
  }

  private moodLog(raw: string): Reply {
    const n = norm(raw);
    const map: [RegExp, string][] = [[/felice|contento|bene/, 'Felice'], [/calmo|sereno/, 'Calmo'], [/neutro/, 'Neutro'], [/stressat|nervos|stanc/, 'Stressato'], [/triste|giu/, 'Triste'], [/arrabbiat/, 'Arrabbiato']];
    const m = map.find(([re]) => re.test(n));
    if (!m) return this.fallback(raw);
    this.env.logMood(m[1]);
    return { handled: true, text: `Registrato: oggi ti senti ${m[1].toLowerCase()}. Lo confronto con meteo, sonno e impegni nell’analisi dell’umore.`, chips: ['Analisi del mio umore'] };
  }

  /* ---------- profilo e impostazioni ---------- */
  private async profilePhoto(): Promise<Reply> {
    const ok = await this.env.pickProfilePhoto();
    return { handled: true, text: ok ? 'Foto del profilo aggiornata.' : 'Non ho cambiato la foto (scelta annullata o permesso negato).' };
  }

  private setPrivate(on: boolean): Reply {
    const was = this.env.isPrivateProfile();
    if (was === on) return { handled: true, text: on ? 'Il tuo profilo è già privato.' : 'Il tuo profilo è già pubblico.' };
    this.env.setPrivateProfile(on);
    this.pushUndo('privacy profilo', () => this.env.setPrivateProfile(was));
    return { handled: true, text: on ? 'Fatto: il tuo profilo ora è privato. Solo chi segui e chi approvi vede i tuoi contenuti.' : 'Fatto: il tuo profilo ora è pubblico.', chips: ['Annulla'] };
  }

  private hoursSet(raw: string): Reply {
    const w = parseWhen(raw, this.env.now());
    if (!w.time || !w.endTime) return { handled: true, text: 'Dimmi da che ora a che ora lavori: per esempio "imposta orario di lavoro dalle 9 alle 17".' };
    const old = this.env.workHours();
    this.env.setWorkHours(w.time, w.endTime);
    this.pushUndo('orario di lavoro', () => this.env.setWorkHours(old.start, old.end));
    return { handled: true, text: `Orario di lavoro impostato: ${w.time}–${w.endTime}. Lo uso per trovare gli slot liberi.`, chips: ['Annulla'] };
  }

  private open(raw: string): Reply {
    const n = norm(raw).replace(/^(apri|vai (a|al|alla|allo|alle|agli|ai|su|in)|portami (a|in|su)|mostrami)\s+(il |la |lo |le |i |l'|al |alla |ai )?/, '').replace(/^(mio |mia )/, '').trim();
    const key = Object.keys(pageNames).find((k) => n.startsWith(k));
    if (!key) return { handled: true, text: 'Dove vuoi andare? Per esempio "apri finanze", "apri piano", "apri note", "apri umore".' };
    return { handled: true, text: `Apro ${key}.`, navigate: pageNames[key] };
  }

  private doUndo(): Reply {
    const u = this.undo.pop();
    if (!u) return { handled: true, text: 'Non c’è nulla da annullare.' };
    u.run();
    return { handled: true, text: `Annullato: ${u.label}.`, chips: this.undo.length ? ['Annulla ancora'] : undefined };
  }

  private help(): Reply {
    return {
      handled: true,
      text: 'Posso fare tutto questo, e lo faccio io senza AI:\n• Piano: "aggiungi riunione al piano domani alle 15", "sposta la riunione a venerdì", "elimina la riunione di domani", "che impegni ho domani?", "quando sono libero venerdì?"\n• Organizzazione: "pianificami il mese", "cosa devo fare adesso?", "segna il business plan come urgente", "segna chiamata investitori come importante", dì "scegli tu" e scelgo io l’orario migliore\n• Ricorrenze e luoghi: "ogni martedì alle 18 palestra", "riunione a Zurigo domani alle 11" (ti avviso se i tempi di viaggio non bastano), "a che ora è il dentista?", poi "spostala a venerdì"\n• Scadenze: "aggiungi task relazione entro venerdì", "il task relazione scade lunedì"\n• Ripianifica e briefing: "ripianifica le sessioni saltate", "riepilogo della giornata"\n• Task: "aggiungi task chiamare Luca", "ho finito il report", "elimina il task report", "che task ho?"\n• Note e obiettivi: "scrivi una nota: ...", "nuovo obiettivo ..."\n• Dati: "analisi delle mie finanze", "come ho dormito?", "analisi del mio umore", "mi sento stressato"\n• Profilo: "cambia la foto profilo", "rendi il profilo privato"\n• App: "metti il tema scuro", "apri finanze", "imposta orario di lavoro dalle 9 alle 17"\nOgni azione si può annullare con "annulla".',
      chips: ['Aggiungi riunione al piano', 'Analisi delle mie finanze', 'Che impegni ho domani?', 'Quando sono libero?'],
    };
  }

  /* ---------- "scegli tu": decide l'algoritmo ---------- */
  private planEvents() {
    return Object.fromEntries(Object.entries(this.env.events()).map(([d, l]) => [d, l.map((e) => ({ time: e.time, title: e.title, dur: e.dur }))]));
  }
  private choose(dur: number, urgent: boolean, fromDay?: string, onlyDay?: string): { day: string; time: string } | null {
    const wh = this.env.workHours();
    return pickSlot({ now: this.env.now(), workStart: wh.start, workEnd: wh.end, events: this.planEvents(), dur, urgent, fromDay, maxDays: onlyDay ? 1 : 21, anyDay: !!onlyDay });
  }
  private delegateAdd(p: Extract<Pending, { kind: 'event.add' }>, raw: string): Reply {
    const urgent = /urgent|prima possibile|subito|oggi stesso/.test(norm(raw + ' ' + p.title));
    const slot = p.day && p.awaiting === 'time' ? this.choose(p.dur, urgent, p.day, p.day) : this.choose(p.dur, urgent, p.day ?? undefined);
    if (!slot) return { handled: true, text: 'Non trovo uno slot libero nel tuo orario di lavoro nei prossimi giorni. Dimmi tu quando.' };
    p.day = slot.day; p.time = slot.time;
    const r = this.commitAdd();
    return { ...r, text: `${r.text}\nL’ho scelto io: ${urgent ? 'il primo momento libero' : 'una giornata non troppo piena, a metà mattina'}. Se preferisci un altro orario dimmelo.`, chips: ['Annulla', 'Sposta'] };
  }

  /* ---------- pianificare il mese ---------- */
  private planFill(raw: string): Reply {
    const n = norm(raw);
    const scope = /settimana/.test(n) ? 'la settimana' : /giornata|oggi/.test(n) ? 'oggi' : /domani/.test(n) ? 'domani' : 'il mese';
    return this.planPropose(scope, 0);
  }
  private planPropose(scope: string, extraKeep: number): Reply {
    const wh = this.env.workHours();
    const now = this.env.now();
    const ranked = rankTasks(this.env.tasks(), this.flatEvents(), now);
    const window = toMin(wh.end) - toMin(wh.start);
    const keep = Math.max(150, Math.round(window * 0.3)) + extraKeep;
    let items = planMonth({ now, workStart: wh.start, workEnd: wh.end, events: this.planEvents(), ranked, keepFreeMin: keep });
    const t0 = this.today();
    const last = scope === 'oggi' ? t0 : scope === 'domani' ? dayKeyOf(addDaysTo(now, 1)) : scope === 'la settimana' ? dayKeyOf(addDaysTo(now, 7)) : '9999';
    const first = scope === 'domani' ? last : t0;
    items = items.filter((i) => i.day >= first && i.day <= last);
    if (!items.length) return { handled: true, text: 'Nel periodo scelto il piano è già pieno oppure non ci sono giorni lavorativi: non aggiungo nulla.' };
    this.pending = { kind: 'plan.confirm', items, keep: extraKeep, scope };
    const days = [...new Set(items.map((i) => i.day))];
    const tasks = items.filter((i) => i.kind === 'task').length;
    const preview = days.slice(0, 3).map((d) => `${this.label(d)}: ${items.filter((i) => i.day === d).map((i) => `${i.time} ${i.title}`).join(' · ')}`).join('\n');
    const freeH = Math.floor(keep / 60), freeM = keep % 60;
    return {
      handled: true,
      text: `Ti propongo ${items.length} impegni per ${scope}, dentro il tuo orario di lavoro (${wh.start}–${wh.end}): ${tasks} sui tuoi task (i più urgenti per primi, quelli collegati ai tuoi appuntamenti prima della data) e le abitudini (pausa pranzo, lavoro profondo, pausa movimento, revisione della settimana). In ogni giornata lascio liberi almeno ${freeH ? freeH + ' h' : ''}${freeM ? ' ' + freeM + ' min' : ''}.\n\n${preview}${days.length > 3 ? `\n…e altri ${days.length - 3} giorni` : ''}`,
      chips: ['Applica', 'Più slot liberi', 'Annulla'],
    };
  }
  private planAnswer(p: Extract<Pending, { kind: 'plan.confirm' }>, raw: string): Reply | null {
    const n = norm(raw);
    if (/piu (slot )?liber|meno impegni|meno cose|alleggerisci/.test(n)) return this.planPropose(p.scope, p.keep + 90);
    if (/applica|conferma|va bene|ok|si|sì|procedi|fai/.test(n) || isYes(raw)) {
      const done: { day: string; ev: Ev }[] = [];
      p.items.forEach((i) => { const ev = { time: i.time, title: i.title, dur: i.dur }; this.env.addEvent(i.day, ev); done.push({ day: i.day, ev }); });
      this.pushUndo('pianificazione', () => done.forEach((d) => this.env.delEvent(d.day, d.ev)));
      this.pending = null;
      return { handled: true, text: `Fatto: ho aggiunto ${done.length} impegni al Plan. Gli slot liberi restano tuoi. Puoi cambiare o togliere ogni impegno quando vuoi, oppure dire "annulla" per toglierli tutti.`, chips: ['Annulla', 'Apri il piano'] };
    }
    if (this.miss()) return null;
    return { handled: true, text: 'Vuoi che applichi questa pianificazione?', chips: ['Applica', 'Più slot liberi', 'Annulla'] };
  }

  /* ---------- priorità dei task ---------- */
  private flatEvents() {
    return Object.entries(this.env.events()).flatMap(([day, l]) => l.map((e) => ({ day, time: e.time, title: e.title, important: e.important })));
  }
  private taskNext(): Reply {
    const ranked = rankTasks(this.env.tasks(), this.flatEvents(), this.env.now());
    if (ranked[0]) this.lastTask = ranked[0].task.t;
    return { handled: true, text: nextActionText(ranked), chips: ranked[0] ? ['Metti nel piano', 'Ho finito', 'Che task ho?'] : ['Aggiungi un task'] };
  }
  private taskUrgent(raw: string): Reply {
    const n = norm(raw);
    const q = extractTitle(raw, [], /\b(segna|metti|imposta|rendi|marca|come|urgente|urgenti|task|compito|il|lo|la|e|è)\b/g);
    const t = q ? bestMatch(q, this.openTasks(), (x) => x.t) : null;
    if (!t) {
      if (/^urgente:/.test(n) || !this.openTasks().length) {
        const title = raw.replace(/^urgente:\s*/i, '').trim();
        if (title) { const id = this.env.addTask(title.charAt(0).toUpperCase() + title.slice(1)); this.env.setTaskUrgent(id, true); this.pushUndo('task urgente', () => this.env.delTask(id)); return { handled: true, text: `Aggiunto il task urgente «${title}».`, chips: ['Annulla'] }; }
      }
      return { handled: true, text: 'Quale task è urgente? Dimmi il nome: per esempio "segna business plan come urgente".', chips: this.openTasks().slice(0, 4).map((x) => `Segna «${x.t}» urgente`) };
    }
    const was = !!t.urgent;
    const off = /non (e|è)? ?urgent|togli (l')?urgenza/.test(n);
    this.env.setTaskUrgent(t.id, !off);
    this.pushUndo('urgenza', () => this.env.setTaskUrgent(t.id, was));
    return { handled: true, text: off ? `Ho tolto l’urgenza a «${t.t}».` : `«${t.t}» ora è urgente: lo propongo per primo.`, chips: ['Annulla', 'Cosa devo fare adesso?'] };
  }
  private eventImportant(raw: string): Reply {
    const t = this.findEvent(raw.replace(/\b(important[ei]|come|segna|metti|imposta|rendi|marca)\b/gi, ' '));
    if (!t) return { handled: true, text: 'Quale impegno è importante? Dimmi il nome, per esempio "segna chiamata investitori come importante".' };
    const was = !!t.ev.important;
    this.env.setEventImportant(t.day, t.ev, !was);
    this.pushUndo('importanza', () => this.env.setEventImportant(t.day, t.ev, was));
    return { handled: true, text: was ? `«${t.ev.title}» non è più importante.` : `«${t.ev.title}» è segnato come importante: i task collegati avranno la precedenza.`, chips: ['Annulla'] };
  }

  /* ---------- condivisione agenda ---------- */
  private doShare(person: string, range: 'oggi' | 'domani' | '7 giorni', mode: 'liberi' | 'occupato' | 'dettagli'): Reply {
    const r = this.env.shareAgenda(person, range, mode);
    this.pending = null;
    if (!r) return { handled: true, text: `Non trovo ${person} tra le tue chat o non c’è nulla da condividere per quel periodo.` };
    return { handled: true, text: r };
  }
  private shareAnswer(p: Extract<Pending, { kind: 'share.agenda' }>, raw: string): Reply | null {
    const ppl = this.env.people();
    const hit = bestMatch(raw.replace(/\b(a|con|per|mandala|condividila)\b/gi, ' ').trim(), ppl, (x) => x, 0.4) ?? (/^[A-ZÀ-Ý][\p{L}.' -]+$/u.test(raw.trim()) ? raw.trim() : null);
    if (!hit) { if (this.miss()) return null; return { handled: true, text: 'Dimmi il nome della persona (come nelle tue chat).', chips: ppl.slice(0, 5) }; }
    return this.doShare(hit, p.range, p.mode);
  }

  /* ---------- a che ora? / scadenze / ripianificazione ---------- */
  private eventWhen(raw: string): Reply {
    const t = this.findEvent(raw.replace(/\ba che ora\b|\bquando (e|ho|c'e)\b/gi, ' '));
    if (!t) return { handled: true, text: 'Non trovo un impegno con quel nome nel piano. Vuoi che lo aggiunga?', chips: ['Aggiungi un impegno'] };
    return { handled: true, text: `«${t.ev.title}» è ${this.label(t.day)} alle ${t.ev.time}${t.ev.place ? ` a ${t.ev.place}` : ''}.`, chips: ['Sposta', 'Elimina'] };
  }

  private taskDue(raw: string): Reply {
    if (/\b(aggiungi|crea|nuovo|nuova|inserisci)\b/.test(norm(raw))) return this.taskAdd(raw);
    const w = parseWhen(raw, this.env.now());
    const q = extractTitle(raw, w.spans, /\b(scade|scadenza|scadra|imposta|metti|task|compito|il|lo|la|entro|per)\b/g);
    let t = q ? bestMatch(q, this.openTasks(), (x) => x.t) : null;
    if (!t && this.lastTask) t = this.openTasks().find((x) => x.t === this.lastTask) ?? null;
    if (!t) return { handled: true, text: 'Di quale task? Per esempio "il task relazione scade venerdì".', chips: this.openTasks().slice(0, 4).map((x) => x.t) };
    if (!w.day) return { handled: true, text: `Quando scade «${t.t}»?`, chips: ['Oggi', 'Domani', 'Venerdì'] };
    const old = t.due;
    this.env.setTaskDue(t.id, w.day);
    this.lastTask = t.t;
    this.pushUndo('scadenza', () => this.env.setTaskDue(t.id, old));
    return { handled: true, text: `«${t.t}» scade ${this.label(w.day)}: ne terrò conto nelle priorità.`, chips: ['Annulla', 'Cosa devo fare adesso?'] };
  }

  private reschedule(): Reply {
    const flat = Object.entries(this.env.events()).flatMap(([day, l]) => l.map((e) => ({ day, time: e.time, title: e.title, dur: e.dur })));
    const sk = skippedWork(flat, this.env.tasks().map((t) => ({ id: t.id, t: t.t, done: t.done })), this.env.now());
    if (!sk.length) return { handled: true, text: 'Nessuna sessione di lavoro saltata: sei in pari con il piano.' };
    const wh = this.env.workHours();
    const evs = this.planEvents();
    const moves: Extract<Pending, { kind: 'resched.confirm' }>['moves'] = [];
    sk.forEach(({ ev, task }) => {
      const full = (this.env.events()[ev.day] ?? []).find((e) => e.time === ev.time && e.title === ev.title);
      if (!full) return;
      const slot = pickSlot({ now: this.env.now(), workStart: wh.start, workEnd: wh.end, events: evs, dur: ev.dur || DEF_DUR, urgent: !!task.t && !!this.env.tasks().find((x) => x.id === task.id)?.urgent });
      if (!slot) return;
      (evs[slot.day] ??= []).push({ time: slot.time, title: ev.title, dur: ev.dur });
      moves.push({ from: { day: ev.day, ev: full }, to: slot });
    });
    if (!moves.length) return { handled: true, text: 'Ho trovato sessioni saltate ma non vedo slot liberi nei prossimi giorni.' };
    this.pending = { kind: 'resched.confirm', moves };
    return { handled: true, text: `Hai ${moves.length} ${moves.length === 1 ? 'sessione di lavoro saltata' : 'sessioni di lavoro saltate'}. Le rimetto così:\n${moves.map((m) => `• ${m.from.ev.title}: da ${this.label(m.from.day)} ${m.from.ev.time} a ${this.label(m.to.day)} ${m.to.time}`).join('\n')}`, chips: ['Applica', 'Annulla'] };
  }
  private reschedAnswer(p: Extract<Pending, { kind: 'resched.confirm' }>, raw: string): Reply | null {
    if (/applica|conferma|ok|si|sì|va bene|procedi/.test(norm(raw)) || isYes(raw)) {
      const done: { from: { day: string; ev: Ev }; to: { day: string; ev: Ev } }[] = [];
      p.moves.forEach((m) => {
        this.env.delEvent(m.from.day, m.from.ev);
        const nev: Ev = { ...m.from.ev, time: m.to.time };
        this.env.addEvent(m.to.day, nev);
        done.push({ from: m.from, to: { day: m.to.day, ev: nev } });
      });
      this.pushUndo('ripianificazione', () => done.forEach((d) => { this.env.delEvent(d.to.day, d.to.ev); this.env.addEvent(d.from.day, d.from.ev); }));
      this.pending = null;
      return { handled: true, text: `Fatto: ho ripianificato ${done.length} ${done.length === 1 ? 'sessione' : 'sessioni'}. Puoi annullare quando vuoi.`, chips: ['Annulla', 'Apri il piano'] };
    }
    if (this.miss()) return null;
    return { handled: true, text: 'Vuoi che le ripianifichi così?', chips: ['Applica', 'Annulla'] };
  }

  private fallback(raw: string): Reply {
    const t = raw.trim().replace(/[?!.]+$/, '');
    const nr = norm(raw);
    // "ho comprato il latte" -> task completato; "cancella il dentista" / "rinomina X in Y" senza dire se è un task o un impegno
    if (/^ho \w+(ato|uto|ito)\b/.test(nr) && this.openTasks().length) {
      const q = extractTitle(raw, [], /\b(ho|il|lo|la|le|i|gli)\b/g);
      if (q && bestMatch(q, this.openTasks(), (x) => x.t)) return this.taskDone(raw);
    }
    if (/^(cancella|elimina|rimuovi|togli|disdici)\b/.test(nr)) return this.findEvent(raw) ? this.eventDelete(raw) : this.taskDelete(raw);
    if (/^rinomina\b/.test(nr)) { const base = raw.replace(/\b(?:in|con|come|a)\s+.+$/i, ''); return this.findEvent(base) ? this.eventRename(raw) : this.taskRename(raw); }
    // una frase breve all'infinito ("Chiamare il commercialista") è quasi sempre una cosa da fare: lo propongo
    if (t.split(/\s+/).length <= 9 && /^[a-zà-ÿ]+(are|ere|ire|arsi|ersi|irsi)\b/i.test(t) && !/\?$/.test(raw)) {
      const title = t.charAt(0).toUpperCase() + t.slice(1);
      this.pending = { kind: 'add.suggest', title };
      return { handled: true, text: `Vuoi che lo aggiunga? «${title}»`, chips: ['Aggiungi come task', 'Metti nel piano', 'No'] };
    }
    return { handled: false, text: 'Non ho capito del tutto. Prova con una frase come "aggiungi riunione al piano domani alle 15", "pianificami il mese", "cosa devo fare adesso?" oppure scrivi "aiuto" per vedere tutto.', chips: ['Aiuto', 'Cosa devo fare adesso?', 'Pianificami il mese', 'Che impegni ho domani?'] };
  }
}

export const intentOf = (s: string): Intent => detectIntent(s);
void isYes;
