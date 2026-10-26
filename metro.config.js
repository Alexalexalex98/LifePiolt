const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
/* la cartella video/ (Remotion, con le sue dipendenze) non fa parte dell'app: Metro non deve né guardarla né indicizzarla */
const videoDir = path.join(__dirname, 'video').replace(/[\\/]/g, '[\\\\/]');
config.resolver.blockList = [].concat(config.resolver.blockList ?? [], new RegExp(`${videoDir}[\\\\/].*`));
const src = path.join(__dirname, 'src') + path.sep;
const shim = path.join(__dirname, 'src', 'lib', 'rn-shim.tsx');
const shimPressable = path.join(__dirname, 'src', 'lib', 'rn-shim-pressable.tsx');
const base = config.resolver.resolveRequest;

/**
 * Solo web: il codice in src/ prende <Pressable> da src/lib/rn-shim-pressable.tsx / rn-shim.tsx (hitSlop, feedback al tocco, errori mostrati).
 * <Text>/<TextInput> NON passano più di qui: sono in src/components/T.tsx (traduzione + testo più grande).
 */
const expoAssetShim = path.join(__dirname, 'src', 'lib', 'shims', 'ExpoAsset.js');
const missingShim = path.join(__dirname, 'src', 'lib', 'shims', 'missing.js');
/** Pacchetti nativi opzionali: se non sono installati (manca un `npm install`) l'app deve partire comunque. */
const OPTIONAL = new Set(['@shopify/react-native-skia', 'react-native-health-connect']);
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // avvio rapido (LP_FAST=1): le traduzioni (circa 10 MB) non entrano nel pacchetto; l'app resta in italiano, che è la lingua originale
  // LP_LANGS=en,de tiene le lingue elencate (circa 1 MB l'una) e toglie le altre
  const FAST = process.env.LP_FULL !== '1' && (process.env.LP_FAST === '1' || process.env.NODE_ENV !== 'production');
  const keep = (process.env.LP_LANGS ?? 'en').split(',').map((x) => x.trim()).filter(Boolean);
  const lang = /(^|[\\/])locales[\\/]([a-z]{2})\.json$/.exec(moduleName)?.[2];
  if (FAST && lang && !keep.includes(lang) && /[\\/]i18n[\\/]/.test(context.originModulePath)) {
    return { type: 'sourceFile', filePath: path.join(__dirname, 'src', 'lib', 'shims', 'emptyCatalog.json') };
  }
  if (OPTIONAL.has(moduleName)) {
    try { return (base ?? context.resolveRequest)(context, moduleName, platform); } catch { return { type: 'sourceFile', filePath: missingShim }; }
  }
  // expo-asset carica un modulo nativo che puo' mancare nell'app in esecuzione: lo si rende opzionale (vedi src/lib/shims/ExpoAsset.js)
  if (moduleName === './ExpoAsset' && /[\\/]node_modules[\\/]expo-asset[\\/]/.test(context.originModulePath)) {
    return { type: 'sourceFile', filePath: expoAssetShim };
  }
  // sul telefono (Expo Go) uso i componenti standard di react-native: l'alias è attivo solo sul web, dove è verificato
  if (platform !== 'web') return (base ?? context.resolveRequest)(context, moduleName, platform);
  const fromSrc = context.originModulePath.startsWith(src) && context.originModulePath !== shim && context.originModulePath !== shimPressable;
  if (fromSrc && moduleName === 'react-native') {
    return { type: 'sourceFile', filePath: shim };
  }
  if (fromSrc && moduleName === 'react-native-web/dist/exports/Pressable') {
    return { type: 'sourceFile', filePath: shimPressable };
  }
  return (base ?? context.resolveRequest)(context, moduleName, platform);
};

/**
 * Avvio più rapido (facoltativo): con LP_INLINE_REQUIRES=1 i moduli si leggono solo quando servono, non tutti all'apertura dell'app.
 * Non è attivo di base perché cambia quando partono i moduli: prova prima così e, se l'app si comporta bene, diventa la norma.
 */
if (process.env.LP_INLINE_REQUIRES === '1') {
  const prev = config.transformer.getTransformOptions;
  config.transformer.getTransformOptions = async (...args) => {
    const o = prev ? await prev(...args) : { transform: {} };
    return { ...o, transform: { ...(o.transform ?? {}), inlineRequires: true } };
  };
}

module.exports = config;
