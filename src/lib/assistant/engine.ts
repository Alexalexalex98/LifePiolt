/**
 * Motore dell'assistente: capisce una richiesta in italiano, chiede ciò che manca (dialogo a più turni),
 * esegue l'azione sull'app e permette di annullarla. NESSUNA AI e nessuna chiamata di rete: solo regole.
 * È indipendente dall'app (usa un `Env` iniettato), così si prova con test automatici.
 */
import { freeSlots, fmtMin, toMin } from '../availability.ts';
import { bestMatch, dayKeyOf, dayLabel, detectIntent, extractTitle, isNo, isYes, norm, pageNames, parseWhen, addDaysTo, type Intent, type When } from './nlp.ts';

export type Ev = { time: string; title: string };
export type TaskLite = { id: string; t: string; done?: boolean };

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
  shareAgenda(person: string, range: 'oggi' | 'domani' | '7 giorni', mode: 'liberi' | 'occupato' | 'dettagli'): string | null;
  userName(): string;
}

export type Reply = { text: string; chips?: string[]; navigate?: string; handled: boolean };

type Pending =
  | { kind: 'event.add'; title: string; day?: string; time?: string; dur: number; hint?: When['hint']; awaiting: 'title' | 'day' | 'time' | 'conflict'; conflicts?: { day: string; ev: Ev }[]; replacing?: { day: string; ev: Ev } }
  | { kind: 'event.move'; target: { day: string; ev: Ev }; day?: string; time?: string; dur: number; awaiting: 'when' }
  | { kind: 'confirm.photo' };

const DEF_DUR = 60;
const pad = (n: number) => String(n).padStart(2, '0');

export class Assistant {
  pending: Pending | null = null;
  private undo: { label: string; run: () => void }[] = [];
  private env: Env;
  constructor(env: Env) { this.env = env; }

