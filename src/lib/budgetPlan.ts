/** Piano mensile consigliato (stipendio netto, Svizzera): prima i costi fissi, poi le spese variabili in percentuale, il resto in risparmio. Solo un'indicazione generale, non consulenza. */
export type PlanLine = { n: string; amt: number; kind: 'fisso' | 'variabile' | 'risparmio' };
export type Plan = { salary: number; lines: PlanLine[]; fixed: number; free: number; deficit: boolean; rentPct: number; rentHigh: boolean };

const VAR: [string, number][] = [['Alimentari/Casa', 0.13], ['Abbonamenti', 0.03], ['Abbigliamento', 0.03], ['Viaggio estero', 0.04]];
/** Regola pratica diffusa: l'affitto non dovrebbe superare circa un terzo del reddito. */
export const RENT_RULE = 0.33;

export function suggestPlan(salary: number, rent: number, health: number): Plan {
  const s = Math.max(0, Math.round(salary));
  const fixed = Math.max(0, rent) + Math.max(0, health);
  const lines: PlanLine[] = [{ n: 'Affitto', amt: Math.max(0, Math.round(rent)), kind: 'fisso' }, { n: 'Cassa malati', amt: Math.max(0, Math.round(health)), kind: 'fisso' }];
  let left = s - lines[0].amt - lines[1].amt;
  const deficit = left < 0;
  left = Math.max(0, left);
  for (const [n, p] of VAR) {
    const a = Math.min(left, Math.round(s * p));
    lines.push({ n, amt: a, kind: 'variabile' }); left -= a;
  }
  const ef = Math.round(left * 0.45);
  lines.push({ n: 'Fondo emergenza', amt: ef, kind: 'risparmio' }); left -= ef;
  lines.push({ n: 'Altro', amt: left, kind: 'variabile' });
  return { salary: s, lines, fixed, free: Math.max(0, s - fixed), deficit, rentPct: s > 0 ? rent / s : 0, rentHigh: s > 0 && rent / s > RENT_RULE };
}
