import { Component, type ReactNode } from 'react';

import { log } from '@/lib/log';

/** Isola un pezzo di schermata: se va in errore sparisce soltanto lui e il resto dell'app continua a funzionare. */
export class Safe extends Component<{ name: string; children: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { try { log.warn('ui', `Errore in ${this.props.name}`, e); } catch { /* il log non deve mai rompere */ } }
  render() { return this.state.failed ? (this.props.fallback ?? null) : this.props.children; }
}
