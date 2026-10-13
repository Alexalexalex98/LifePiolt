/**
 * PDF di esempio (modulo PURO, nessun alias '@/'): per i file dimostrativi di LifeDrive che non hanno un file vero dietro.
 * Una pagina A4 con il titolo e qualche riga, con tabella dei riferimenti corretta (si apre in qualunque lettore).
 */
const ascii = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '?').replace(/([\\()])/g, '\\$1');

export function buildSamplePdf(title: string, lines: string[]): Uint8Array {
  const stream: string[] = ['BT', '/F1 22 Tf', '56 780 Td', `(${ascii(title).slice(0, 60)}) Tj`, '/F1 12 Tf', '0 -34 Td', '16 TL'];
  for (const l of lines.slice(0, 40)) stream.push(`(${ascii(l).slice(0, 90)}) Tj`, 'T*');
  stream.push('ET');
  const content = stream.join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}

/** Righe d'esempio per un documento dimostrativo, in base al nome. */
export function sampleLines(name: string): string[] {
  const n = name.toLowerCase();
  const kind = /contratto/.test(n) ? 'Contratto' : /referto|analisi/.test(n) ? 'Referto' : /fattura|ricevuta/.test(n) ? 'Ricevuta' : /preventivo/.test(n) ? 'Preventivo' : /orario/.test(n) ? 'Orario' : 'Documento';
  return [
    `${kind} di esempio`, '', 'Questo e un documento dimostrativo creato da LifePilot:', 'il file originale non e stato caricato in questa anteprima.', '',
    'Quando carichi un tuo file (PDF o foto) qui vedrai il suo contenuto,', 'potrai leggerlo, condividerlo in chat o mostrarlo in una diretta.',
  ];
}
