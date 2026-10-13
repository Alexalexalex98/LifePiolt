/** Comandi che Theia capisce (modulo PURO): compaiono come suggerimenti mentre scrivi, filtrati da quello che digiti. */
export type CommandSuggestion = { id: string; area: string; icon: string; label: string; /** testo da mettere nel campo */ insert: string; keywords: string[] };

const C = (id: string, area: string, icon: string, label: string, insert: string, keywords: string[]): CommandSuggestion => ({ id, area, icon, label, insert, keywords });

export const COMMANDS: CommandSuggestion[] = [
  C('plan-add', 'Piano', 'calendar', 'Aggiungi un impegno al piano', 'Aggiungi riunione al piano domani alle 15', ['aggiungi', 'impegno', 'riunione', 'appuntamento', 'piano', 'evento']),
  C('plan-tomorrow', 'Piano', 'calendar', 'Cosa ho in programma domani?', 'Cosa ho in programma domani?', ['programma', 'domani', 'agenda', 'oggi', 'settimana']),
  C('plan-month', 'Piano', 'calendar', 'Pianifica il mese', 'Pianifica il mese', ['pianifica', 'mese', 'organizza']),
  C('plan-move', 'Piano', 'calendar', 'Sposta un impegno', 'Sposta la riunione a giovedì alle 10', ['sposta', 'rimanda', 'cambia', 'riprogramma']),
  C('plan-vac', 'Piano', 'calendar', 'Segna le vacanze', 'Segna le vacanze dal 10 al 17 agosto', ['vacanze', 'ferie', 'viaggio']),
  C('task-add', 'Task', 'tasks', 'Aggiungi un task', 'Aggiungi task chiamare il dentista', ['task', 'cosa da fare', 'ricordami', 'aggiungi']),
  C('task-urgent', 'Task', 'tasks', 'Cosa devo fare adesso?', 'Cosa devo fare adesso?', ['adesso', 'priorità', 'urgente', 'prima']),
  C('task-done', 'Task', 'tasks', 'Segna un task come fatto', 'Segna fatto chiamare il dentista', ['fatto', 'completato', 'finito']),
  C('note-add', 'Note', 'note', 'Scrivi una nota', 'Nota: idee per il weekend', ['nota', 'appunto', 'scrivi']),
  C('brief', 'Oggi', 'sparkle', 'Riepilogo della giornata', 'Riepilogo della giornata', ['riepilogo', 'briefing', 'giornata', 'oggi']),
  C('fin', 'Finanze', 'lifefinance', 'Analizza le mie finanze', 'Analisi delle mie finanze', ['finanze', 'spese', 'budget', 'soldi', 'analisi']),
  C('fin-add', 'Finanze', 'lifefinance', 'Registra una spesa', 'Ho speso 12 franchi al supermercato', ['speso', 'spesa', 'supermercato', 'registra']),
  C('health', 'Salute', 'lifehealth', 'Come sto di salute?', 'Come sto di salute?', ['salute', 'sonno', 'passi', 'battito', 'stanco']),
  C('health-sleep', 'Salute', 'lifehealth', 'Registra il sonno', 'Stanotte ho dormito 7 ore', ['dormito', 'sonno', 'registra']),
  C('mood', 'Umore', 'mood', 'Come va il mio umore?', 'Come va il mio umore?', ['umore', 'stress', 'mi sento']),
  C('profile-priv', 'Profilo', 'profile', 'Rendi privato il mio profilo', 'Rendi privato il mio profilo', ['privato', 'profilo', 'privacy']),
  C('profile-photo', 'Profilo', 'profile', 'Cambia la foto del profilo', 'Cambia la foto del profilo', ['foto', 'profilo', 'immagine']),
  C('lp', 'LifePoints', 'coin', 'Quanti LifePoints ho?', 'Quanti LifePoints ho?', ['lifepoints', 'saldo', 'punti']),
  C('help', 'Aiuto', 'help', 'Cosa sai fare?', 'Cosa sai fare?', ['aiuto', 'funzioni', 'cosa sai', 'help']),
  C('help-lp', 'Aiuto', 'help', 'A cosa serve il LifePoint giornaliero?', 'A cosa serve il LifePoint giornaliero?', ['giornaliero', 'lifepoint', 'cosa serve', 'come funziona']),
  C('help-pay', 'Aiuto', 'help', 'Come pago con il QR?', 'Come pago con il QR?', ['qr', 'pagare', 'pagamento', 'come']),
  C('help-reviews', 'Aiuto', 'help', 'Come funzionano le recensioni?', 'Come funzionano le recensioni?', ['recensioni', 'voto', 'stelle']),
];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

/** Suggerimenti per quello che si sta scrivendo: vuoto = i più utili; con testo = quelli che combaciano (parole intere o inizio parola). */
export function suggestCommands(typed: string, max = 5): CommandSuggestion[] {
  const q = norm(typed);
  if (!q) return ['task-urgent', 'plan-add', 'task-add', 'brief', 'fin', 'help'].map((id) => COMMANDS.find((c) => c.id === id)!).slice(0, max);
  const words = q.split(' ').filter(Boolean);
  return COMMANDS.map((c) => {
    const hay = norm(`${c.label} ${c.keywords.join(' ')} ${c.area}`).split(' ');
    const score = words.reduce((s, w) => s + (hay.includes(w) ? 3 : hay.some((h) => h.startsWith(w)) ? 2 : 0), 0);
    return { c, score };
  }).filter((x) => x.score >= Math.max(2, words.length * 2 - 1) || (words.length === 1 && x.score > 0)).sort((a, b) => b.score - a.score).slice(0, max).map((x) => x.c);
}
