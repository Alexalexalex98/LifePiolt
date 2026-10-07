export const palettes = {
  dark: {
    bg: '#07090d',
    card: '#141a24',
    cardAlt: '#0d1116',
    border: '#232c39',
    text: '#f4f6f8',
    muted: '#8e98a8',
    input: '#0b0f15',
    inputBorder: '#29313d',
    accent: '#8fa4ff',
    positive: '#7be0b0',
    danger: '#ff9d9d',
    onText: '#07090d',
  },
  light: {
    bg: '#eef1f6',
    card: '#ffffff',
    cardAlt: '#f1f4f9',
    border: '#dfe4ec',
    text: '#10151d',
    muted: '#5a6472',
    input: '#ffffff',
    inputBorder: '#d3d9e2',
    accent: '#4f6bff',
    positive: '#1f9d6b',
    danger: '#d64545',
    onText: '#ffffff',
  },
} as const;

export type Palette = { [K in keyof (typeof palettes)['dark']]: string };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 12, md: 16, lg: 22 } as const;
