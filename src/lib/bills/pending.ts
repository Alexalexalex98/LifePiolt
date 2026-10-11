/** Testo incollato passato alla schermata di revisione senza metterlo nell'indirizzo (puo' essere lungo). Solo in memoria. */
let pending: { text: string; name?: string } | null = null;
export const setPendingText = (text: string, name?: string) => { pending = { text, name }; };
export function takePendingText(): { text: string; name?: string } | null { const p = pending; pending = null; return p; }
