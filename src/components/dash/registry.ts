import type { ComponentType } from 'react';

import { AgendaW, KcalW, LifeScoreW, MissingW, MoodW, TasksW, TrainW, WaterW, WeekW, metricW, type WProps } from '@/components/dash/widgetsA';
import { BalanceW, BillsW, LpW, MessagesW, NewsW, NotifsW, PortfolioW, SavingW, SpendW, StockW, TipW, TripW, WatchW, shortcutW } from '@/components/dash/widgetsB';

export type CatId = 'oggi' | 'benessere' | 'finanza' | 'mercati' | 'notizie' | 'network' | 'plan' | 'viaggi' | 'theia' | 'scorciatoie';
export const CATS: { id: CatId; label: string; icon: string; color: string }[] = [
  { id: 'oggi', label: 'Oggi', icon: 'sun', color: '#8fa4ff' },
  { id: 'benessere', label: 'Benessere', icon: 'lifefitness', color: '#ff9d6e' },
  { id: 'finanza', label: 'Finanza', icon: 'lifefinance', color: '#7be0b0' },
  { id: 'mercati', label: 'Mercati', icon: 'trend-up', color: '#7be0b0' },
  { id: 'notizie', label: 'Notizie', icon: 'note', color: '#e0c97b' },
  { id: 'network', label: 'Network', icon: 'lifenetwork', color: '#c9b6ff' },
  { id: 'plan', label: 'Plan e task', icon: 'calendar', color: '#8fb3ff' },
  { id: 'viaggi', label: 'Viaggi', icon: 'lifetravel', color: '#e0c97b' },
  { id: 'theia', label: 'Theia', icon: 'sparkle', color: '#8fa4ff' },
  { id: 'scorciatoie', label: 'Scorciatoie', icon: 'plus', color: '#a8b2c0' },
];

export type WidgetDef = {
  type: string; cat: CatId; sub?: string; title: string; desc: string; icon: string; color: string;
  /** forme possibili, in quadratini (larghezza x altezza): un grafico non sta in 1 o 2 quadratini */
  sizes: string[]; def: string; Comp: ComponentType<WProps>;
  /** il widget ha una scelta da fare (per ora: quale titolo seguire) */
  pick?: 'stock';
};

const N = ['1x1', '2x1', '1x2', '2x2', '4x1'];
const NB = ['1x1', '2x1', '1x2', '2x2', '4x1', '4x2', '2x4'];
const S1 = ['1x1', '2x1'];
const FIT = '#ff9d6e', FOOD = '#5fd39a', HEALTH = '#6ec9dd', MIND = '#c9b6ff', MONEY = '#7be0b0', PLAN = '#8fb3ff';

