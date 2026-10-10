import pricingJson from './pricing.json' with { type: 'json' };
import type { Price, PriceUnit, ProviderInfo, TaskKind, Verification } from './types.ts';

/**
 * Registro dei fornitori AI: DATI, non codice.
 * Punteggi di qualita' (0-10), latenze, regioni e politiche di addestramento sono stime/dichiarazioni di PARTENZA da verificare
 * (vedi docs/ai-router.md). I prezzi stanno in pricing.json. Oggi NESSUN fornitore e' collegato: si collegano col server.
 */

const c = (quality: number, latencyMs: number, formats?: ('docx' | 'pdf' | 'slides' | 'sheet')[]) => ({ quality, latencyMs, ...(formats ? { formats } : {}) });
const ALL_DOCS: ('docx' | 'pdf' | 'slides' | 'sheet')[] = ['docx', 'pdf', 'slides', 'sheet'];

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'claude', name: 'Claude (Anthropic)', short: 'Claude', vendor: 'Anthropic', contextTokens: 200000, acceptsImages: true,
    caps: { chat: c(9, 2500), reasoning: c(9.5, 6000), vision_read: c(8.5, 3500), translate: c(9, 2500), summarize: c(9, 3000), document_create: c(9, 20000, ALL_DOCS), web_search: c(7.5, 6000) },
    regions: ['USA', 'UE'], trainsOnData: 'da verificare',
  },
  {
    id: 'gpt', name: 'GPT (OpenAI)', short: 'GPT', vendor: 'OpenAI', contextTokens: 128000, acceptsImages: true,
    caps: { chat: c(9, 2000), reasoning: c(9, 7000), vision_read: c(9, 3000), translate: c(8.5, 2000), summarize: c(8.5, 2500), document_create: c(8.5, 18000, ALL_DOCS), web_search: c(8, 5000) },
    regions: ['USA', 'UE'], trainsOnData: 'da verificare',
  },
  {
    id: 'gemini', name: 'Gemini (Google)', short: 'Gemini', vendor: 'Google', contextTokens: 1000000, acceptsImages: true,
    caps: { chat: c(8.5, 1800), reasoning: c(8.5, 5000), vision_read: c(9, 2800), translate: c(9, 1800), summarize: c(9, 2200), document_create: c(8, 16000, ['docx', 'pdf', 'slides', 'sheet']), web_search: c(9, 4000) },
    regions: ['USA', 'UE'], trainsOnData: 'da verificare',
  },
  {
    id: 'mistral', name: 'Mistral', short: 'Mistral', vendor: 'Mistral AI', contextTokens: 128000,
    caps: { chat: c(7.5, 1500), reasoning: c(7, 4000), translate: c(8, 1500), summarize: c(7.5, 1800), document_create: c(6.5, 12000, ['docx', 'pdf']) },
    regions: ['UE'], trainsOnData: 'da verificare',
  },
  {
    id: 'gpt_image', name: 'GPT Immagini (OpenAI)', short: 'GPT', vendor: 'OpenAI', note: 'Esempio per il compito "generare immagini" (famiglia gpt-image / DALL-E).', acceptsImages: true,
    caps: { image_generate: c(9, 15000), image_edit: c(8.5, 18000) },
    regions: ['USA'], trainsOnData: 'da verificare',
  },
  {
    id: 'imagen', name: 'Imagen (Google)', short: 'Imagen', vendor: 'Google', note: 'Esempio alternativo per le immagini.', acceptsImages: true,
    caps: { image_generate: c(8.5, 10000), image_edit: c(7.5, 12000) },
    regions: ['USA', 'UE'], trainsOnData: 'da verificare',
  },
  {
    id: 'midjourney', name: 'Midjourney', short: 'Midjourney', vendor: 'Midjourney', note: 'Esempio: da verificare se esiste un accesso via API ufficiale.',
    caps: { image_generate: c(9.5, 40000) },
    regions: ['USA'], trainsOnData: 'da verificare',
  },
  {
    id: 'suno', name: 'Suno (canzoni)', short: 'Suno', vendor: 'Suno', note: 'Esempio per la musica: da verificare la disponibilita\' di un\'API ufficiale.',
    caps: { music_generate: c(9, 60000) },
    regions: ['USA'], trainsOnData: 'da verificare',
  },
  {
    id: 'elevenlabs', name: 'ElevenLabs (voce)', short: 'ElevenLabs', vendor: 'ElevenLabs', note: 'Esempio per voce e trascrizione.',
    caps: { text_to_speech: c(9.5, 1500), speech_to_text: c(8.5, 2500) },
    regions: ['USA', 'UE'], trainsOnData: 'da verificare',
  },
  {
    id: 'whisper', name: 'Whisper (OpenAI)', short: 'Whisper', vendor: 'OpenAI', note: 'Esempio per la trascrizione.',
    caps: { speech_to_text: c(9, 3000) },
    regions: ['USA'], trainsOnData: 'da verificare',
  },
  {
    id: 'claude_agent', name: 'Agente Claude', short: 'Agente Claude', vendor: 'Anthropic', note: 'Compiti a piu\' passi con strumenti.', contextTokens: 200000, acceptsImages: true,
    caps: { agent_task: c(9, 60000) },
    regions: ['USA', 'UE'], trainsOnData: 'da verificare',
  },
  {
    id: 'openai_agents', name: 'Agenti OpenAI', short: 'Agenti OpenAI', vendor: 'OpenAI', note: 'Compiti a piu\' passi con strumenti.', contextTokens: 128000, acceptsImages: true,
    caps: { agent_task: c(8.5, 55000) },
    regions: ['USA'], trainsOnData: 'da verificare',
  },
  {
    id: 'perplexity', name: 'Perplexity (ricerca)', short: 'Perplexity', vendor: 'Perplexity', note: 'Esempio per la ricerca sul web con fonti.',
    caps: { web_search: c(9, 4500), chat: c(7, 3000) },
    regions: ['USA'], trainsOnData: 'da verificare',
  },
];

