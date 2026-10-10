import type { LexCode, LexData } from '../types.ts';
import { es } from './es.ts';
import { fr } from './fr.ts';
import { de } from './de.ts';
import { pt } from './pt.ts';
import { zh } from './zh.ts';
import { hi } from './hi.ts';
import { ar } from './ar.ts';
import { ru } from './ru.ts';
import { ja } from './ja.ts';
import { id } from './id.ts';

export const LEXICONS: Record<LexCode, LexData> = { es, fr, de, pt, zh, hi, ar, ru, ja, id };
