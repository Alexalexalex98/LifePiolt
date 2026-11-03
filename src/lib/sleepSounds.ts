import type { AudioSource } from 'expo-audio';

import { MANIFEST } from './soundsManifest';

/**
 * I suoni per dormire e concentrarsi: i file stanno in assets/sounds (nome `gruppo__titolo.mp3`) e si registrano con `npm run sounds:build`.
 * Funzionano anche offline. Vedi assets/sounds/LEGGIMI.md per come aggiungerne e per le licenze.
 */
export type SoundGroup = 'natura' | 'rumori' | 'musica' | 'meditazione' | 'focus';
export type Sound = { id: string; label: string; group: SoundGroup; src: AudioSource };
export const SOUNDS: Sound[] = MANIFEST;
export const GROUP_LABEL: Record<SoundGroup, string> = { natura: 'Natura', rumori: 'Rumori', musica: 'Musica', meditazione: 'Meditazione', focus: 'Focus' };
export const soundById = (id: string) => SOUNDS.find((s) => s.id === id);
