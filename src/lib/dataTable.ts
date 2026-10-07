/** Tabelle di dati per le domande con grafico: lettura di CSV incollato (o copiato da Excel/Fogli) e conversione inversa. Modulo PURO. */
export type Table = { labels: string[]; series: { name: string; values: number[] }[] };
export type ParseResult = { ok: true; table: Table } | { ok: false; error: string };

const toNum = (s: string, decComma: boolean): number => {
  const t = s.trim().replace(/\s/g, '');
  if (!t) return NaN;
  return Number(decComma ? t.replace(',', '.') : t);
};

/** Separatore: tab (Excel) > punto e virgola > virgola. Con tab o ';' la virgola è decimale. */
export function parseTable(text: string): ParseResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return { ok: false, error: 'Servono almeno una riga di intestazione e una di dati.' };
  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const dc = sep !== ',';
  const rows = lines.map((l) => l.split(sep).map((c) => c.trim()));
  const cols = Math.max(...rows.map((r) => r.length));
  if (cols < 2) return { ok: false, error: 'Servono almeno due colonne: etichette e valori.' };
  const first = rows[0];
  const hasHeader = first.slice(1).some((c) => !Number.isFinite(toNum(c, dc)));
  const header = hasHeader ? first : ['', ...Array.from({ length: cols - 1 }, (_, i) => `Serie ${i + 1}`)];
  const body = hasHeader ? rows.slice(1) : rows;
  if (!body.length) return { ok: false, error: 'Mancano le righe di dati.' };
  const labels = body.map((r, i) => r[0] || `Voce ${i + 1}`);
  const series: Table['series'] = [];
  for (let c = 1; c < cols; c++) {
    const values: number[] = [];
    for (let r = 0; r < body.length; r++) {
      const v = toNum(body[r][c] ?? '', dc);
      if (!Number.isFinite(v)) return { ok: false, error: `Valore non numerico alla riga ${r + 1 + (hasHeader ? 1 : 0)}, colonna ${c + 1}.` };
      values.push(v);
    }
    series.push({ name: header[c] || `Serie ${c}`, values });
  }
  return { ok: true, table: { labels, series } };
}

export function tableToText(t: Table): string {
  const head = ['', ...t.series.map((s) => s.name)].join(';');
  const rows = t.labels.map((l, i) => [l, ...t.series.map((s) => String(s.values[i]).replace('.', ','))].join(';'));
  return [head, ...rows].join('\n');
}

/** Valori da disegnare: sempre numeri finiti. */
export const chartExtent = (series: { values: number[] }[]) => {
  const all = series.flatMap((s) => s.values).filter(Number.isFinite);
  return { min: all.length ? Math.min(0, ...all) : 0, max: all.length ? Math.max(...all) : 1 };
};

/** Estremo "tondo" per l'asse (1, 2, 5 x 10^n). */
export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v)), f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}
