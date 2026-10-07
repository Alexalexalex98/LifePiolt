const templates: { keywords: string[]; subtasks: [string, number][] }[] = [
  { keywords: ['business plan'], subtasks: [['Analisi di mercato', 3], ['Analisi finanziaria', 4], ['Descrizione del business', 2], ['Piano operativo', 2], ['Executive summary', 1]] },
  { keywords: ['sito web', 'sito internet'], subtasks: [['Definire struttura e sitemap', 2], ['Wireframe e design', 4], ['Sviluppo frontend', 8], ['Sviluppo backend', 6], ['Test e pubblicazione', 2]] },
  { keywords: ['presentazione', 'pitch deck'], subtasks: [['Struttura degli argomenti', 1], ['Raccolta dati e contenuti', 3], ['Design delle slide', 3], ['Prove e revisione', 1]] },
  { keywords: ['campagna marketing', 'campagna social'], subtasks: [['Definire target e obiettivi', 1], ['Creare i contenuti', 4], ['Pianificare il calendario di uscita', 1], ['Lanciare e monitorare', 2]] },
  { keywords: ['evento', 'organizzare un evento'], subtasks: [['Definire data e location', 2], ['Lista invitati e fornitori', 2], ['Logistica e materiali', 3], ['Promozione', 2], ["Giorno dell'evento", 4]] },
  { keywords: ['lancio prodotto'], subtasks: [['Definire posizionamento', 2], ['Materiali di lancio', 4], ['Piano di comunicazione', 2], ['Esecuzione del lancio', 3]] },
];

export function decomposeTextToSteps(text: string): { t: string; h: number }[] {
  const low = text.toLowerCase();
  const m = templates.find((tp) => tp.keywords.some((k) => low.includes(k)));
  if (m) return m.subtasks.map(([t, h]) => ({ t, h }));
  return [
    { t: 'Ricerca e raccolta informazioni: ' + text, h: 1 },
    { t: 'Definire obiettivi e requisiti: ' + text, h: 1 },
    { t: 'Prima bozza: ' + text, h: 2 },
    { t: 'Revisione e correzioni: ' + text, h: 1 },
    { t: 'Versione finale: ' + text, h: 1 },
  ];
}
