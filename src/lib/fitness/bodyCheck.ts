/**
 * Controllo del corpo con 4 foto. Modulo PURO: i punti di vista e il testo da mandare all'AI.
 * Non e' una visita: l'AI descrive cio' che si vede in modo generale e propone esercizi e abitudini, senza diagnosi.
 */
export type BodySlot = 'front' | 'back' | 'left' | 'right';
export const BODY_SLOTS: { id: BodySlot; label: string; hint: string }[] = [
  { id: 'front', label: 'Davanti', hint: 'In piedi, braccia lungo i fianchi, sguardo avanti.' },
  { id: 'back', label: 'Dietro', hint: 'Di schiena, stessa posizione rilassata.' },
  { id: 'left', label: 'Lato sinistro', hint: 'Di profilo, braccia lungo i fianchi.' },
  { id: 'right', label: 'Lato destro', hint: 'Di profilo dall\'altro lato.' },
];
export const BODY_TIPS = ['Stessa luce e stesso posto ogni volta, con una luce che non faccia ombre dure.', 'Abiti aderenti o sportivi, così si vedono le forme.', 'Il telefono all\'altezza del petto, a un paio di metri, tutto il corpo in foto.', 'Ripeti le foto ogni 4-6 settimane per vedere i cambiamenti.'];

export type BodyCtx = { sex?: 'f' | 'm'; age?: number; weightKg?: number; heightCm?: number; goal?: 'dimagrire' | 'mantenere' | 'massa'; activity?: string };

/** Testo da mandare all'AI insieme alle 4 foto (davanti, dietro, lato sinistro, lato destro, in questo ordine). */
export function bodyPrompt(ctx: BodyCtx = {}): string {
  const who = [ctx.sex ? (ctx.sex === 'f' ? 'donna' : 'uomo') : '', ctx.age ? `${ctx.age} anni` : '', ctx.heightCm ? `${ctx.heightCm} cm` : '', ctx.weightKg ? `${ctx.weightKg} kg` : '', ctx.activity ? `attività ${ctx.activity}` : '', ctx.goal ? `obiettivo: ${ctx.goal}` : ''].filter(Boolean).join(', ');
  return `Ti mando 4 foto della stessa persona in piedi, in quest'ordine: davanti, dietro, lato sinistro, lato destro.${who ? ` Dati indicati: ${who}.` : ''}
Fai una valutazione generale di allenamento e postura, come farebbe un preparatore atletico attento e rispettoso. Rispondi in italiano, con garbo, in modo sincero ma mai giudicante o offensivo; non commentare l'aspetto estetico in modo negativo e non fare paragoni con altre persone.
Struttura (titoli brevi in grassetto, elenchi con «• »):
**Cosa si vede di buono** — punti di forza e aree già ben sviluppate.
**Cosa si può migliorare** — aree meno sviluppate o poco tonificate, simmetria tra destra e sinistra, postura (spalle, schiena, bacino, ginocchia) solo se emerge chiaramente dalle foto; se una foto non è chiara dillo.
**Esercizi consigliati** — 4 o 5 esercizi concreti collegati ai punti emersi, con quante serie e ripetizioni indicative per iniziare.
**Alimentazione e abitudini** — 2 o 3 indicazioni generali coerenti con l'obiettivo.
**Quando ripetere le foto** — dopo quante settimane.
Non fare diagnosi, non parlare di malattie, non stimare percentuali di grasso né peso, non prescrivere integratori o terapie. Se noti qualcosa che merita l'occhio di un professionista (per esempio una forte asimmetria o un dolore), invita con delicatezza a sentire un medico o un fisioterapista. Chiudi ricordando che è una valutazione indicativa da foto, non una visita, e che decide sempre lei/lui cosa farne. Niente emoji. Massimo 380 parole.`;
}
