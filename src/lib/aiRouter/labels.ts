import type { TaskGroup, TaskKind } from './types.ts';

/** Nomi brevi dei compiti per i messaggi ("un'immagine", "una canzone"...). Nessun t() a livello di modulo: sono chiavi italiane che i componenti traducono. */
export const KIND_LABEL_SHORT: Record<TaskKind, string> = {
  chat: 'una risposta', reasoning: 'un ragionamento', vision_read: 'la lettura di un\'immagine', image_generate: 'un\'immagine', image_edit: 'la modifica di un\'immagine', music_generate: 'una canzone',
  speech_to_text: 'una trascrizione', text_to_speech: 'una lettura ad alta voce', document_create: 'un documento', agent_task: 'un agente', web_search: 'una ricerca sul web', translate: 'una traduzione', summarize: 'un riassunto',
};
export const KIND_NAME: Record<TaskKind, string> = {
  chat: 'Conversazione', reasoning: 'Ragionamento', vision_read: 'Lettura immagini', image_generate: 'Creazione immagini', image_edit: 'Modifica immagini', music_generate: 'Canzoni',
  speech_to_text: 'Trascrizione', text_to_speech: 'Lettura ad alta voce', document_create: 'Documenti', agent_task: 'Agenti', web_search: 'Ricerca sul web', translate: 'Traduzione', summarize: 'Riassunti',
};
export const GROUP_NAME: Record<TaskGroup, string> = {
  text: 'Testo e risposte', vision: 'Immagini lette', image: 'Immagini create', music: 'Canzoni', document: 'Documenti', agent: 'Agenti', voice: 'Voce',
};
export const GROUP_HINT: Record<TaskGroup, string> = {
  text: 'Conversazione, ragionamento, traduzioni, riassunti e ricerca sul web.',
  vision: 'Quando alleghi una foto e chiedi cosa c\'è dentro.',
  image: 'Quando chiedi di disegnare o modificare un\'immagine.',
  music: 'Quando chiedi di comporre una canzone.',
  document: 'Quando chiedi un documento, una presentazione, un PDF o un foglio di calcolo.',
  agent: 'Compiti a più passi che un agente svolge da solo.',
  voice: 'Trascrizione di audio e lettura ad alta voce.',
};
export const GROUP_KINDS: Record<TaskGroup, TaskKind[]> = {
  text: ['chat', 'reasoning', 'translate', 'summarize', 'web_search'], vision: ['vision_read'], image: ['image_generate', 'image_edit'], music: ['music_generate'],
  document: ['document_create'], agent: ['agent_task'], voice: ['speech_to_text', 'text_to_speech'],
};