export const providerById = (id: string): ProviderInfo | undefined => PROVIDERS.find((p) => p.id === id);
export const providerName = (id: string): string => providerById(id)?.short ?? id;

/** Fornitori che sanno fare un compito. */
export const providersFor = (kind: TaskKind): ProviderInfo[] => PROVIDERS.filter((p) => !!p.caps[kind]);

// --- prezzi (configurazione sostituibile) ---
type PricingFile = { verification: Verification; prices: Record<string, Partial<Record<TaskKind, Price>>> };
const pricing = pricingJson as unknown as PricingFile;

export const PRICING_VERIFICATION: Verification = pricing.verification;
export const priceOf = (providerId: string, kind: TaskKind): Price | undefined => pricing.prices[providerId]?.[kind];

/** Quantita' tipica di una richiesta, per stimare il costo prima di spendere. */
export type Usage = { tokensIn?: number; tokensOut?: number; units?: number };

export const TYPICAL_USAGE: Record<TaskKind, Usage> = {
  chat: { tokensIn: 800, tokensOut: 500 }, reasoning: { tokensIn: 1000, tokensOut: 1500 }, vision_read: { tokensIn: 1500, tokensOut: 500 },
  image_generate: { units: 1 }, image_edit: { units: 1 }, music_generate: { units: 1 }, speech_to_text: { units: 1 }, text_to_speech: { units: 1 },
  document_create: { units: 1 }, agent_task: { units: 8 }, web_search: { units: 1 }, translate: { tokensIn: 500, tokensOut: 500 }, summarize: { tokensIn: 2000, tokensOut: 400 },
};

/** Costo stimato in valuta neutra. Sempre una STIMA (i prezzi sono da verificare). */
export function estimateCost(price: Price | undefined, usage: Usage): number {
  if (!price) return 0;
  const unit: PriceUnit = price.unit;
  if (unit === '1k_token') return ((usage.tokensIn ?? 0) / 1000) * (price.in ?? 0) + ((usage.tokensOut ?? 0) / 1000) * (price.out ?? 0);
  return (usage.units ?? 1) * (price.per ?? 0);
}

export const estimateProviderCost = (providerId: string, kind: TaskKind, usage: Usage = TYPICAL_USAGE[kind]): number => estimateCost(priceOf(providerId, kind), usage);

/** Etichette italiane dei compiti. */
export const KIND_LABEL: Record<TaskKind, string> = {
  chat: 'la conversazione', reasoning: 'il ragionamento', vision_read: 'la lettura delle immagini', image_generate: 'le immagini', image_edit: 'la modifica delle immagini',
  music_generate: 'le canzoni', speech_to_text: 'la trascrizione', text_to_speech: 'la lettura ad alta voce', document_create: 'i documenti', agent_task: 'gli agenti',
  web_search: 'la ricerca sul web', translate: 'la traduzione', summarize: 'i riassunti',
};
