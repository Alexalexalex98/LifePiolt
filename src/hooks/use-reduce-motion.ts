import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useApp } from '@/store/app';

/** true se l'utente ha attivato "Riduci animazioni" nell'app O nelle impostazioni di sistema. */
export function useReduceMotion(): boolean {
  const inApp = useApp((s) => s.accessibility.reduceMotion);
  const [system, setSystem] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { if (alive) setSystem(!!v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => setSystem(!!v));
    return () => { alive = false; sub?.remove?.(); };
  }, []);
  return inApp || system;
}
