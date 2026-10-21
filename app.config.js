/** Stessa configurazione di app.json. Con LP_FAST=1 (avvio rapido in sviluppo) il React Compiler resta spento: rallenta molto il primo pacchetto. Le build per lo store non usano LP_FAST e lo tengono acceso. */
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...(config.experiments ?? {}), reactCompiler: process.env.LP_FAST === '1' ? false : (config.experiments?.reactCompiler ?? false) },
});
