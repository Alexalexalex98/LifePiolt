const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const src = path.join(__dirname, 'src') + path.sep;
const shim = path.join(__dirname, 'src', 'lib', 'rn-shim.tsx');
const base = config.resolver.resolveRequest;

/**
 * Il codice in src/ prende <Text> da src/lib/rn-shim.tsx: identico a quello di react-native, ma rispetta
 * "Testo più grande" (Impostazioni > Accessibilità) anche per i testi con fontSize fisso.
 * - nativo: l'import 'react-native' viene dirottato sul shim (che ri-esporta tutto il resto invariato);
 * - web: babel-preset-expo trasforma l'import in 'react-native-web/dist/exports/Text', che si dirotta sul default del shim.
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const fromSrc = context.originModulePath.startsWith(src) && context.originModulePath !== shim;
  if (fromSrc && (moduleName === 'react-native' || moduleName === 'react-native-web/dist/exports/Text')) {
    return { type: 'sourceFile', filePath: shim };
  }
  return (base ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