  /* ---------- utilità ---------- */
  private today() { return dayKeyOf(this.env.now()); }
  private label(day: string) { return dayLabel(day, this.env.now()); }
  private evs(day: string) { return (this.env.events()[day] ?? []).slice().sort((a, b) => a.time.localeCompare(b.time)); }
  private conflictsAt(day: string, time: string, dur: number, ignore?: Ev): { day: string; ev: Ev }[] {
    const s = toMin(time), e = s + dur;
    return this.evs(day).filter((x) => x !== ignore && !(ignore && x.time === ignore.time && x.title === ignore.title)).filter((x) => { const a = toMin(x.time); return a < e && s < a + DEF_DUR; }).map((ev) => ({ day, ev }));
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
    // 1) risposta a una domanda in sospeso
    if (this.pending) {
      const r = await this.continuePending(raw);
      if (r) return r;
    }
    // 2) nuovo comando
    const intent = detectIntent(raw);
    switch (intent) {
      case 'undo': return this.doUndo();
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
      if (!answerish && !(p.kind === 'event.add' && p.awaiting === 'title') && detectIntent(raw) !== 'unknown') { this.pending = null; return null; }
    }
    if (p.kind === 'event.add') {
      const w = parseWhen(raw, this.env.now());
      if (p.awaiting === 'title') { p.title = raw.replace(/[?!.]+$/, '').trim(); p.title = p.title.charAt(0).toUpperCase() + p.title.slice(1); return this.progressAdd(); }
      if (p.awaiting === 'day') {
        const chip = /^oggi$/.test(n) ? this.today() : /^domani$/.test(n) ? dayKeyOf(addDaysTo(this.env.now(), 1)) : undefined;
        const day = chip ?? w.day;
        if (!day) return { handled: true, text: 'Non ho capito il giorno. Dimmi per esempio "domani", "venerdì" o "il 15".', chips: this.dayChips() };
        p.day = day; if (w.time) p.time = w.time; if (w.durationMin) p.dur = w.durationMin; if (w.hint) p.hint = w.hint;
        return this.progressAdd();
      }
      if (p.awaiting === 'time') {
        const bare = /^(\d{1,2})([:.]\d{2})?$/.exec(n);
        let time = w.time;
        if (!time && bare) { let h = Number(bare[1]); if (h >= 1 && h <= 7) h += 12; time = `${pad(h)}:${bare[2] ? bare[2].slice(1) : '00'}`; }
        if (!time) return { handled: true, text: 'Dimmi l’ora, per esempio "15:30" o "alle 10".', chips: this.slotChips(p.day!, p.dur, p.hint) };
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
      if (!w.day && !time) return { handled: true, text: 'Dimmi a quando lo sposto: per esempio "venerdì alle 11".', chips: this.slotChips(p.target.day, p.dur) };
      p.day = w.day ?? p.day ?? p.target.day; p.time = time ?? p.time ?? p.target.ev.time;
      return this.commitMove();
    }
    return null;
  }

  /* ---------- aggiungere al piano ---------- */
  private startEventAdd(raw: string): Reply {
    const w = parseWhen(raw, this.env.now());
    const title = extractTitle(raw, w.spans, /\b(aggiungi|metti|inserisci|segna|programma|pianifica|fissa|prenota|crea|organizza)\b/g);
    this.pending = { kind: 'event.add', title, day: w.day, time: w.time, dur: w.durationMin ?? DEF_DUR, hint: w.hint, awaiting: 'title' };
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

  private resolveConflict(raw: string, w: When): Reply {
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
    return { handled: true, text: 'Scegli un’opzione: cambiare giorno, cambiare ora, spostare l’altro impegno oppure tenerli entrambi.', chips: ['Cambia giorno', 'Cambia ora', `Sposta «${p.conflicts![0].ev.title}»`, 'Tieni entrambi', 'Annulla'] };
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
    const ev = { time: p.time!, title: p.title };
    this.env.addEvent(p.day!, ev);
    this.pushUndo('aggiunta al piano', () => this.env.delEvent(p.day!, ev));
    this.pending = null;
    const end = fmtMin(toMin(ev.time) + p.dur);
    if (silent) return { handled: true, text: '' };
    return { handled: true, text: `Fatto: «${ev.title}» ${this.label(p.day!)} dalle ${ev.time} alle ${end}. Lo trovi nel Plan.`, chips: ['Annulla', 'Apri il piano'] };
  }

  /* ---------- spostare / eliminare / rinominare ---------- */
  private findEvent(raw: string): { day: string; ev: Ev } | null {
    const w = parseWhen(raw, this.env.now());
    const list = this.upcoming();
    const q = extractTitle(raw, w.spans, /\b(sposta|rimanda|anticipa|posticipa|cambia|elimina|cancella|togli|rimuovi|rinomina|impegno|evento|appuntamento|riunione|dal piano)\b/g) || raw;
    const byDay = w.day ? list.filter((x) => x.day === w.day) : list;
    return bestMatch(q, byDay.length ? byDay : list, (x) => x.ev.title);
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
    return { handled: true, text: `${lab[0].toUpperCase() + lab.slice(1)} hai ${l.length} ${l.length === 1 ? 'impegno' : 'impegni'}:\n${l.map((e) => `${e.time}  ${e.title}`).join('\n')}`, chips: ['Quando sono libero?', 'Aggiungi un impegno'] };
  }

  private agendaFree(raw: string): Reply {
    const w = parseWhen(raw, this.env.now());
    const wh = this.env.workHours();
    const days = w.day ? [w.day] : Array.from({ length: 5 }, (_, i) => dayKeyOf(addDaysTo(this.env.now(), i))).filter((d) => { const wd = new Date(d + 'T00:00:00').getDay(); return wd !== 0 && wd !== 6; });
    const lines = days.map((d) => {
      const now = this.env.now();
      const from = d === this.today() ? now.getHours() * 60 + Math.ceil(now.getMinutes() / 15) * 15 : 0;
      const sl = freeSlots(this.evs(d), wh.start, wh.end, 30, DEF_DUR, from);
      return `${this.label(d)}: ${sl.length ? sl.map((s) => `${fmtMin(s.from)}–${fmtMin(s.to)}`).join(', ') : 'nessuno slot libero'}`;
    });
    return { handled: true, text: `Slot liberi nel tuo orario di lavoro (${wh.start}–${wh.end}):\n${lines.join('\n')}`, chips: ['Condividi la mia agenda'] };
  }

  private agendaShare(raw: string): Reply {
    const m = /\b(?:con|a)\s+([A-ZÀ-Ý][\p{L}.' -]+?)(?:\s+(?:per|di|da|questa|domani|oggi|solo|dettagli|con)\b|[?.!]*$)/u.exec(raw);
    const person = m?.[1]?.trim();
    if (!person) return { handled: true, text: 'Con chi la condivido? Scrivi per esempio "condividi la mia agenda con Marco".' };
    const n = norm(raw);
    const range = /oggi/.test(n) ? 'oggi' : /domani/.test(n) ? 'domani' : '7 giorni';
    const mode = /dettagl|completa|tutto/.test(n) ? 'dettagli' : /occupat/.test(n) ? 'occupato' : 'liberi';
    const r = this.env.shareAgenda(person, range, mode);
    if (!r) return { handled: true, text: `Non trovo ${person} tra i tuoi contatti o non c'è nulla da condividere per quel periodo.` };
    return { handled: true, text: r, chips: ['Apri messaggi'] };
  }

  /* ---------- task ---------- */
  private taskAdd(raw: string): Reply {
    const title = extractTitle(raw, [], /\b(aggiungi|crea|nuovo|nuova|metti|segna|inserisci|devo|bisogna|ricordami di|ricordati di|task|attivita)\b/g);
    if (!title) return { handled: true, text: 'Che task aggiungo? Scrivi per esempio "aggiungi task chiamare il commercialista".' };
    const id = this.env.addTask(title);
    this.pushUndo('nuovo task', () => this.env.delTask(id));
    return { handled: true, text: `Aggiunto il task «${title}».`, chips: ['Annulla', 'Metti nel piano'] };
  }

  private openTasks() { return this.env.tasks().filter((t) => !t.done); }

  private taskDone(raw: string): Reply {
    const q = extractTitle(raw, [], /\b(ho fatto|ho finito|ho completato|ho concluso|completa|completato|segna come fatto|segna come completato|segna|spunta|fatto|finito|task|attivita|il|lo|la)\b/g) || raw;
    const t = bestMatch(q, this.openTasks(), (x) => x.t);
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
    const n = norm(raw).replace(/^(apri|vai a|vai su|portami (a|in|su)|mostrami)\s+(il |la |lo |le |i |l')?/, '').replace(/^(mio |mia )/, '').trim();
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
      text: 'Posso fare tutto questo, e lo faccio io senza AI:\n• Piano: "aggiungi riunione al piano domani alle 15", "sposta la riunione a venerdì", "elimina la riunione di domani", "che impegni ho domani?", "quando sono libero venerdì?"\n• Task: "aggiungi task chiamare Luca", "ho finito il report", "elimina il task report", "che task ho?"\n• Note e obiettivi: "scrivi una nota: ...", "nuovo obiettivo ..."\n• Dati: "analisi delle mie finanze", "come ho dormito?", "analisi del mio umore", "mi sento stressato"\n• Profilo: "cambia la foto profilo", "rendi il profilo privato"\n• App: "metti il tema scuro", "apri finanze", "imposta orario di lavoro dalle 9 alle 17"\nOgni azione si può annullare con "annulla".',
      chips: ['Aggiungi riunione al piano', 'Analisi delle mie finanze', 'Che impegni ho domani?', 'Quando sono libero?'],
    };
  }

  private fallback(raw: string): Reply {
    void raw;
    return { handled: false, text: 'Non ho capito del tutto. Prova con una frase come "aggiungi riunione al piano domani alle 15" oppure scrivi "aiuto" per vedere cosa so fare.', chips: ['Aiuto', 'Che impegni ho domani?', 'Che task ho?'] };
  }
}

export const intentOf = (s: string): Intent => detectIntent(s);
void isYes;
