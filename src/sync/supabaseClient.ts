import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import type { SupabaseLike } from './supabaseTransport.ts';

let cached: { key: string; client: SupabaseClient } | null = null;

/** Un solo client per indirizzo+chiave. La sessione resta sul dispositivo (AsyncStorage; su web localStorage). */
export function getSupabase(url: string, anonKey: string): SupabaseLike {
  const key = `${url}|${anonKey}`;
  if (!cached || cached.key !== key) {
    cached = { key, client: createClient(url || 'https://invalid.local', anonKey || 'invalid', { auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: Platform.OS === 'web' } }) };
  }
  return cached.client as unknown as SupabaseLike;
}
