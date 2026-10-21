/** Stessa configurazione di app.json. Con LP_FAST=1 (avvio rapido in sviluppo) il React Compiler resta spento: rallenta molto il primo pacchetto. Le build per lo store non usano LP_FAST e lo tengono acceso. */
/** Con LP_ASYNC=1 le pagine si caricano solo quando le apri (Expo Router, modalità sperimentale): il primo caricamento è molto più corto, ma ogni pagina nuova si scarica la prima volta che la apri. */
const plugins = (config) => (process.env.LP_ASYNC === '1' ? (config.plugins ?? []).map((p) => (p === 'expo-router' ? ['expo-router', { asyncRoutes: { default: 'development' } }] : p)) : config.plugins);

module.exports = ({ config }) => ({
  ...config,
  plugins: plugins(config),
  experiments: { ...(config.experiments ?? {}), reactCompiler: process.env.LP_FAST === '1' ? false : (config.experiments?.reactCompiler ?? false) },
});
