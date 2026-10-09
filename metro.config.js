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
config.resolver.resolveRequest = (context, moduleName, platform) => {
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
