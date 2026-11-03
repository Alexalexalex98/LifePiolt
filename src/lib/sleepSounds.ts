import type { AudioSource } from 'expo-audio';

/** I suoni per dormire e concentrarsi: sintetizzati da noi (scripts/make-sounds.py), quindi liberi da diritti d'autore. Sono loop senza stacco e funzionano anche offline. */
export type SoundGroup = 'natura' | 'rumori' | 'musica';
export type Sound = { id: string; label: string; group: SoundGroup; src: AudioSource };
/* eslint-disable @typescript-eslint/no-require-imports */
export const SOUNDS: Sound[] = [
  { id: 'pioggia', label: 'Pioggia', group: 'natura', src: require('../../assets/sounds/pioggia.mp3') },
  { id: 'onde', label: 'Onde del mare', group: 'natura', src: require('../../assets/sounds/onde.mp3') },
  { id: 'vento', label: 'Vento', group: 'natura', src: require('../../assets/sounds/vento.mp3') },
  { id: 'ruscello', label: 'Ruscello', group: 'natura', src: require('../../assets/sounds/ruscello.mp3') },
  { id: 'fuoco', label: 'Camino', group: 'natura', src: require('../../assets/sounds/fuoco.mp3') },
  { id: 'grilli', label: 'Notte e grilli', group: 'natura', src: require('../../assets/sounds/grilli.mp3') },
  { id: 'rumore-bianco', label: 'Rumore bianco', group: 'rumori', src: require('../../assets/sounds/rumore-bianco.mp3') },
  { id: 'rumore-rosa', label: 'Rumore rosa', group: 'rumori', src: require('../../assets/sounds/rumore-rosa.mp3') },
  { id: 'rumore-bruno', label: 'Rumore bruno', group: 'rumori', src: require('../../assets/sounds/rumore-bruno.mp3') },
  { id: 'musica-sonno', label: 'Musica per dormire', group: 'musica', src: require('../../assets/sounds/musica-sonno.mp3') },
  { id: 'musica-calma', label: 'Musica calma', group: 'musica', src: require('../../assets/sounds/musica-calma.mp3') },
];
export const GROUP_LABEL: Record<SoundGroup, string> = { natura: 'Natura', rumori: 'Rumori', musica: 'Musica' };
export const soundById = (id: string) => SOUNDS.find((s) => s.id === id);
