/** Stessa configurazione di app.json. In sviluppo (avvio rapido, di base) il React Compiler resta spento: rallenta molto il primo pacchetto. Le build per lo store non usano LP_FAST e lo tengono acceso. */
/** Con LP_ASYNC=1 le pagine si caricano solo quando le apri (Expo Router, modalità sperimentale): il primo caricamento è molto più corto, ma ogni pagina nuova si scarica la prima volta che la apri. */
const plugins = (config) => (process.env.LP_ASYNC === '1' ? (config.plugins ?? []).map((p) => (p === 'expo-router' ? ['expo-router', { asyncRoutes: { default: 'development' } }] : p)) : config.plugins);

/** Di base l'avvio in sviluppo è veloce (anche con `npx expo start`). Le build per lo store (NODE_ENV=production) e LP_FULL=1 usano la configurazione completa. */
const FAST = process.env.LP_FULL !== '1' && (process.env.LP_FAST === '1' || process.env.NODE_ENV !== 'production');

module.exports = ({ config }) => ({
  ...config,
  plugins: plugins(config),
  experiments: { ...(config.experiments ?? {}), reactCompiler: FAST ? false : (config.experiments?.reactCompiler ?? false) },
});
