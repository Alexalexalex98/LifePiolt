/** Il «template» di un video: tutto ciò che si modifica sta qui, in videos/<id>.json. */
export type Scene = {
  /** id della fase registrata in capture/scenarios/<capture>.mjs */
  cue: string;
  /** frase (o frasi brevi) del voice over, in inglese */
  say: string | string[];
  /** testo grande opzionale in alto durante la scena (sostituisce il titolo) */
  title?: string;
};
export type VideoSpec = {
  id: string;
  /** nome dello scenario registrato (di solito uguale all'id) */
  capture: string;
  /** testo in alto per tutto il video */
  hook: string;
  accent: string;
  /** voce e tono (vedi README) */
  voice?: { voice?: string; instructions?: string };
  scenes: Scene[];
  outro: { title: string; subtitle: string; cta: string };
  /** sfondo a gradiente [alto, basso] */
  bg?: [string, string];
  /** musica di sottofondo (public/music/<file>, volume 0-1); `null` per nessuna musica */
  music?: { file?: string; volume?: number } | null;
};
export type CaptureMeta = {
  name: string; fps: number; view: { width: number; height: number }; duration: number;
  cues: { id: string; start: number; end: number }[];
  taps: { t: number; x: number; y: number }[];
  focuses: { t: number; x: number; y: number; w: number; h: number; dur: number }[];
};
export type AudioMeta = { sentences: { scene: number; i: number; text: string; file: string; duration: number }[] };

export type PlannedSentence = { text: string; start: number; dur: number; file?: string; words: { w: string; start: number; end: number }[] };
export type PlannedScene = { cue: CaptureMeta['cues'][number]; start: number; dur: number; rate: number; playDur: number; sentences: PlannedSentence[]; title?: string };
export type Plan = { scenes: PlannedScene[]; introEnd: number; outroStart: number; total: number };
