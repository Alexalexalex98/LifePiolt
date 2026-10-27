/* Il nuovo estratto continua quello gia' caricato (stesso periodo o mese dopo) o non c'entra nulla? */
export type StatementRelation = 'continues' | 'unrelated';

const DAY = 86400000;
const t = (iso: string) => Date.parse(iso.slice(0, 10) + 'T00:00:00Z');

/**
 * existingIso: date (ISO) dei movimenti da estratto gia' in app.
 * rows: righe del nuovo estratto; known: quante di queste sono gia' presenti (stessa data e importo).
 * - quasi nessun movimento in comune su un periodo che si sovrappone -> altro conto o altro estratto
 * - periodo che segue o precede entro ~45 giorni -> continua (ottobre poi novembre)
 */
export function statementRelation(existingIso: string[], newIso: string[], known: number): StatementRelation {
  if (!existingIso.length || !newIso.length) return 'continues';
  const e = existingIso.map(t).filter(Number.isFinite).sort((a, b) => a - b);
  const n = newIso.map(t).filter(Number.isFinite).sort((a, b) => a - b);
  if (!e.length || !n.length) return 'continues';
  const eFrom = e[0], eTo = e[e.length - 1], nFrom = n[0], nTo = n[n.length - 1];
  const overlap = nFrom <= eTo && nTo >= eFrom;
  if (overlap) {
    const inside = n.filter((x) => x >= eFrom && x <= eTo).length;
    if (inside >= 10 && known / inside < 0.1) return 'unrelated';
    return 'continues';
  }
  const gap = nFrom > eTo ? nFrom - eTo : eFrom - nTo;
  return gap <= 45 * DAY ? 'continues' : 'unrelated';
}
