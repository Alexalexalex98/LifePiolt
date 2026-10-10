import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Btn, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tr } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { decideMode, isUnlocked, levelDef, nextTour, pageFromPath, pageLevel, tourSteps } from '@/lib/tour';
import { useApp } from '@/store/app';
import { useDiscover } from '@/store/discover';
import { useTour } from '@/store/tour';
import { toast } from '@/store/toast';

import { readSignals, useSignals } from './hooks';
import { TourOverlay } from './TourOverlay';

/** Navigazione di partenza consigliata per chi inizia: Home, Piano, Theia e le prime aree ancora chiuse. */
const DEFAULT_NAV = ['home', 'ai', 'lifenetwork', 'lifefinance', 'profile'];
const GUIDED_NAV = ['home', 'plan', 'ai', 'lifefinance', 'profile'];

/**
 * Regia del tour: decide il percorso alla prima apertura (nuovo / demo / già in uso), mostra il benvenuto e i mini-tour,
 * sblocca le aree una alla volta, e protegge le pagine ancora chiuse con la scheda "Si sblocca presto" (sempre sbloccabile).
 */
export function TourHost() {
  const name = useApp((s) => s.account.name);
  const mode = useTour((s) => s.mode);
  const active = useTour((s) => s.active);
  const step = useTour((s) => s.step);
  const lockPrompt = useTour((s) => s.lockPrompt);
  const signals = useSignals();
  const pathname = usePathname();
  const started = useRef(false);

  // 1) alla prima apertura decide il percorso. Chi usava già l'app (guida già vista) resta con tutto aperto.
  useEffect(() => {
    const tour = useTour.getState();
    if (tour.mode != null) return;
    const d = useDiscover.getState();
    const m = decideMode({ firstSeenAt: d.firstSeenAt, demo: useApp.getState().demo });
    tour.init(m, readSignals());
    if (d.firstSeenAt == null) d.set({ firstSeenAt: Date.now() });
    if (m !== 'open') {
      const app = useApp.getState();
      if (app.navItems.join() === DEFAULT_NAV.join()) app.set({ navItems: GUIDED_NAV });
    }
  }, []);

  // 2) all'apertura: mostra il benvenuto (o un "Nuovo: ..." rimasto in sospeso)
  useEffect(() => {
    if (mode == null || started.current) return;
    started.current = true;
    const id = nextTour(useTour.getState());
    if (!id) return;
    const h = setTimeout(() => {
      if (useTour.getState().active) return;
      go('home');
      setTimeout(() => useTour.getState().start(id), 450);
    }, 500);
    return () => clearTimeout(h);
  }, [mode]);

  // 3) sblocco progressivo quando l'area precedente è stata usata (o passano i giorni)
  useEffect(() => {
    if (mode == null) return;
    const lvl = useTour.getState().tick(signals);
    if (lvl) { const d = levelDef(lvl); if (d) toast(tr('Nuovo da scoprire: {0}', d.title)); }
  }, [mode, signals]);

  // 4) pagina chiusa raggiunta da un link/ricerca/assistente: spiega e permette di sbloccare
  useEffect(() => {
    if (mode == null) return;
    const page = pageFromPath(pathname);
    if (!isUnlocked(useTour.getState(), page)) useTour.getState().promptLock(page);
  }, [pathname, mode]);

  const steps = active ? tourSteps(active, mode) : [];
  return (
    <>
      {active && steps.length > 0 && (
        <TourOverlay
          steps={steps}
          index={step}
          name={name}
          onNext={() => useTour.getState().next(steps.length)}
          onBack={() => useTour.getState().back()}
          onSkip={() => useTour.getState().finish()}
          onDone={(page) => { useTour.getState().finish(); if (page && page !== 'home') setTimeout(() => go(page), 200); }}
          onUnlockAll={() => { useTour.getState().unlockEverything(); useTour.getState().finish(); toast('Tutte le funzioni sono sbloccate'); }}
          doneLabel={active === 'welcome' ? 'Inizia' : 'Fine'}
        />
      )}
      <UnlockSheet page={lockPrompt} pathname={pathname} />
    </>
  );
}

/** "Si sblocca presto": spiega con calma e lascia sbloccare subito (solo quell'area o tutto). */
export function UnlockSheet({ page, pathname }: { page: string | null; pathname: string }) {
  const t = useTheme();
  const level = pageLevel(page);
  const def = levelDef(level);
  const onLockedPath = !isUnlocked(useTour.getState(), pageFromPath(pathname));
  const close = () => {
    useTour.getState().promptLock(null);
    if (onLockedPath) go('home');
  };
  const unlockHere = () => {
    useTour.getState().unlockTo(level, readSignals());
    useTour.getState().promptLock(null);
    if (page && !onLockedPath) go(page);
    toast(tr('{0} è sbloccato', def?.title ?? 'Area'));
  };
  const unlockAll = () => {
    useTour.getState().unlockEverything();
    useTour.getState().promptLock(null);
    if (page && !onLockedPath) go(page);
    toast('Tutte le funzioni sono sbloccate');
  };
  return (
    <Sheet visible={!!page && !!def} title="Si sblocca presto" onClose={close}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: t.accent + '26', alignItems: 'center', justifyContent: 'center' }}><Icon name="lock" size={22} color={t.accent} stroke={2} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: 18, fontWeight: '800' }}>{def?.title}</Text>
          <Text style={{ color: t.muted, fontSize: 13 }}>{def?.short}</Text>
        </View>
      </View>
      <Body muted>Prima prendiamo confidenza con le basi: umore, Piano e Theia. Questa area si apre da sola tra poco, appena sei pronto.</Body>
      <Body small muted style={{ marginTop: 8 }}>Non devi aspettare: se vuoi, puoi sbloccarla adesso.</Body>
      <View style={{ gap: 8, marginTop: 16 }}>
        <Btn icon="check" title="Sblocca ora" onPress={unlockHere} />
        {level < 7 && <Btn ghost title="Sblocca tutte le funzioni" onPress={unlockAll} />}
        <Btn ghost title={onLockedPath ? 'Torna alla Home' : 'Non adesso'} onPress={close} />
      </View>
    </Sheet>
  );
}
