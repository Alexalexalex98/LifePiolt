const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
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

module.exports = config;
