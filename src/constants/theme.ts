export const palettes = {
  dark: {
    bg: '#07090d', card: '#141a24', cardAlt: '#0d1116', border: '#232c39', text: '#f4f6f8', muted: '#8e98a8',
    input: '#0b0f15', inputBorder: '#29313d', nav: '#0a0d12', navBorder: '#222a36', sheet: '#12161f', sheetBorder: '#262f3d',
    item: '#242a33', aiMsg: '#171e28', aiMsgBorder: '#232b38', overlay: '#000a', chip: '#202936', tile: '#151b24',
    accent: '#8fa4ff', positive: '#7be0b0', danger: '#ff9d9d', warn: '#e0c97b', onText: '#07090d', dangerBg: '#3b1f24', positiveBg: '#173b2c',
  },
  light: {
    bg: '#eef1f6', card: '#ffffff', cardAlt: '#f1f4f9', border: '#dfe4ec', text: '#10151d', muted: '#5a6472',
    input: '#ffffff', inputBorder: '#d3d9e2', nav: '#ffffff', navBorder: '#dfe4ec', sheet: '#ffffff', sheetBorder: '#dfe4ec',
    item: '#e7ebf1', aiMsg: '#eef1f6', aiMsgBorder: '#dfe4ec', overlay: '#0006', chip: '#e6eaf1', tile: '#f1f4f9',
    accent: '#4f6bff', positive: '#1f9d6b', danger: '#d64545', warn: '#a8841f', onText: '#ffffff', dangerBg: '#fbe4e4', positiveBg: '#dcf3e8',
  },
} as const;

export type Palette = { [K in keyof (typeof palettes)['dark']]: string };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 12, md: 16, lg: 22 } as const;
