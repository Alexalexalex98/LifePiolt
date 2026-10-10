/** Tipi condivisi del router AI. Modulo puro (nessun alias '@/'). */

export type RouteImage = { uri: string; mime: string; width?: number; height?: number };
export type RouteRequest = { text: string; lang: string; images?: RouteImage[]; source: 'typed' | 'voice' };
export type RouteResult = {
  status: 'answered' | 'not_connected' | 'limit' | 'error';
  kind: string;
  text?: string;
  images?: RouteImage[];
  provider?: string;
  message: string;
};

export type TaskKind =
  | 'chat' | 'reasoning' | 'vision_read' | 'image_generate' | 'image_edit' | 'music_generate'
  | 'speech_to_text' | 'text_to_speech' | 'document_create' | 'agent_task' | 'web_search' | 'translate' | 'summarize';

export const TASK_KINDS: TaskKind[] = [
  'chat', 'reasoning', 'vision_read', 'image_generate', 'image_edit', 'music_generate',
  'speech_to_text', 'text_to_speech', 'document_create', 'agent_task', 'web_search', 'translate', 'summarize',
];

export type DocFormat = 'docx' | 'pdf' | 'slides' | 'sheet';

/** Gruppi di compiti mostrati all'utente nelle impostazioni (un'unica scelta per gruppo). */
export type TaskGroup = 'text' | 'vision' | 'image' | 'music' | 'document' | 'agent' | 'voice';
export const TASK_GROUPS: TaskGroup[] = ['text', 'vision', 'image', 'music', 'document', 'agent', 'voice'];

export const groupOf = (k: TaskKind): TaskGroup => {
  switch (k) {
    case 'vision_read': return 'vision';
    case 'image_generate': case 'image_edit': return 'image';
    case 'music_generate': return 'music';
    case 'document_create': return 'document';
    case 'agent_task': return 'agent';
    case 'speech_to_text': case 'text_to_speech': return 'voice';
    default: return 'text';
  }
};

export type Mode = 'economica' | 'bilanciata' | 'qualita';
export type Region = 'UE' | 'USA' | 'altro';

/** Unita' di costo: per 1k token (in/out), per immagine, per canzone, per minuto d'audio, per documento, per passo d'agente, per ricerca. */
export type PriceUnit = '1k_token' | 'image' | 'song' | 'audio_minute' | 'document' | 'agent_step' | 'search';

export type Price = { unit: PriceUnit; in?: number; out?: number; per?: number };

export type Verification = { status: 'stima da verificare' | 'verificato'; date: string; source: string };

export type Capability = {
  /** qualita' 0-10 per questo compito (giudizio di partenza, da rivedere con prove reali) */
  quality: number;
  /** latenza tipica in millisecondi */
  latencyMs: number;
  /** per i documenti: formati prodotti */
  formats?: DocFormat[];
};

export type ProviderInfo = {
  id: string;
  /** nome completo */
  name: string;
  /** nome breve nelle frasi: "Ho scelto GPT per..." */
  short: string;
  vendor: string;
  note?: string;
  /** finestra di contesto in token (testo) */
  contextTokens?: number;
  caps: Partial<Record<TaskKind, Capability>>;
  /** dove elabora i dati (dichiarato dal fornitore, DA VERIFICARE) */
  regions: Region[];
  /** usa i dati per addestrare? 'no' = dichiarato di no (API), 'da verificare' = non verificato */
  trainsOnData: 'no' | 'da verificare';
  /** accetta immagini in ingresso (per vision_read / image_edit) */
  acceptsImages?: boolean;
};

export type ServerRef = { baseUrl: string };

export type AttachmentRef = { id: string; kind: 'image' | 'audio' | 'file'; mime: string; bytes?: number };

export type ProxyConstraints = {
  maxCost?: number;
  euOnly?: boolean;
  noImages?: boolean;
  docFormat?: DocFormat;
  lang: string;
};

/** Corpo di POST /v1/ai/route (vedi docs/ai-router.md). */
export type ProxyRequest = {
  kind: TaskKind | 'rewrite';
  provider: string;
  prompt: string;
  attachments: AttachmentRef[];
  constraints: ProxyConstraints;
  /** contesto minimo, gia' ripulito (solo voci consentite) */
  context?: { key: string; value: string }[];
};

export type ProxyAsset = { kind: 'image' | 'audio' | 'document'; url: string; mime: string; title: string; width?: number; height?: number };

export type ProxyResponse = {
  ok: boolean;
  text?: string;
  assets?: ProxyAsset[];
  usage?: { tokensIn?: number; tokensOut?: number; units?: number; cost?: number };
  error?: { code: 'rate_limited' | 'provider_down' | 'content_blocked' | 'unauthorized' | 'quota' | 'bad_request' | 'not_connected'; message: string };
};

export interface ServerProxyClient {
  /** vero solo se il server e' configurato e l'utente ha un token */
  isConfigured(): boolean;
  route(req: ProxyRequest): Promise<ProxyResponse>;
}
