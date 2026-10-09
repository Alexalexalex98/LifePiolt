/**
 * Avvisi di budget: una categoria che supera il budget impostato (o, se manca, la linea guida in % dello stipendio).
 * Modulo PURO e testabile: riceve lo stato già pronto, restituisce gli avvisi con importo e percentuale.
 */
import { t, translateText } from '../i18n/core.ts';

export type BudgetAlert = {
  category: string; spent: number; limit: number;
  /** speso / limite in % (arrotondato) */
  pct: number; over: number; basis: 'budget' | 'linea guida';
  level: 'over' | 'near'; text: string; detail: string;
};
export type BudgetState = {
  /** spesa positiva del mese per categoria */
  spent: Record<string, number>;
  /** budget impostato per categoria (CHF/mese) */
  alloc: Record<string, number>;
  /** linee guida in % dello stipendio */
  guidelines: Record<string, number>;
  salary: number;
  /** categorie da non considerare (es. risparmio) */
  exclude?: string[];
  /** soglia "vicino al limite" in % (default 85, 0 = disattiva) */
  nearPct?: number;
};

const chf = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");

export function budgetAlerts(st: BudgetState): BudgetAlert[] {
  const exclude = st.exclude ?? ['Fondo emergenza'];
  const near = st.nearPct ?? 85;
  const out: BudgetAlert[] = [];
  for (const [category, spent] of Object.entries(st.spent)) {
    if (exclude.includes(category) || !(spent > 0)) continue;
    const a = st.alloc[category] ?? 0;
    const g = st.guidelines[category];
    let limit = 0, basis: BudgetAlert['basis'] = 'budget';
    if (a > 0) limit = a;
    else if (g && st.salary > 0) { limit = (st.salary * g) / 100; basis = 'linea guida'; }
    if (!(limit > 0)) continue;
    const pct = Math.round((spent / limit) * 100);
    if (spent > limit) {
      out.push({ category, spent, limit, pct, over: spent - limit, basis, level: 'over', text: basis === 'budget' ? t('{0}: superato il budget di {1} CHF', translateText(category), chf(spent - limit)) : t('{0}: superato il limite consigliato di {1} CHF', translateText(category), chf(spent - limit)), detail: basis === 'budget' ? t('Hai speso {0} CHF su {1} CHF ({2}%) rispetto al budget che hai impostato.', chf(spent), chf(limit), pct) : t('Hai speso {0} CHF su {1} CHF ({2}%) rispetto al limite consigliato (linea guida generale, non consulenza finanziaria).', chf(spent), chf(limit), pct) });
    } else if (near > 0 && pct >= near) {
      out.push({ category, spent, limit, pct, over: 0, basis, level: 'near', text: basis === 'budget' ? t('{0}: sei al {1}% del budget', translateText(category), pct) : t('{0}: sei al {1}% del limite consigliato', translateText(category), pct), detail: t('Hai speso {0} CHF su {1} CHF: restano {2} CHF per questo mese.', chf(spent), chf(limit), chf(limit - spent)) });
    }
  }
  return out.sort((x, y) => (x.level === y.level ? y.pct - x.pct : x.level === 'over' ? -1 : 1));
}

/** Suggerimenti per Theia: solo i superamenti reali, i più grossi per primi. */
export function budgetSuggestions(alerts: BudgetAlert[], max = 3): { id: string; title: string; detail: string; priority: number }[] {
  return alerts.filter((a) => a.level === 'over').slice(0, max).map((a) => ({
    id: `budget-${a.category}`, title: a.text, detail: a.detail + ' ' + t('Guarda i movimenti della categoria e decidi se è una spesa una tantum o da ridurre.'),
    priority: Math.min(3, 1 + a.pct / 100),
  }));
}
