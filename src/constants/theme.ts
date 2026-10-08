/**
 * Token del tema: l'UNICO posto dove stanno colori, spaziature, raggi, dimensioni dei titoli e target minimi.
 * Nessun import: il file è usato anche dai test puri (tests/a11y.test.mjs).
 */
export const palettes = {
  dark: {
    mode: 'dark',
    bg: '#07090d', card: '#141a24', cardAlt: '#0d1116', border: '#232c39', text: '#f4f6f8', muted: '#8e98a8',
    input: '#0b0f15', inputBorder: '#29313d', nav: '#0a0d12', navBorder: '#222a36', sheet: '#12161f', sheetBorder: '#262f3d',
    item: '#242a33', aiMsg: '#171e28', aiMsgBorder: '#232b38', overlay: '#000a', chip: '#202936', tile: '#151b24',
    accent: '#8fa4ff', positive: '#7be0b0', danger: '#ff9d9d', warn: '#e0c97b', onText: '#07090d', dangerBg: '#3b1f24', positiveBg: '#173b2c',
    onAccent: '#07090d', toastBg: '#1c2431', toastBorder: '#2c3644', toastText: '#f4f6f8', navInactive: '#8e98a8',
  },
  light: {
    mode: 'light',
    bg: '#eef1f6', card: '#ffffff', cardAlt: '#f1f4f9', border: '#d3dae5', text: '#10151d', muted: '#566070',
    input: '#ffffff', inputBorder: '#c3cbd8', nav: '#ffffff', navBorder: '#d3dae5', sheet: '#ffffff', sheetBorder: '#d3dae5',
    item: '#e3e8ef', aiMsg: '#e8ecf3', aiMsgBorder: '#d3dae5', overlay: '#0006', chip: '#e1e6ee', tile: '#f1f4f9',
    accent: '#3f5bea', positive: '#14774f', danger: '#c02f2f', warn: '#7d5f06', onText: '#ffffff', dangerBg: '#fbe4e4', positiveBg: '#dcf3e8',
    onAccent: '#ffffff', toastBg: '#1c2431', toastBorder: '#2c3644', toastText: '#f4f6f8', navInactive: '#566070',
  },
  /** Alto contrasto: nero/bianco puri, testo secondario quasi pieno, bordi ben visibili, accento molto saturo. */
  darkHC: {
    mode: 'dark',
    bg: '#000000', card: '#0a0c10', cardAlt: '#000000', border: '#9aa6bb', text: '#ffffff', muted: '#e3e8f0',
    input: '#000000', inputBorder: '#b4bfd2', nav: '#000000', navBorder: '#9aa6bb', sheet: '#05070a', sheetBorder: '#b4bfd2',
    item: '#6b778c', aiMsg: '#10141b', aiMsgBorder: '#9aa6bb', overlay: '#000c', chip: '#1c2330', tile: '#0a0c10',
    accent: '#b9c7ff', positive: '#8cf0c0', danger: '#ffb3b3', warn: '#ffe08a', onText: '#000000', dangerBg: '#4a1219', positiveBg: '#0b3a28',
    onAccent: '#000000', toastBg: '#000000', toastBorder: '#ffffff', toastText: '#ffffff', navInactive: '#e3e8f0',
  },
  lightHC: {
    mode: 'light',
    bg: '#ffffff', card: '#ffffff', cardAlt: '#f4f6fa', border: '#4a5568', text: '#000000', muted: '#1f2733',
    input: '#ffffff', inputBorder: '#3b4556', nav: '#ffffff', navBorder: '#4a5568', sheet: '#ffffff', sheetBorder: '#3b4556',
    item: '#8a95a8', aiMsg: '#eef1f6', aiMsgBorder: '#4a5568', overlay: '#0008', chip: '#e1e6ee', tile: '#f4f6fa',
    accent: '#1f33c8', positive: '#0b5a38', danger: '#a11d1d', warn: '#5e4700', onText: '#ffffff', dangerBg: '#fde1e1', positiveBg: '#d3f0e1',
    onAccent: '#ffffff', toastBg: '#000000', toastBorder: '#000000', toastText: '#ffffff', navInactive: '#1f2733',
  },
} as const;

export type Palette = { [K in keyof (typeof palettes)['dark']]: string };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 12, md: 16, lg: 22, pill: 999, field: 14 } as const;

/** Scala tipografica unica (px prima dello scaling "testo grande"). */
export const type = { caption: 11, small: 13, body: 15, lead: 17, title: 24, display: 38 } as const;

/** Linee guida Apple: target tattile minimo 44pt. */
export const MIN_HIT = 44;
/** Moltiplicatore applicato ai font quando "Testo più grande" è attivo. */
export const TEXT_LG_SCALE = 1.15;
/** Spazio in fondo ai contenuti scrollabili: tab bar + pulsante flottante di Theia non devono coprire l'ultima riga. */
export const BOTTOM_CLEARANCE = 130;