export const WIDGETS: WidgetDef[] = [
  { type: 'mood', cat: 'oggi', title: 'Umore', desc: 'Segni come ti senti con un tocco', icon: 'smile', color: MIND, sizes: ['1x1', '2x1', '2x2', '4x1'], def: '2x1', Comp: MoodW },
  { type: 'lifescore', cat: 'oggi', title: 'Life Score', desc: 'Il punteggio della tua vita e come cambia', icon: 'activity', color: '#8fa4ff', sizes: ['1x1', '2x1', '2x2', '4x1', '4x2', '4x3'], def: '2x2', Comp: LifeScoreW },
  { type: 'missing', cat: 'oggi', title: 'Cosa ti manca oggi', desc: 'Umore, acqua, pasti, allenamento e task: le spunte del giorno', icon: 'checksquare', color: '#8fa4ff', sizes: ['2x2', '4x2', '2x4', '4x3', '3x4'], def: '2x2', Comp: MissingW },

  { type: 'train', cat: 'benessere', sub: 'Fitness', title: 'Allenamento di oggi', desc: 'Cosa c\'è in programma e a che punto sei', icon: 'lifefitness', color: FIT, sizes: ['2x1', '2x2', '4x1'], def: '2x1', Comp: TrainW },
  { type: 'week', cat: 'benessere', sub: 'Fitness', title: 'La tua settimana', desc: 'I sette giorni con gli allenamenti fatti', icon: 'calendar', color: FIT, sizes: ['4x1', '4x2'], def: '4x1', Comp: WeekW },
  { type: 'water', cat: 'benessere', sub: 'Cibo', title: 'Acqua', desc: 'Quanto hai bevuto oggi, con +1 bicchiere a un tocco', icon: 'drop', color: HEALTH, sizes: N, def: '2x1', Comp: WaterW },
  { type: 'kcal', cat: 'benessere', sub: 'Cibo', title: 'Calorie e pasti', desc: 'Calorie di oggi e macro', icon: 'meal', color: FOOD, sizes: ['1x1', '2x1', '2x2', '4x1', '4x2'], def: '2x2', Comp: KcalW },
  { type: 'diet', cat: 'benessere', sub: 'Cibo', title: 'Qualità del cibo', desc: 'Come mangi, da 0 a 100', icon: 'meal', color: FOOD, sizes: NB, def: '2x1', Comp: metricW({ id: 'diet', label: 'Qualità del cibo', icon: 'meal', color: FOOD, page: 'fitnessDiary' }) },
  { type: 'steps', cat: 'benessere', sub: 'Salute e mente', title: 'Passi', desc: 'I passi di oggi e l\'andamento', icon: 'activity', color: HEALTH, sizes: NB, def: '2x1', Comp: metricW({ id: 'steps', label: 'Passi', icon: 'activity', page: 'lifehealth' }) },
  { type: 'sleep', cat: 'benessere', sub: 'Salute e mente', title: 'Sonno', desc: 'Le ore dormite', icon: 'clock', color: '#7be0b0', sizes: NB, def: '2x1', Comp: metricW({ id: 'sleep', label: 'Sonno', icon: 'clock', page: 'lifehealth' }) },
  { type: 'hr', cat: 'benessere', sub: 'Salute e mente', title: 'Battito a riposo', desc: 'Frequenza cardiaca a riposo', icon: 'heart', color: '#ff9d9d', sizes: NB, def: '2x1', Comp: metricW({ id: 'hr', label: 'Battito a riposo', icon: 'heart', page: 'lifehealth' }) },
  { type: 'weight', cat: 'benessere', sub: 'Salute e mente', title: 'Peso', desc: 'Il peso e come cambia', icon: 'activity', color: '#e0c97b', sizes: NB, def: '2x1', Comp: metricW({ id: 'weight', label: 'Peso', icon: 'activity', page: 'lifehealth' }) },
  { type: 'energy', cat: 'benessere', sub: 'Salute e mente', title: 'Energia attiva', desc: 'Calorie bruciate con il movimento', icon: 'activity', color: '#ff8a5b', sizes: NB, def: '2x1', Comp: metricW({ id: 'energy', label: 'Energia attiva', icon: 'activity', page: 'lifehealth' }) },
  { type: 'exercise', cat: 'benessere', sub: 'Salute e mente', title: 'Minuti di esercizio', desc: 'Quanto ti muovi ogni giorno', icon: 'timer', color: HEALTH, sizes: NB, def: '2x1', Comp: metricW({ id: 'exercise', label: 'Esercizio', icon: 'timer', page: 'lifehealth' }) },
  { type: 'stress', cat: 'benessere', sub: 'Salute e mente', title: 'Stress (stima)', desc: 'Una stima dal battito e dall\'HRV', icon: 'heart', color: '#ffb84f', sizes: NB, def: '2x1', Comp: metricW({ id: 'stress', label: 'Stress (stima)', icon: 'heart', page: 'mood' }) },
  { type: 'mindful', cat: 'benessere', sub: 'Salute e mente', title: 'Mindfulness', desc: 'Minuti di pausa e respirazione', icon: 'smile', color: MIND, sizes: NB, def: '2x1', Comp: metricW({ id: 'mindful', label: 'Mindfulness', icon: 'smile', page: 'mood' }) },

  { type: 'balance', cat: 'finanza', title: 'Saldo', desc: 'Quanto hai, entrate e uscite del mese', icon: 'wallet', color: MONEY, sizes: ['1x1', '2x1', '2x2', '4x1', '4x2', '4x3'], def: '2x2', Comp: BalanceW },
  { type: 'spend', cat: 'finanza', title: 'Spese del mese', desc: 'Quanto hai speso finora', icon: 'trend-down', color: '#ff9d9d', sizes: ['1x1', '2x1', '2x2', '4x1', '4x2'], def: '2x1', Comp: SpendW },
  { type: 'saving', cat: 'finanza', title: 'Risparmio', desc: 'Che parte del reddito metti da parte', icon: 'coin', color: MONEY, sizes: ['1x1', '2x1', '1x2', '2x2', '4x1'], def: '2x1', Comp: SavingW },
  { type: 'bills', cat: 'finanza', title: 'Bollette e abbonamenti', desc: 'Le voci fisse al mese', icon: 'file', color: '#e0c97b', sizes: ['2x1', '2x2', '4x2', '2x4'], def: '2x2', Comp: BillsW },
  { type: 'lp', cat: 'finanza', title: 'LifePoints', desc: 'Il tuo saldo in LP', icon: 'coin', color: '#8fa4ff', sizes: ['1x1', '2x1', '4x1'], def: '1x1', Comp: LpW },

  { type: 'stock', cat: 'mercati', title: 'Titolo con grafico', desc: 'Un titolo a tua scelta, con prezzo e andamento', icon: 'trend-up', color: MONEY, sizes: ['2x1', '2x2', '4x1', '4x2', '4x3', '3x4'], def: '2x2', Comp: StockW, pick: 'stock' },
  { type: 'watch', cat: 'mercati', title: 'Titoli seguiti', desc: 'La lista dei titoli che segui', icon: 'chart', color: MONEY, sizes: ['2x2', '4x2', '2x4', '4x3', '3x4'], def: '4x2', Comp: WatchW },
  { type: 'portfolio', cat: 'mercati', title: 'Portafoglio', desc: 'Valore e guadagno dei tuoi investimenti', icon: 'briefcase', color: MONEY, sizes: ['2x1', '2x2', '4x2'], def: '2x2', Comp: PortfolioW },

  { type: 'news', cat: 'notizie', title: 'Notizie', desc: 'Titoli di testate svizzere in italiano e italiane, aggiornati di continuo', icon: 'note', color: '#e0c97b', sizes: ['4x1', '2x2', '4x2', '2x4', '4x3', '3x4'], def: '4x2', Comp: NewsW },

  { type: 'messages', cat: 'network', title: 'Messaggi', desc: 'Quanti messaggi hai da leggere', icon: 'send', color: '#c9b6ff', sizes: ['1x1', '2x1', '1x2'], def: '1x1', Comp: MessagesW },
  { type: 'notifs', cat: 'network', title: 'Notifiche', desc: 'Le novità per te', icon: 'bell', color: '#c9b6ff', sizes: ['1x1', '2x1', '1x2'], def: '1x1', Comp: NotifsW },

  { type: 'agenda', cat: 'plan', title: 'Agenda di oggi', desc: 'Il prossimo impegno e la lista di oggi', icon: 'calendar', color: PLAN, sizes: ['2x1', '4x1', '2x2', '4x2', '2x4', '4x3'], def: '4x1', Comp: AgendaW },
  { type: 'tasks', cat: 'plan', title: 'Task', desc: 'Quanti ne hai aperti e quali scadono', icon: 'tasks', color: PLAN, sizes: ['1x1', '2x1', '2x2', '4x2', '2x4'], def: '2x2', Comp: TasksW },

  { type: 'trip', cat: 'viaggi', title: 'Prossimo viaggio', desc: 'Quanti giorni mancano', icon: 'lifetravel', color: '#e0c97b', sizes: ['2x1', '2x2', '4x1'], def: '2x1', Comp: TripW },

  { type: 'tip', cat: 'theia', title: 'Da guardare oggi', desc: 'Il segnale più importante che trova Theia', icon: 'sparkle', color: '#8fa4ff', sizes: ['4x1', '2x2', '4x2'], def: '4x1', Comp: TipW },
  { type: 'ask', cat: 'theia', title: 'Chiedi a Theia', desc: 'Apri la chat', icon: 'ai', color: '#8fa4ff', sizes: S1, def: '1x1', Comp: shortcutW({ icon: 'ai', label: 'Chiedi a Theia', page: 'ai', color: '#8fa4ff' }) },

  { type: 'sc-meal', cat: 'scorciatoie', title: 'Scatta un pasto', desc: 'Foto del piatto e analisi', icon: 'camera', color: FOOD, sizes: S1, def: '1x1', Comp: shortcutW({ icon: 'camera', label: 'Scatta un pasto', page: 'fitnessMeal', params: { start: 'camera' }, color: FOOD }) },
  { type: 'sc-move', cat: 'scorciatoie', title: 'Aggiungi un movimento', desc: 'Spesa o entrata', icon: 'plus', color: MONEY, sizes: S1, def: '1x1', Comp: shortcutW({ icon: 'plus', label: 'Nuovo movimento', page: 'lifefinance', color: MONEY }) },
  { type: 'sc-train', cat: 'scorciatoie', title: 'Inizia un allenamento', desc: 'Apri LifeFitness', icon: 'lifefitness', color: FIT, sizes: S1, def: '1x1', Comp: shortcutW({ icon: 'lifefitness', label: 'Allenati', page: 'lifefitness', color: FIT }) },
  { type: 'sc-note', cat: 'scorciatoie', title: 'Nuova nota', desc: 'Scrivi al volo', icon: 'note', color: '#8fb3ff', sizes: S1, def: '1x1', Comp: shortcutW({ icon: 'note', label: 'Nuova nota', page: 'noteedit', color: '#8fb3ff' }) },
  { type: 'sc-task', cat: 'scorciatoie', title: 'Nuovo task', desc: 'Aggiungi una cosa da fare', icon: 'tasks', color: PLAN, sizes: S1, def: '1x1', Comp: shortcutW({ icon: 'tasks', label: 'Nuovo task', page: 'lifetask', color: PLAN }) },
  { type: 'sc-chat', cat: 'scorciatoie', title: 'Messaggi', desc: 'Apri le chat', icon: 'send', color: '#c9b6ff', sizes: S1, def: '1x1', Comp: shortcutW({ icon: 'send', label: 'Messaggi', page: 'messagesPage', color: '#c9b6ff' }) },
];
export const WBY: Record<string, WidgetDef> = Object.fromEntries(WIDGETS.map((w) => [w.type, w]));
void MIND;
