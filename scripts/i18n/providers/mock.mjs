// Provider finto per test e prove a secco: restituisce "[lang] testo" preservando i token. Per le lingue non latine
// aggiunge un carattere dello script atteso (cosi' i controlli qualita' passano). Nessuna rete.
const MARK = { zh: '译', ja: '訳', hi: 'अ', ar: 'ت', ru: 'я' };

export function create() {
  return {
    name: 'mock',
    maskStyle: 'brackets',
    batchSize: 40,
    concurrency: 2,
    calls: 0,
    isAvailable: () => true,
    supports: () => true,
    async translateBatch({ texts, to }) {
      this.calls++;
      return texts.map((t) => `[${to}] ${MARK[to] ? MARK[to] + ' ' : ''}${to === 'en' ? t.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : t}`);
    },
  };
}
export default { create, envKeys: [], explicitOnly: true };
