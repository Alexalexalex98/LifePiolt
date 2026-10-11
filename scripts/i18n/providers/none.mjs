// Nessun motore: solo report (equivale a --dry-run senza chiavi).
export function create() {
  return { name: 'none', maskStyle: 'brackets', batchSize: 40, concurrency: 1, isAvailable: () => true, supports: () => true, async translateBatch() { throw new Error('provider none: nessuna traduzione'); } };
}
export default { create, envKeys: [], explicitOnly: true, reportOnly: true };
