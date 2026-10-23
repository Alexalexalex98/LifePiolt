/**
 * Messaggi che parlano di farsi del male o di morire: riconoscimento PRUDENTE e deterministico (parole e frasi), mai affidato a un modello linguistico.
 * Se scatta, Theia non improvvisa e non "fa terapia": risponde con un testo fisso, non giudicante, e indica aiuto umano. Non è un servizio di emergenza.
 */
const NORM = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’`]/g, ' ').replace(/\s+/g, ' ').trim();

const ACUTE: RegExp[] = [
  /\b(voglio|vorrei|penso di|ho deciso di|sto per)\s+(morire|uccidermi|ammazzarmi|togliermi la vita|farla finita|suicidarmi)\b/,
  /\b(mi uccido|mi ammazzo|mi tolgo la vita|mi suicido|farla finita|non voglio piu vivere|non voglio vivere piu|meglio se non ci fossi|sparire per sempre)\b/,
  /\b(suicidio|suicidar\w*|autolesion\w*|farmi del male|farmi male di proposito|tagliarmi le vene|tagliarmi i polsi|mi taglio le vene|mi taglio i polsi|mi taglio per farmi male)\b/,
  /\b(i want to die|want to kill myself|kill myself|end my life|take my own life|suicid\w*|hurt myself|harm myself|cut myself|cut my wrists|self[- ]harm)\b/,
  /\b(ich will sterben|ich will mich umbringen|mich umbringen|suizid\w*|mir das leben nehmen|mich selbst verletzen)\b/,
  /\b(je veux mourir|me suicider|me tuer|mettre fin a mes jours|me faire du mal)\b/,
  /\b(quiero morir|quiero morirme|suicidarme|quitarme la vida|hacerme dano)\b/,
];

export function detectCrisis(text: string): boolean {
  const n = NORM(text);
  if (n.length < 6) return false;
  // modi di dire innocui («morire dal ridere», «muoio di fame»)
  if (/\b(morire|morta|morto) (dal|dalla|di|per il|per la) (ridere|caldo|freddo|sonno|fame|voglia|imbarazzo|noia|sete|vergogna)\b/.test(n) && !/suicid|uccid|ammazz|farla finita/.test(n)) return false;
  return ACUTE.some((r) => r.test(n));
}

/** Risorse, in ordine: emergenza, Svizzera, Italia. I numeri vanno ricontrollati prima di ogni rilascio. */
export const CRISIS_RESOURCES: { id: string; label: string; tel: string }[] = [
  { id: 'eu', label: 'Emergenza (112)', tel: '112' },
  { id: 'ch', label: 'Svizzera: La Mano Tesa (143)', tel: '143' },
  { id: 'it', label: 'Italia: Telefono Amico (02 2327 2327)', tel: '+390223272327' },
];
export const CRISIS_TEXT = "Mi dispiace tanto che tu stia attraversando questo momento: quello che hai scritto è importante e non devi affrontarlo da solo/a. Io non sono un servizio di emergenza e non posso aiutarti come una persona preparata, quindi ti chiedo di parlarne adesso con qualcuno.\n\nSe sei in pericolo immediato, chiama il 112 (numero unico di emergenza in Europa; in Svizzera anche il 144).\n• Svizzera: 143, La Mano Tesa, 24 ore su 24, gratuito e anonimo.\n• Italia: Telefono Amico, 02 2327 2327.\n\nSe puoi, dillo anche a una persona di fiducia vicina a te. Io resto qui con te, ma oggi vorrei che parlassi con una persona.";
