import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Btn, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { dayKey } from '@/lib/format';
import { useApp } from '@/store/app';
import { moodOptions, useHealth } from '@/store/health';
import { toast } from '@/store/toast';

type Step = 'mood' | 'energy' | 'functioning' | 'alcohol';
const SCALE_ENERGY = ['Esausto/a', 'Stanco/a', 'Così così', 'Carico/a', 'Pieno/a di energia'];
const SCALE_FUNC = ['Per niente', 'Con fatica', 'Abbastanza', 'Bene', 'Benissimo'];
const ALCOHOL: [number, string][] = [[0, 'Niente'], [1, 'Poco'], [2, 'Parecchio']];

/** Alla prima apertura di ogni giornata chiede «Come ti senti?» (una volta sola) e, in due tocchi, energia e capacità di fare le cose; una volta a settimana anche l'alcol, con una domanda diretta. */
export function MoodCheckinPrompt({ ready }: { ready: boolean }) {
  const t = useTheme();
  const onboarded = useApp((s) => s.onboarded);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('mood');

  useEffect(() => {
    if (!ready || !onboarded) return;
    const today = dayKey();
    if (useApp.getState().moodAskedDay === today) return;
    if (useHealth.getState().moods.some((m) => m.day === today)) { useApp.getState().set({ moodAskedDay: today }); return; }
    const id = setTimeout(() => { useApp.getState().set({ moodAskedDay: today }); setStep('mood'); setOpen(true); }, 1800);
    return () => clearTimeout(id);
  }, [ready, onboarded]);

  const askAlcohol = () => {
    const week = Date.now() - 7 * 86400000;
    return !useHealth.getState().moods.some((m) => m.alcohol != null && (m.day ? Date.parse(m.day) : 0) > week);
  };
  const next = (from: Step) => {
    if (from === 'mood') setStep('energy');
    else if (from === 'energy') setStep('functioning');
    else if (from === 'functioning' && askAlcohol()) setStep('alcohol');
    else { setOpen(false); toast(tl('Grazie, ci sono. Check-in salvato.')); }
  };
  const choose = (label: string, color: string, on: () => void, width: string = '31%') => (
    <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={on}
      style={{ width: width as `${number}%`, alignItems: 'center', paddingVertical: 13, borderRadius: 14, backgroundColor: t.tile, borderWidth: 1, borderColor: t.border }}>
      <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: color, marginBottom: 7 }} />
      <Text style={{ color: t.text, fontSize: 13, textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
  const SCALE_COLORS = ['#ff9d9d', '#e0c97b', '#8e98a8', '#7bb8e0', '#7be0b0'];
  const title = step === 'mood' ? tl('Come ti senti?') : step === 'energy' ? tl('Che energia hai oggi?') : step === 'functioning' ? tl('Riesci a fare le cose di tutti i giorni?') : tl('Una domanda sull\'alcol');

  return (
    <Sheet visible={open} title={title} onClose={() => setOpen(false)}>
      {step === 'mood' ? (
        <>
          <Body small muted style={{ marginBottom: 12 }}>{tl('Un tocco al giorno: lo confronto con sonno, impegni e spese per capire cosa ti fa stare meglio.')}</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {moodOptions.map(([m, c]) => choose(m, c, () => { useHealth.getState().logMood(m); next('mood'); }))}
          </View>
        </>
      ) : null}
      {step === 'energy' || step === 'functioning' ? (
        <>
          <Body small muted style={{ marginBottom: 12 }}>{step === 'energy' ? tl('Quanta energia senti oggi, o quanta fatica?') : tl('Lavoro, studio, faccende: come ti sembra di riuscire a gestirli in questi giorni?')}</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(step === 'energy' ? SCALE_ENERGY : SCALE_FUNC).map((l, i) => choose(tl(l), SCALE_COLORS[i]!, () => { useHealth.getState().setTodayCheckin(step === 'energy' ? { energy: i + 1 } : { functioning: i + 1 }); next(step); }, i < 3 ? '31%' : '48%'))}
          </View>
          <Btn ghost small style={{ marginTop: 10 }} title={tl('Salta')} onPress={() => next(step)} />
        </>
      ) : null}
      {step === 'alcohol' ? (
        <>
          <Body small muted style={{ marginBottom: 12 }}>{tl('Nell\'ultima settimana hai bevuto alcol? Rispondi come ti viene: serve solo a capire meglio, nessun giudizio.')}</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ALCOHOL.map(([v, l]) => choose(tl(l), SCALE_COLORS[v * 2]!, () => { useHealth.getState().setTodayCheckin({ alcohol: v }); next('alcohol'); }))}
          </View>
          <Btn ghost small style={{ marginTop: 10 }} title={tl('Preferisco non rispondere')} onPress={() => { useHealth.getState().setTodayCheckin({ alcohol: -1 }); next('alcohol'); }} />
        </>
      ) : null}
    </Sheet>
  );
}
